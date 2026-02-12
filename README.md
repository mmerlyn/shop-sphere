# ShopSphere

A microservices-based e-commerce platform built from scratch with **8 independent services** and database-per-service isolation (5 PostgreSQL instances, Redis, Elasticsearch). The system handles everything from product search (Elasticsearch) to payment processing (Stripe) to order fulfillment - all behind an API gateway with Nginx load balancing across 3 replicas.

I built this to go beyond typical monolithic CRUD apps and tackle the real problems that come with distributed systems: service communication, data consistency across boundaries, caching strategies, and deployment orchestration.

**Highlights**: 8 microservices · 19 Docker containers · Nginx load balancing (3 replicas) · Elasticsearch full-text search · Stripe payments · Redis caching (LRU, 256MB) · JWT auth with token rotation · GitHub Actions CI/CD · k6 load tested (500 VUs, p95 < 100ms)

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white) ![NestJS](https://img.shields.io/badge/NestJS_10-E0234E?style=for-the-badge&logo=nestjs&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL_15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white) ![Redis](https://img.shields.io/badge/Redis_7-DC382D?style=for-the-badge&logo=redis&logoColor=white) ![Elasticsearch](https://img.shields.io/badge/Elasticsearch_8.11-005571?style=for-the-badge&logo=elasticsearch&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white) ![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=for-the-badge&logo=stripe&logoColor=white) ![Nginx](https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white) ![Prisma](https://img.shields.io/badge/Prisma_5-2D3748?style=for-the-badge&logo=prisma&logoColor=white)

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
                                     ┌──────────────┐
                                     │ Notification  │
                                     │    :3005      │
                                     │  (Nodemailer) │
                                     └───────────────┘
```

Each service owns its data. No shared databases. The Cart Service is entirely Redis-backed (carts are ephemeral), while the other five data services each get their own PostgreSQL instance. Product Service additionally indexes into Elasticsearch for full-text search.

### System Design Patterns

| Pattern | Implementation | Why It Matters |
|---------|---------------|----------------|
| **API Gateway** | Single entry point handling auth, routing, and caching for all 7 downstream services | Clients hit one URL. Services don't deal with auth or rate limiting. |
| **Database-per-Service** | 5 separate PostgreSQL instances + Redis + Elasticsearch | Each service schema evolves independently. No coupling through shared tables. |
| **Horizontal Scaling** | 3 API Gateway replicas behind Nginx (least_conn) | Gateway is the bottleneck in a fan-out architecture, so it scales first. |
| **Caching (multi-layer)** | Redis at the gateway intercepts repeated GET requests (30s TTL). Cart data lives entirely in Redis. | Reduces DB load on read-heavy endpoints. Cache invalidation on writes. |
| **Rate Limiting** | Nginx rate zones: 5000 req/s for API, 100 req/s for auth, unlimited for Stripe webhooks | Protects against abuse with different thresholds per endpoint sensitivity. |
| **Data Consistency** | Order items snapshot product name/price/image at purchase time | Products can change after an order is placed. The order record stays accurate. |
| **Stateless Auth** | JWT access tokens (15min) + refresh tokens (7d, stored in DB for revocation) | Any gateway replica can validate a request. No sticky sessions needed. |
| **Search Indexing** | Elasticsearch mirrors product data from PostgreSQL | PostgreSQL is the source of truth. ES handles fuzzy matching and relevance scoring. |

### Why Microservices?

Honestly, a monolith would ship faster for a project this size. I chose microservices intentionally to work through the challenges:

- **Database-per-service** forced me to think about data ownership. When the Order Service needs product details, it can't just JOIN. It has to call the Product Service and snapshot the data at purchase time.
- **Inter-service communication** is HTTP/REST (via Axios). I considered message queues but kept it synchronous since the call patterns are mostly request-response. A message broker (RabbitMQ/Kafka) would make sense if I needed event-driven flows like inventory reservation.
- **The API Gateway** handles auth, rate limiting, and caching so individual services stay focused on business logic. Services trust the gateway and don't re-validate JWTs.

### How a Request Flows Through the System

Taking "user places an order" as an example, since it touches the most services:

```
1. Client POST /api/orders
2. Nginx routes to least-busy API Gateway replica
3. Gateway validates JWT, checks role, forwards to Order Service
4. Order Service calls Cart Service to get cart items
5. Order Service calls Product Service to validate prices + stock
6. Order Service creates the order (snapshots product data into order_items)
7. Order Service calls Notification Service to send confirmation email
8. Client gets order response, then initiates payment via Payment Service
9. Stripe webhook fires on payment success, Payment Service updates order status
```

This is where the trade-off of synchronous REST shows up. Steps 4-7 are sequential HTTP calls. If Notification Service is slow, the whole request is slower. A message queue would fix that by making step 7 async, but adds infrastructure complexity I didn't need yet.

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
| Elasticsearch for search | PostgreSQL full-text (`tsvector`) | Need fuzzy matching, typo tolerance, and relevance scoring. ES handles this out of the box. | Two sources of truth for product data. ES is a read-optimized mirror, Postgres stays authoritative. |
| Database-per-service | Shared database | Independent schema evolution. No accidental coupling through joins. | Operational overhead of 5 Postgres instances. Can't do cross-service joins; need data snapshots. |
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
| **Databases**     | PostgreSQL 15 (x5)                         | ACID compliance, one per service                                  |
| **Cache**         | Redis 7                                    | Session store, cart persistence, response caching                 |
| **Search**        | Elasticsearch 8.11                         | Full-text product search, way faster than LIKE queries            |
| **Payments**      | Stripe (Payment Intents API)               | PCI-compliant, webhook-driven status updates                      |
| **Email**         | Nodemailer + Handlebars                    | Templated transactional emails                                    |
| **Images**        | Cloudinary                                 | CDN-backed image uploads, transformations                         |
| **Load Balancer** | Nginx                                      | least_conn balancing, rate limiting, gzip                         |
| **Containers**    | Docker + Docker Compose                    | 19 containers, isolated environments                              |
| **Process Mgmt**  | PM2                                        | Production process management for single-VM deploys               |

---

## Testing & Performance

### Unit Tests

Each service has isolated Jest tests. Prisma-backed services test against mocked DB layers.

```bash
# Run tests for a specific service
cd services/user-service && npm test

# With coverage report
npm run test:cov
```

### Load Testing (k6)

I wrote 4 k6 scenarios to validate performance under load and catch regressions. Tests ramp from 50 to 500 virtual users over 5 minutes.

| Scenario | What It Tests | Threshold | Target |
|----------|--------------|-----------|--------|
| **Product Browse** | Listing, detail pages, search | `p(95)` | < 100ms |
| **Search Benchmark** | Elasticsearch text search, filtered search, price range, combined queries | `p(95)` | < 50ms |
| **CRUD Operations** | Read/write across services (authenticated) | `p(95)` | < 80ms |
| **Order Flow** | Full transaction flow at 2,000 iterations/sec (constant arrival rate, 500 pre-allocated VUs) | `p(95)` | < 100ms |

```bash
# Run all scenarios
cd load-tests && ./run-all.sh

# Run individual scenario
k6 run ./load-tests/scenarios/search-benchmark.js
```

All scenarios enforce strict error thresholds (`< 1%` for browse/search/CRUD, `< 5%` for order flow). The order flow scenario uses `constant-arrival-rate` executor at 2,000 req/s to simulate sustained checkout traffic.

### CI/CD Pipeline

GitHub Actions runs on every push and PR to `main`:

- **Lint Frontend** — ESLint on the Next.js codebase
- **Build Frontend** — Full Next.js production build
- **Build Services** — All 8 NestJS services built in parallel (matrix strategy), with Prisma client generation for DB-backed services

Deployment is automated:
- **Frontend** → Vercel (on push to `main`)
- **Backend** → Fly.io (on push to `main`)

---

## How I'd Scale This Further

Things I'd tackle to take this from "works well" to "production-grade at scale":

**Reliability**
- **Message broker (RabbitMQ/Kafka)** to decouple order creation from notification/payment flows. Right now, if the Notification Service is down, the order request is slower. Async messaging fixes this.
- **Circuit breaker pattern** so the gateway fails fast when a downstream service is struggling, instead of blocking on timeouts. Something like `opossum` for Node.js.
- **Distributed tracing (Jaeger/Zipkin)** because debugging request flows across 8 services with just logs is not sustainable. Correlation IDs help, but proper tracing with flame graphs would be the real solution.

**Performance**
- **gRPC for inter-service calls** since HTTP/JSON adds serialization overhead on every hop. Protocol Buffers would reduce payload sizes and enforce contracts between services.
- **CQRS for Order Service** to separate read/write models. Writes need strong consistency on the primary; high-volume order list queries could run against a read replica.
- **WebSocket for real-time order tracking** instead of the current polling approach. A persistent connection from the frontend would give instant status updates.

**Infrastructure**
- **Kubernetes** for service discovery, auto-scaling, rolling deployments, and health-based routing. Docker Compose works for dev and PM2 handles a single VM, but k8s is the right answer for actual production.

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
│   └── review-service/         # Ratings, reviews, helpfulness votes
│
├── shared/                      # Shared types, constants, utilities
├── nginx/                       # Load balancer config
├── scripts/                     # DB init scripts
├── data/                        # Seed data
├── load-tests/                  # Performance test scenarios
├── docker-compose.yml           # Full stack (19 containers)
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

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Stripe account (for payments)
- Cloudinary account (for image uploads)

### Running with Docker (recommended)

This spins up everything: 5 Postgres instances, Redis, Elasticsearch, all services, Nginx, and pgAdmin.

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

# Start each service (in separate terminals)
cd services/api-gateway && npm run start:dev
cd services/user-service && npm run start:dev
cd services/product-service && npm run start:dev
cd services/cart-service && npm run start:dev
cd services/order-service && npm run start:dev
cd services/payment-service && npm run start:dev
cd services/notification-service && npm run start:dev
cd services/review-service && npm run start:dev

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
