# Load and resilience runs, 2026-10-21

All runs on the local kind cluster (4 nodes on one 8-core laptop VM), via the Nginx ingress
at http://localhost:8080. Search load = `scenarios/search-1m.js` at 300 req/s for 40s;
the disruption happens at second 10 (`podkill.sh`).

About the files: the repo ignores `*.log`, so the raw k6 console logs (`*.log`) stay on the
author's machine. The `*.summary.json` files (k6 `--summary-export`) are in the repo. The key
numbers from each log are copied into the tables below.

## Resilience (search at 300 req/s)

| Test | What was done at second 10 | Result | Files |
|---|---|---|---|
| One pod crashes | one catalog pod deleted with `--force --grace-period=0` | **12,001 / 12,001 OK**, 0 failed, p95 5.1ms | `pod-crash-one.*` |
| Rolling restart | `kubectl rollout restart deploy/catalog-svc` | **12,000 / 12,000 OK**, 0 failed, p95 7.5ms | `rolling-restart.*` |
| RUNBOOK step 6 | ALL running catalog pods deleted with `--force` (the RUNBOOK selector matches every pod) | 10,502 / 10,662 OK, 160 failed, p95 5.5s | `runbook-delete-all-catalog-pods.*` |
| All pods, no grace | ALL catalog pods deleted with `--force --grace-period=0` (full outage) | 4,641 / 6,741 OK, 2,100 failed | `delete-all-catalog-pods-grace0.*` |

Note: the June `k8s_final/podkill-search.log` result (11,870 / 11,871) used the RUNBOOK
command, which deletes all catalog pods; it did not reproduce today. Quote the one-pod crash
and rolling-restart results instead.

## Redis reconnect bug (cart service)

- Symptom after a cluster restart: every `POST /api/cart` returned 500
  ("Connection is closed", `getaddrinfo EAI_AGAIN redis`) while `/api/health` said ok.
- Cause: the ioredis `retryStrategy` returned `null` after 3 tries in api-gateway, cart,
  product and user services, so a pod that started before Redis resolved never reconnected.
- Fix: retry forever with backoff capped at 5s; cart readiness probe `/api/health/ready`
  fails while Redis is down (liveness stays independent of Redis).
- Proof: Redis pod deleted at 22:31:40; `POST /api/cart` returned 200 again by 22:31:51
  and stayed 200; all 3 cart pods kept restart count 0 (no manual restart).

## Checkout capacity (`scenarios/checkout-flow.js`, 1 checkout = 3 requests)

| Run | Result |
|---|---|
| Warm, 120 checkouts/s for 45s (pods already scaled: cart 8, order 6) | 5,400 / 5,401 OK (99.98%), ~358 req/s, order p95 128ms (console summary; raw file not kept) |
| Warm, 160 checkouts/s | 100% OK, order p95 1.11s (console summary) |
| Warm, 200 checkouts/s | 91.89% OK, order p95 10.79s (console summary) |
| Cold spike from idle, 120/s for 60s | 7,169 / 7,172 checkouts OK (99.95%), ~356 req/s, order p95 1.24s, 29 dropped iterations (`checkout-cold-spike-120.log`, local only) |
| Same spike with faster HPA scale-up | WORSE: 6,780 / 6,853 checkouts OK (98.93%), ~331 req/s, order p95 5.2s, 348 dropped iterations; change reverted (`checkout-cold-spike-120-fast-hpa-REVERTED.log`, local only) |

Profiling notes: Postgres (orders, inventory) had 1-2 active queries under load (not the
bottleneck); no pod was CPU-throttled (<1% of periods). Faster scale-up hurt because new
pods start on the same 8-core VM and take CPU from the pods serving checkouts.
