# ShopSphere on Kubernetes — Runbook

Reproducible steps to stand up the 8-service platform on a local **kind**
cluster, seed 1M products, and run the k6 load tests that back the resume
numbers. Every claim below maps to an artifact in this repo.

## Topology (8 microservices, database-per-service)

| Service (k8s name) | Port | Owns / store | Notes |
|---|---|---|---|
| `gateway` | 8000 | — | JWT check, rate limit, routes by DNS name |
| `user-svc` | 3001 | PostgreSQL `users` | auth (JWT issue/rotate) + profiles |
| `catalog-svc` | 3002 | PostgreSQL `catalog` + Elasticsearch | product-service image; CQRS read model in ES; **HPA 2→6** |
| `cart-svc` | 3003 | Redis (TTL) | ephemeral guest carts |
| `order-svc` | 3004 | PostgreSQL `orders` | checkout orchestration; **HPA 2→6** |
| `inventory-svc` | 3008 | PostgreSQL `inventory` | stock owner; atomic decrement/restock |
| `notification-svc` | 3005 | — | order-confirmation email (mocked) |
| `review-svc` | 3007 | PostgreSQL `reviews` | product reviews |

Service discovery is **k8s DNS** (`http://catalog-svc:3002`, etc.) configured in
[k8s/services/00-config.yaml](services/00-config.yaml) — no hardcoded IPs.
(Payment was deliberately cut from the active topology.)

## Prerequisites

- Docker, `kind`, `kubectl`, `k6`, Node 18+.

## 1. Cluster + cluster add-ons

```bash
kind create cluster --config k8s/cluster/kind-config.yaml
# ingress-nginx (kind variant)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.2/deploy/static/provider/kind/deploy.yaml
# metrics-server (required for HPA) + kind insecure-kubelet patch
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch deployment metrics-server -n kube-system --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
```

## 2. Build images + deploy

```bash
bash k8s/build-images.sh                 # builds 8 images, loads into kind
kubectl apply -f k8s/infra/              # namespace, 5x Postgres, Redis, Elasticsearch
kubectl apply -f k8s/services/           # config, 8 deployments+services, HPA
kubectl apply -f k8s/ingress/            # Nginx ingress -> gateway
kubectl get pods -n shopsphere -w        # wait until all Ready
```

The cluster maps container `:80` to host `:8080`, so the API is at
`http://localhost:8080/api/...`.

## 3. Seed 1M products (PostgreSQL + Elasticsearch + Inventory)

```bash
N=1000000 bash data/seed/run-seed.sh
```

Seeds catalog Postgres (source of truth) and inventory Postgres via server-side
`generate_series`, then bulk-indexes the same 1M docs into the Elasticsearch
`products` index (the CQRS read model). IDs are deterministic (`prod-<n>`).

## 4. Load tests (k6)

```bash
bash load-tests/run-k6.sh                # search-1m + checkout-flow, saves JSON+logs
```

- `search-1m.js` — ES search latency, threshold **p95 < 50ms**.
- `checkout-flow.js` — full cart→order→inventory at **500 rps**, threshold **p95 < 200ms**.

## 5. HPA scaling demo (2 → 6)

```bash
kubectl get hpa -n shopsphere -w         # watch in one terminal
bash load-tests/run-k6.sh                # drive load in another
# observe catalog-svc / order-svc replicas climb from 2 toward 6
```

## 6. Pod-kill resilience demo

```bash
# during a load run, delete a catalog pod; traffic keeps flowing as k8s reschedules
kubectl delete pod -n shopsphere -l app=catalog-svc --field-selector status.phase=Running --force
kubectl get pods -n shopsphere -w
```

## Resume bullet → artifact map

| Resume claim | Backed by |
|---|---|
| 8 microservices on Kubernetes, db-per-service, DNS discovery | `k8s/services/*`, `k8s/infra/*`, `00-config.yaml` |
| REST checkout: catalog, cart, orders, inventory + JWT | `services/order-service` ↔ `inventory-service`; gateway `JwtAuthGuard` |
| HPA 2→6 + liveness/readiness probes behind Nginx ingress | `09-hpa.yaml`, probes in each deployment, `ingress/ingress.yaml` |
| Pod-kill, traffic survives | step 6 above |
| ES search + Redis cart TTL over per-service PostgreSQL | `catalog-svc` (ES), `cart-svc` (Redis), 5× Postgres |
| k6 checkout 500+ rps @ <200ms p95 | `load-tests/scenarios/checkout-flow.js` |
| CQRS PG→ES, search <50ms p95 over 1M products | `data/seed/*`, `load-tests/scenarios/search-1m.js` |

## Measured results

Measured on a local 4-node kind cluster (8-vCPU Docker VM, Apple Silicon),
2026-06-18. Raw output in `load-tests/results/k8s_final/` and
`load-tests/results/hpa-watch.log`.

| Metric | Target | Measured | Pass |
|---|---|---|---|
| Catalog rows seeded (PostgreSQL) | ≥ 1,000,000 | **1,000,000** | ✅ |
| Inventory rows seeded (PostgreSQL) | ≥ 1,000,000 | **1,000,000** | ✅ |
| Elasticsearch docs indexed | ≥ 1,000,000 | **1,000,000** | ✅ |
| Search p95 latency @ 800 req/s over 1M docs | < 50 ms | **49.6 ms** (p90 20.9, median 1.5) | ✅ |
| Search errors | ~0 | **0 / 36,001** | ✅ |
| HPA scale range (catalog) under load | 2 → 6 | **2 → 4 → 6** (CPU 175%) | ✅ |
| Pod-kill resilience (force-delete catalog pod mid-load) | traffic survives | **11,870 / 11,871 ok (99.99%)**, pod rescheduled | ✅ |
| Checkout throughput, stable | — | **~240 req/s** (80 checkouts/s) | — |
| Checkout p95 latency @ 240 req/s | < 200 ms | **87 ms** (median 9.9), 100% success | ✅ |
| Checkout @ 500 req/s | < 200 ms p95 | **not sustained** on this hardware — write path (Postgres) saturates ~90 checkouts/s, then latency death-spirals | ❌ |

**Honest note on the 500 req/s checkout target:** the read-heavy search path
scales past 800–1000 req/s under 50 ms because it is served by Elasticsearch.
The write-heavy checkout path (cart → order → inventory, with a Postgres
transaction per order) tops out near ~240 req/s on a single 8-vCPU laptop VM;
above ~90 checkouts/s the open-loop arrival rate overwhelms Postgres write
throughput and latency collapses. On real multi-node hardware this ceiling is
far higher, but **the number on the résumé must reflect what this k6 run
actually produced: ~240 req/s at 87 ms p95, not 500 req/s.**
