#!/usr/bin/env bash
# Run the two resume-backing k6 scenarios against the cluster (via Nginx ingress)
# and save JSON + text summaries under load-tests/results/<timestamp>/.
# Threshold failures are tolerated so BOTH scenarios always run and record.
set -uo pipefail
cd "$(dirname "$0")"

BASE_URL="${BASE_URL:-http://localhost:8080}"
STAMP="${STAMP:-$(date +%Y%m%d_%H%M%S)}"
OUT="results/${STAMP}"
mkdir -p "$OUT"

echo ">> Results -> $OUT  (BASE_URL=$BASE_URL)"

echo ">> [1/2] search-1m (Elasticsearch search latency)"
k6 run --summary-export "$OUT/search-1m.summary.json" \
  -e BASE_URL="$BASE_URL" -e RATE="${SEARCH_RATE:-300}" -e DURATION="${SEARCH_DURATION:-1m}" \
  scenarios/search-1m.js 2>&1 | tee "$OUT/search-1m.log" || true

echo ">> [2/2] checkout-flow (end-to-end checkout)"
k6 run --summary-export "$OUT/checkout-flow.summary.json" \
  -e BASE_URL="$BASE_URL" -e RATE="${RATE:-500}" -e DURATION="${DURATION:-2m}" \
  scenarios/checkout-flow.js 2>&1 | tee "$OUT/checkout-flow.log" || true

echo ">> Done. Summaries in $OUT"
