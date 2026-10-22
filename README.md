# ShopSphere

*Built Nov 2025 -- Mar 2026.*

A microservices e-commerce platform: an API gateway plus NestJS business services, one PostgreSQL database per service, Redis for carts, Elasticsearch for product search and Stripe for payments. Docker Compose and PM2 run all 9 services. Kubernetes runs 8 of them. Docker Compose runs Nginx in front of 3 gateway replicas. A Kubernetes setup on a local kind cluster adds autoscaling (HPA), probes and k6 load tests.

I built this to go beyond a typical CRUD app and deal with the actual problems distributed systems create: service-to-service communication, keeping data consistent across service boundaries, caching, and deployment.

**Stack**: Next.js, NestJS, TypeScript, PostgreSQL, Redis, Elasticsearch, Docker, Kubernetes (kind), HPA, k6, Stripe, Nginx, Prisma

**Live**: [shop-sphere.online](https://shop-sphere.online)

**Results at a glance** (k6 on a local Kubernetes cluster; details in [Testing & Performance](#testing--performance)):

- Search over **1M** products at **800 req/s**: p95 **49.6ms**, **0 of 36,001** requests failed
- Checkout at **~240 req/s**: **100%** success (3,600 / 3,600 checkouts), order-create p95 **87ms**
- A catalog pod crashed mid-run: **12,001 / 12,001** requests OK; rolling restart: **12,000 / 12,000** OK
- Found and fixed cart pods that never reconnected to Redis after a restart; carts now recover in about **10s**

---

## Architecture

```
                              ┌─────────────────┐
                              │   Next.js 16     │
                              │   (Frontend)     │
                              │                  │
                              └────────┬─────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │      Nginx       │
                              │  Load Balancer   │
                              │  (least_conn)    │
                              └────────┬─────────┘
                                       │
                         ┌─────────────┼─────────────┐
                         ▼             ▼             ▼
                    ┌─────────┐  ┌─────────┐  ┌─────────┐
                    │ API GW  │  │ API GW  │  │ API GW  │
                    │  :8000  │  │  :8000  │  │  :8000  │
                    └────┬────┘  └────┬────┘  └────┬────┘
                         │            │            │
                         └─────────┬──┘────────────┘
                                   │
          ┌────────────────────────┼────────────────────────────┐
          │            │           │           │          │      │
          ▼            ▼           ▼           ▼          ▼      ▼
    ┌───────────┐ ┌─────────┐ ┌────────┐ ┌─────────┐ ┌──────┐ ┌──────────┐
    │   User    │ │ Product │ │  Cart  │ │  Order  │ │ Pay  │ │  Review  │
    │  :3001    │ │  :3002  │ │ :3003  │ │  :3004  │ │:3006 │ │  :3007   │
    └─────┬─────┘ └────┬────┘ └───┬────┘ └────┬────┘ └──┬───┘ └────┬─────┘
          │            │          │            │         │           │
          ▼            ▼          ▼            ▼         ▼           ▼
       PG Users    PG Products  Redis      PG Orders  PG Payments  PG Reviews
                       +
                  Elasticsearch
                                     ┌──────────────┐   ┌──────────────┐
                                     │ Notification  │   │  Inventory    │
                                     │    :3005      │   │    :3008      │
                                     │  (Nodemailer) │   │ (k8s only)    │
                                     └───────────────┘   └──────┬────────┘
                                                                ▼
                                                          PG Inventory
```

### Services and where they run

The repo has 9 NestJS services: the API gateway and 8 business services. Docker Compose and PM2 run all 9. Kubernetes runs 8.

| Service | Port | Data store | Docker Compose / PM2 | Kubernetes (kind) |
|---|---|---|---|---|
| api-gateway | 8000 | Redis (response cache) | yes (3 replicas behind Nginx) | yes (`gateway`) |
| user-service | 3001 | PostgreSQL | yes | yes |
| product-service | 3002 | PostgreSQL + Elasticsearch | yes | yes (`catalog-svc`) |
| cart-service | 3003 | Redis | yes | yes |
| order-service | 3004 | PostgreSQL | yes | yes |
| notification-service | 3005 | none | yes | yes |
| payment-service | 3006 | PostgreSQL | yes | no (left out of the k8s topology) |
| review-service | 3007 | PostgreSQL | yes | yes |
| inventory-service | 3008 | PostgreSQL | yes | yes |

**Inventory Service** owns stock levels in its own database. Order Service calls it over REST to decrement stock when an order is created (`POST /api/inventory/decrement`, all lines or none) and to restock when an order is cancelled. The gateway has no route to it. Order creation fails when the stock call fails, so each product needs a stock row before checkout works. The Fly.io image (`Dockerfile.fly`) does not build inventory-service yet, so checkout does not work on that deploy.

### Kubernetes topology (kind)

```
   k6 load test ──▶ localhost:8080
                        │
                        ▼
              ┌───────────────────┐
              │   Nginx Ingress   │
              └─────────┬─────────┘
                        ▼
              ┌───────────────────┐      service discovery: k8s DNS
              │  gateway (JWT,    │      (http://catalog-svc:3002, ...)
              │  rate limit)      │
              └─────────┬─────────┘
     ┌──────────┬───────┼─────────┬─────────────┬──────────────┐
     ▼          ▼       ▼         ▼             ▼              ▼
  user-svc  catalog-svc cart-svc order-svc  inventory-svc  review-svc
     │      HPA 2-6     HPA 3-8  HPA 2-6        │              │
     ▼          │        │        │   └─REST────┘              ▼
  PG users  PG catalog  Redis   PG orders    PG inventory   PG reviews
            + ES index                       notification-svc (no store)
```

4 kind nodes run on one 8-core laptop VM. The HPAs scale on 60% CPU (`k8s/services/09-hpa.yaml`). Postgres, Redis and Elasticsearch use `emptyDir` volumes, so a restart of those pods wipes their data.

Each service owns its data. No shared databases. The Cart Service is entirely Redis-backed (carts are ephemeral). Docker Compose runs six PostgreSQL instances: users, products, orders, payments, reviews and inventory. Kubernetes runs five: users, catalog, orders, inventory and reviews. Product Service also indexes into Elasticsearch for full-text search.

**Product search uses a CQRS-style split.** Product Service writes every create, update and delete to PostgreSQL (the source of truth) through Prisma, then updates the Elasticsearch `products` index in the same request. Text search (`GET /api/products?q=...`) reads from Elasticsearch, and the result is cached in Redis for 60 seconds. If Elasticsearch is unavailable, the query falls back to PostgreSQL. Listings without a search term read from PostgreSQL.

The API Gateway is the single entry point: it handles JWT validation, rate limiting, and a 30-second Redis cache on repeated GET requests, so downstream services don't have to deal with any of that themselves.

### Why Microservices?

Honestly, a monolith would ship faster for a project this size. I chose microservices intentionally to work through the challenges.

Database-per-service forced me to think about data ownership. When the Order Service needs product details, it can't just JOIN. It has to call the Product Service and snapshot the data at purchase time. Inter-service calls are plain HTTP/REST over Axios; I considered a message queue but the call patterns here are mostly request-response, so synchronous was simpler to reason about. A broker like RabbitMQ or Kafka would earn its keep once there's an actual event-driven flow, like inventory reservation, to justify it.

The API Gateway handles auth, rate limiting, and caching so the individual services can stay focused on business logic. They trust the gateway and skip re-validating JWTs themselves.

### How a Request Flows Through the System

Taking "user places an order" as an example, since it touches the most services:

```
1. Client POST /api/orders
2. Nginx (Compose) or the Nginx Ingress (Kubernetes) routes to an API Gateway replica
3. Gateway validates JWT, checks role, forwards to Order Service
4. Order Service calls Cart Service to get cart items and totals
5. Order Service creates the order (snapshots cart item data into order_items)
6. Order Service calls Inventory Service to decrement stock; insufficient stock fails the request
7. Order Service returns the order; cart clearing and the confirmation email run in the background
8. Client initiates payment via Payment Service
9. Stripe webhook fires on payment success, Payment Service updates order status
```

This is where the trade-off of synchronous REST shows up. Steps 4 to 6 are sequential HTTP calls, so a slow Cart or Inventory Service slows checkout. Steps that do not affect correctness (cart clearing, email) run after the response, so a slow Notification Service does not slow the order. They are fire-and-forget with no retry. A message queue would add durable delivery, at the cost of more infrastructure.

---

## Features

### Storefront

- Product browsing with category filters, price range, brand search, and sort options
- Full-text product search powered by Elasticsearch
- Product detail pages with image galleries, pricing, and stock status
- Featured products and category-based navigation

### Cart & Checkout

- Persistent shopping cart (Redis-backed, supports guest users)
- Guest-to-user cart merging on login
- Coupon/discount code system
- Multi-step checkout: Shipping → Payment → Confirmation
- Stripe payment integration with real-time status updates
- Cash on delivery option
- Automatic tax calculation (8%) and free shipping over $100

### User Accounts

- Registration with strong password validation
- JWT auth with access/refresh token rotation
- Password reset via email
- Order history with status tracking (Pending → Confirmed → Processing → Shipped → Delivered)
- Multi-device session management (logout from all devices)

### Product Reviews

- Star ratings (1-5) with review titles and content
- Verified purchase badges
- "Was this helpful?" voting system
- Review summary statistics per product

### Admin Capabilities

- Role-based access control (Customer / Seller / Admin)
- Product CRUD with image uploads (Cloudinary)
- Inventory management with low-stock alerts
- Order management and status updates
- Category hierarchy management

### Infrastructure

- API Gateway with centralized auth, rate limiting, and Redis response caching
- Nginx load balancing across 3 API Gateway replicas (least_conn algorithm)
- Rate limiting: 5000 req/s for API, 100 req/s for auth endpoints
- Stripe webhook handling with raw body passthrough (bypasses rate limits)
- Health checks on all services
- Gzip compression, connection pooling, keepalive optimization

---

## Design Trade-offs

Every architecture decision has a cost. These are the ones I thought about the most:

| Decision | Alternative Considered | Why I Went This Way | The Trade-off |
|----------|----------------------|---------------------|---------------|
| JWT (stateless) | Server-side sessions (Redis) | Scales horizontally without sticky sessions. Any gateway replica validates the token. | Can't instantly revoke access tokens. Mitigated with short 15min expiry + refresh token revocation in DB. |
| Redis for carts | PostgreSQL | Carts are high-frequency, ephemeral data. Redis gives sub-ms reads and natural TTL expiry. | If Redis goes down, carts are lost. Acceptable since carts are easily rebuilt. |
| Elasticsearch for search (CQRS-style read model) | PostgreSQL full-text (`tsvector`) | Need fuzzy matching, typo tolerance, and relevance scoring. ES handles this out of the box. Writes go to Postgres, search reads go to ES. | Two copies of product data. ES is a read-optimized mirror, Postgres stays authoritative. The ES update runs in the write request, so a failed index update can leave ES behind Postgres. |
| Database-per-service | Shared database | Independent schema evolution. No accidental coupling through joins. | Operational overhead of 5 or 6 Postgres instances per deployment. Can't do cross-service joins; need data snapshots. |
| Synchronous REST | Message queue (RabbitMQ) | Simpler to debug and trace. Request-response fits the current call patterns. | Cascading latency. If Notification Service is slow, the order request is slow. |
| Nginx load balancing | Application-level (e.g., Node.js cluster) | Nginx handles rate limiting, gzip, keepalive, and health checks at infra layer. | Extra component to configure. Worth it to keep these concerns out of app code. |

---

## Tech Stack

| Layer             | Technology                                 | Why                                                               |
| ----------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| **Frontend**      | Next.js 16, React 19, TypeScript           | SSR for SEO, React Server Components, type safety                 |
| **UI**            | Tailwind CSS, Radix UI, Lucide Icons       | Utility-first styling, accessible primitives                      |
| **Forms**         | React Hook Form + Zod                      | Performant forms with schema validation                           |
| **Backend**       | NestJS 10, TypeScript                      | Opinionated structure, DI container, decorators for clean routing |
| **ORM**           | Prisma 5                                   | Type-safe queries, migrations, schema-as-code                     |
| **Auth**          | JWT (access + refresh tokens), Passport.js | Stateless auth, multi-device support                              |
| **Databases**     | PostgreSQL 15 (5 instances per deployment) | ACID compliance, one per service                                  |
| **Cache**         | Redis 7                                    | Session store, cart persistence, response caching                 |
| **Search**        | Elasticsearch 8.11                         | Full-text product search, way faster than LIKE queries            |
| **Payments**      | Stripe (Payment Intents API)               | PCI-compliant, webhook-driven status updates                      |
| **Email**         | Nodemailer + Handlebars                    | Templated transactional emails                                    |
| **Images**        | Cloudinary                                 | CDN-backed image uploads, transformations                         |
| **Load Balancer** | Nginx                                      | least_conn balancing, rate limiting, gzip                         |
| **Containers**    | Docker + Docker Compose                    | 21 containers, isolated environments                              |
| **Orchestration** | Kubernetes on kind, Nginx Ingress          | Local 4-node cluster, DNS service discovery, probes              |
| **Autoscaling**   | Horizontal Pod Autoscaler (CPU 60%)        | catalog 2-6, order 2-6, cart 3-8 replicas                         |
| **Load testing**  | k6                                         | Open-loop (constant-arrival-rate) search and checkout scenarios   |
| **Process Mgmt**  | PM2                                        | Production process management for single-VM deploys               |

---

## Testing & Performance

### Unit Tests

Jest unit tests exist for three services, with Prisma mocked:

- `user-service`: `auth.service.spec.ts`, `users.service.spec.ts`
- `product-service`: `products.service.spec.ts`, `products.controller.spec.ts`, `categories.service.spec.ts`
- `order-service`: `orders.service.spec.ts`

The other services have no unit tests yet. CI runs the three suites above.

```bash
# Run tests for a specific service
cd services/user-service && npm test

# With coverage report
npm run test:cov
```

### Load Testing (k6)

k6 scenarios, each with a latency threshold. The rates below are the load each script asks for, not measured results. See [Results](#results) for what the runs achieved.

| Scenario | What It Tests | Threshold |
|----------|--------------|-----------|
| **Product Browse** | Listing, detail pages, search | p95 < 100ms |
| **Search Benchmark** | Elasticsearch text search, filtered search, price range, combined queries | p95 < 50ms |
| **CRUD Operations** | Read/write across services (authenticated) | p95 < 80ms |
| **Order Flow** | Full checkout flow. Script target: constant-arrival-rate at 2,000 req/s with 500 pre-allocated VUs (a stress target, not an achieved rate) | p95 < 100ms |
| **Search 1M** (`search-1m.js`, k8s) | Elasticsearch search over 1M products, rate set by `RATE` (default 300 req/s) | p95 < 50ms |
| **Checkout Flow** (`checkout-flow.js`, k8s) | Create cart, add item, create order (3 requests per checkout), rate set by `RATE` (default 500 checkouts/s) | order p95 < 200ms |

```bash
# Run all scenarios
cd load-tests && ./run-all.sh

# Run individual scenario
k6 run ./load-tests/scenarios/search-benchmark.js
```

### Results

All runs use the local kind cluster: 4 nodes on one 8-core laptop VM. Search runs query about 1M products (1,000,000 rows seeded, see `k8s/RUNBOOK.md`).

**Main results (June 2026)**

| Test | Result | Source |
|---|---|---|
| Search at 800 req/s | p95 49.6ms, 0 of 36,001 requests failed | `load-tests/results/k8s_final/search-1m.summary.json` |
| Checkout at ~240 req/s (80 checkouts/s) | 100% success (3,600 / 3,600 checkouts), order-create p95 87ms, all requests p95 56.6ms | `load-tests/results/k8s_final/checkout-flow.summary.json` |

**Resilience (October 21, 2026, search at 300 req/s)**

| Test | Result | Source |
|---|---|---|
| One catalog pod crashes mid-run | 12,001 / 12,001 requests OK | `load-tests/results/2026-10-21/pod-crash-one.summary.json` |
| Rolling restart of the catalog service | 12,000 / 12,000 requests OK | `load-tests/results/2026-10-21/rolling-restart.summary.json` |
| Redis pod deleted (after the reconnect fix) | carts back to 200 in about 10s, 0 cart pod restarts | `load-tests/results/2026-10-21/README.md` |

**Later capacity and saturation tests (October 21, 2026, same single laptop VM)**

These runs push checkout past the June load to find the limit of one laptop. They do not replace the June result above.

| Test | Result | Source |
|---|---|---|
| Warm, 120 checkouts/s (~358 req/s) | 99.98% success, order p95 128ms | `load-tests/results/2026-10-21/README.md` (console summary) |
| Warm, 160 checkouts/s | order p95 1.11s | same |
| Warm, 200 checkouts/s | saturated (latency collapse) | same |

Earlier runs at 500 checkouts/s also saturated this hardware. The 500 checkouts/s default in `checkout-flow.js` and the 2,000 req/s target in `order-flow.js` are script targets that this setup did not reach.

### Resilience runs and a bug they found (October 2026)

Run on the local kind cluster (4 nodes on one 8-core laptop VM) with search at 300 req/s. Full results and scripts: [`load-tests/results/2026-10-21/`](load-tests/results/2026-10-21/README.md). The one-pod crash run had p95 5.1ms and the rolling restart p95 7.5ms. When all catalog pods are deleted at once (a full outage), requests fail until new pods are ready, as expected.

**Cart pods that never reconnected to Redis.** After a cluster restart, every `POST /api/cart` failed while `/api/health` still said ok. The ioredis `retryStrategy` gave up after 3 tries, so a pod that started before Redis was reachable never reconnected. Fix: retry forever with backoff capped at 5s in the gateway, cart, product and user services, and a cart readiness probe (`/api/health/ready`) that fails while Redis is down, so Kubernetes stops sending traffic to that pod. Liveness stays independent of Redis, so pods are not restarted for a Redis outage. Proof: after deleting the Redis pod, carts returned 200 again in about 10 seconds with 0 pod restarts.

**Checkout capacity.** In the later saturation tests, the warm cluster held 120 checkouts/s (about 358 req/s) at 99.98% success with order p95 128ms; at 200 checkouts/s it saturated. A faster HPA scale-up made a cold spike worse (order p95 1.24s to 5.2s), because new pods start on the same 8-core VM and take CPU from the pods serving checkouts, so that change was reverted.

### CI/CD Pipeline

GitHub Actions runs on every push and PR to `main`: ESLint on the frontend, a full Next.js production build, all 9 NestJS services built in parallel (matrix strategy, with Prisma client generation for the DB-backed ones), and the Jest suites for user, product and order services.

Deployment is automated on push to `main`: frontend to Vercel, backend to Fly.io.

---

## How I'd Scale This Further

Things I'd tackle to take this from "works well" to "production-grade at scale":

**Reliability.** The confirmation email and cart clearing already run after the order response, but they are fire-and-forget with no retry. A message broker (RabbitMQ or Kafka) would give them durable delivery. A circuit breaker on the gateway (something like `opossum` for Node) would help it fail fast when a downstream service is struggling, rather than piling up on timeouts. And honestly, debugging a request across 8 services with nothing but logs and correlation IDs gets old fast, so proper distributed tracing (Jaeger or Zipkin) with flame graphs is the real fix.

**Performance.** HTTP/JSON adds serialization overhead on every hop between services; gRPC with Protocol Buffers would shrink payloads and enforce actual contracts instead of hoping the shapes match. Product search already splits writes (PostgreSQL) from reads (Elasticsearch). Order history could get a similar split: writes stay on the primary, while high-volume order-history queries hit a read replica. Order tracking is polling-based right now; a WebSocket connection would make that instant instead.

**Infrastructure.** The Kubernetes manifests (`k8s/`) already give service discovery, autoscaling and readiness-gated rolling restarts on a local kind cluster. The next step is a managed cluster with persistent volumes: Postgres and Elasticsearch use `emptyDir` today, so restarting those pods wipes their data.

---

## Project Structure

```
shop-sphere/
├── frontend/                    # Next.js 16 storefront
│   └── src/
│       ├── app/                 # App router pages
│       ├── components/          # UI components (Radix-based)
│       ├── contexts/            # Auth & cart context providers
│       ├── lib/                 # API client, utilities
│       └── types/               # Shared TypeScript types
│
├── services/
│   ├── api-gateway/             # Request routing, auth, caching, rate limiting
│   ├── user-service/            # Auth, profiles, password reset
│   ├── product-service/         # Catalog, categories, search, image upload
│   ├── cart-service/            # Cart CRUD, coupons (Redis-only)
│   ├── order-service/           # Order lifecycle, fulfillment
│   ├── payment-service/         # Stripe integration, refunds
│   ├── notification-service/    # Transactional emails
│   ├── review-service/          # Ratings, reviews, helpfulness votes
│   └── inventory-service/       # Stock levels, atomic decrement/restock
│
├── shared/                      # Shared types, constants, utilities
├── nginx/                       # Load balancer config
├── scripts/                     # DB init scripts
├── data/                        # Seed data
├── load-tests/                  # k6 scenarios and results
├── k8s/                         # kind cluster, manifests, HPA, RUNBOOK.md
├── docker-compose.yml           # Full stack (21 containers)
├── Dockerfile.fly               # Single-container deploy for Fly.io
└── ecosystem.config.js          # PM2 process config
```

---

## API Overview

All requests go through the API Gateway at port 8000. Auth-protected routes require a `Bearer` token.

| Service        | Endpoints                                                                                            | Description                                |
| -------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Auth**       | `POST /api/auth/register`, `login`, `refresh`, `logout`, `forgot-password`, `reset-password`         | JWT-based auth with refresh token rotation |
| **Products**   | `GET /api/products`, `GET /api/products/featured`, `GET /api/products/slug/:slug`, `POST/PUT/DELETE` | Full CRUD, search, filtering, pagination   |
| **Categories** | `GET /api/categories`, `POST /api/categories`                                                        | Hierarchical categories with parent-child  |
| **Cart**       | `GET /api/cart`, `POST /api/cart/:id/items`, `PUT`, `DELETE`, coupon endpoints                       | Redis-backed, guest + authenticated        |
| **Orders**     | `POST /api/orders`, `GET /api/orders`, `PATCH /api/orders/:id/status`                                | Full order lifecycle management            |
| **Payments**   | `POST /api/payments/create-intent`, `confirm`, `webhook`, `refund`                                   | Stripe Payment Intents flow                |
| **Reviews**    | `POST /api/reviews`, `GET /api/reviews/product/:id`, `helpful` voting                                | Verified purchase tracking                 |

Inventory Service has no public route. Only Order Service calls it, inside the cluster.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Stripe account (for payments)
- Cloudinary account (for image uploads)

### Running with Docker (recommended)

This starts 6 Postgres instances, Redis, Elasticsearch, 9 services (3 gateway replicas), Nginx and pgAdmin.

```bash
# Clone the repo
git clone https://github.com/mmerlyn/shop-sphere.git
cd shop-sphere

# Set up environment variables
cp .env.example .env
# Fill in your Stripe keys, Cloudinary credentials, mail config, etc.

# Build and start all containers
docker-compose up --build

# The API will be available at http://localhost (through Nginx)
# pgAdmin at http://localhost:5050
```

Compose does not seed data. Order creation needs a stock row for each product, so seed the catalog and the stock after the containers are up. Inventory IDs mirror the catalog IDs (`prod-1` to `prod-N`). Products from the Prisma seed scripts in product-service get random IDs and have no stock rows.

```bash
# N products in the catalog, then one stock row per product
docker compose exec -T postgres-products psql -U postgres -d products_db -v n=1000 < data/seed/seed-catalog.sql
docker compose exec -T postgres-inventory psql -U postgres -d inventory_db -v n=1000 < data/seed/seed-inventory.sql
```

Run the commands after product-service and inventory-service start, because they create the tables (`prisma db push`). Use the same `n` for both files.

### Run on Kubernetes (kind)

The full steps are in [`k8s/RUNBOOK.md`](k8s/RUNBOOK.md): create the kind cluster, add ingress-nginx and metrics-server, build and load the images, apply the manifests, seed 1M products, then run k6.

```bash
kind create cluster --config k8s/cluster/kind-config.yaml
bash k8s/build-images.sh
kubectl apply -f k8s/infra/ -f k8s/services/ -f k8s/ingress/
# API at http://localhost:8080/api/...
```

> **Warning:** do not run `kubectl rollout restart` on all deployments. Postgres, Redis and Elasticsearch use `emptyDir` volumes, so restarting those pods wipes every database and the seeded 1M products. Restart one app deployment at a time (for example `deploy/catalog-svc`).

### Running Locally (without Docker)

If you want to run services individually for development:

```bash
# Install dependencies (from root)
npm install

# Start required infrastructure
# You'll need PostgreSQL, Redis, and Elasticsearch running locally

# Run database migrations for each service
cd services/user-service && npx prisma db push
cd services/product-service && npx prisma db push
cd services/order-service && npx prisma db push
cd services/payment-service && npx prisma db push
cd services/review-service && npx prisma db push
cd services/inventory-service && npx prisma db push

# Start each service (in separate terminals)
cd services/api-gateway && npm run start:dev
cd services/user-service && npm run start:dev
cd services/product-service && npm run start:dev
cd services/cart-service && npm run start:dev
cd services/order-service && npm run start:dev
cd services/payment-service && npm run start:dev
cd services/notification-service && npm run start:dev
cd services/review-service && npm run start:dev
cd services/inventory-service && npm run start:dev

# Start the frontend
cd frontend && npm run dev
```

### Environment Variables

<details>
<summary>Click to expand full list</summary>

```env
# Databases
DATABASE_URL_USERS=postgresql://user:pass@localhost:5432/shop_users
DATABASE_URL_PRODUCTS=postgresql://user:pass@localhost:5433/shop_products
DATABASE_URL_ORDERS=postgresql://user:pass@localhost:5434/shop_orders
DATABASE_URL_PAYMENTS=postgresql://user:pass@localhost:5435/shop_payments
DATABASE_URL_REVIEWS=postgresql://user:pass@localhost:5436/shop_reviews
DATABASE_URL_INVENTORY=postgresql://user:pass@localhost:5437/shop_inventory

# Redis & Search
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200

# Auth
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

# Email (SMTP)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=noreply@shopsphere.com

# Service URLs (for inter-service communication)
USER_SERVICE_URL=http://localhost:3001
PRODUCT_SERVICE_URL=http://localhost:3002
CART_SERVICE_URL=http://localhost:3003
ORDER_SERVICE_URL=http://localhost:3004
NOTIFICATION_SERVICE_URL=http://localhost:3005
PAYMENT_SERVICE_URL=http://localhost:3006
REVIEW_SERVICE_URL=http://localhost:3007
INVENTORY_SERVICE_URL=http://localhost:3008

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
```

</details>

---

## License

[MIT](LICENSE)

---

Built by **Merlyn Mercy Lona** · [LinkedIn](https://www.linkedin.com/in/merlynmercylona/) · [GitHub](https://github.com/mmerlyn)
