#!/bin/bash

# ShopSphere Load Test Runner
# Requires k6 to be installed: https://k6.io/docs/getting-started/installation/

set -e

BASE_URL="${BASE_URL:-http://localhost:80}"
RESULTS_DIR="./load-tests/results/$(date +%Y%m%d_%H%M%S)"

echo "========================================="
echo "ShopSphere Load Test Suite"
echo "Target: $BASE_URL"
echo "Results: $RESULTS_DIR"
echo "========================================="

mkdir -p "$RESULTS_DIR"

echo ""
echo "[1/4] Product Browse Scenario"
echo "  Testing: Product listing, search, detail views"
echo "  Thresholds: p95 < 100ms, search p95 < 50ms"
k6 run \
  --env BASE_URL="$BASE_URL" \
  --out json="$RESULTS_DIR/product-browse.json" \
  --summary-export="$RESULTS_DIR/product-browse-summary.json" \
  ./load-tests/scenarios/product-browse.js 2>&1 | tee "$RESULTS_DIR/product-browse.log"

echo ""
echo "[2/4] Order Flow Scenario"
echo "  Testing: Full transaction flow at 2000 iterations/sec"
echo "  Thresholds: p95 < 100ms, success rate > 95%"
k6 run \
  --env BASE_URL="$BASE_URL" \
  --out json="$RESULTS_DIR/order-flow.json" \
  --summary-export="$RESULTS_DIR/order-flow-summary.json" \
  ./load-tests/scenarios/order-flow.js 2>&1 | tee "$RESULTS_DIR/order-flow.log"

echo ""
echo "[3/4] CRUD Operations Scenario"
echo "  Testing: CRUD operations with <80ms threshold"
echo "  Thresholds: crud p95 < 80ms, read p95 < 50ms"
k6 run \
  --env BASE_URL="$BASE_URL" \
  --out json="$RESULTS_DIR/crud-operations.json" \
  --summary-export="$RESULTS_DIR/crud-operations-summary.json" \
  ./load-tests/scenarios/crud-operations.js 2>&1 | tee "$RESULTS_DIR/crud-operations.log"

echo ""
echo "[4/4] Search Benchmark Scenario"
echo "  Testing: Elasticsearch search with <50ms threshold"
echo "  Thresholds: search p95 < 50ms, avg < 30ms"
k6 run \
  --env BASE_URL="$BASE_URL" \
  --out json="$RESULTS_DIR/search-benchmark.json" \
  --summary-export="$RESULTS_DIR/search-benchmark-summary.json" \
  ./load-tests/scenarios/search-benchmark.js 2>&1 | tee "$RESULTS_DIR/search-benchmark.log"

echo ""
echo "========================================="
echo "All tests completed!"
echo "Results saved to: $RESULTS_DIR"
echo "========================================="
echo ""
echo "Summary:"
echo "  Product Browse: cat $RESULTS_DIR/product-browse.log"
echo "  Order Flow:     cat $RESULTS_DIR/order-flow.log"
echo "  CRUD Ops:       cat $RESULTS_DIR/crud-operations.log"
echo "  Search:         cat $RESULTS_DIR/search-benchmark.log"
