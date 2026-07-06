#!/usr/bin/env bash
# Seed Catalog Postgres + Inventory Postgres + Elasticsearch with N products.
# Usage: N=1000000 bash data/seed/run-seed.sh   (default N=1000000)
set -euo pipefail
cd "$(dirname "$0")"

NS=shopsphere
N="${N:-1000000}"
echo ">> Seeding $N products"

echo ">> [1/3] Catalog Postgres..."
kubectl exec -i -n "$NS" deploy/postgres-catalog -- \
  psql -U shopsphere -d catalog -v n="$N" < seed-catalog.sql

echo ">> [2/3] Inventory Postgres..."
kubectl exec -i -n "$NS" deploy/postgres-inventory -- \
  psql -U shopsphere -d inventory -v n="$N" < seed-inventory.sql

echo ">> [3/3] Elasticsearch..."
# Port-forward ES, index, then tear the forward down.
kubectl port-forward -n "$NS" svc/elasticsearch 9200:9200 >/tmp/es-pf.log 2>&1 &
PF_PID=$!
trap 'kill $PF_PID 2>/dev/null || true' EXIT
# wait for the forward to be ready
for i in $(seq 1 30); do
  if curl -s http://localhost:9200 >/dev/null 2>&1; then break; fi
  sleep 1
done
ES_URL=http://localhost:9200 node index-elasticsearch.mjs "$N"

echo ">> Seed complete."
