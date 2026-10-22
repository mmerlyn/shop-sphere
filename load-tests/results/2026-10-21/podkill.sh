#!/bin/bash
# Usage: podkill.sh <label> <runbook|crash1|rollout|graceful1>. Search load at 300 req/s
# for 40s; at second 10, disrupt catalog-svc. runbook deletes ALL running catalog pods
# (the RUNBOOK selector), crash1 force-deletes one pod, rollout runs a rolling restart,
# graceful1 deletes one pod with normal shutdown. Output goes to $OUT_DIR (default $TMPDIR or /tmp).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."   # load-tests/
OUT_DIR="${OUT_DIR:-${TMPDIR:-/tmp}}"
OUT="$OUT_DIR/podkill_$1.json"
( sleep 10
  case "$2" in
    runbook) kubectl delete pod -n shopsphere -l app=catalog-svc --field-selector status.phase=Running --force >/dev/null 2>&1 ;;
    crash1)  P=$(kubectl get pods -n shopsphere -l app=catalog-svc --field-selector status.phase=Running -o name | head -1)
             kubectl delete -n shopsphere $P --force --grace-period=0 >/dev/null 2>&1 ;;
    rollout) kubectl rollout restart deploy/catalog-svc -n shopsphere >/dev/null 2>&1 ;;
    graceful1) P=$(kubectl get pods -n shopsphere -l app=catalog-svc --field-selector status.phase=Running -o name | head -1)
             kubectl delete -n shopsphere $P --wait=false >/dev/null 2>&1 ;;
  esac
  echo "   [deleted catalog pods: $2]" ) &
k6 run -q --summary-export "$OUT" -e BASE_URL=http://localhost:8080 -e RATE=300 -e DURATION=40s scenarios/search-1m.js > "$OUT_DIR/podkill_$1.log" 2>&1
wait
python3 - "$OUT" "$1" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))["metrics"]
f = m["http_req_failed"]; r = m["http_reqs"]; d = m["http_req_duration"]
total = int(r["count"]); failed = round(f.get("value", f.get("rate", 0)) * total)
print(f"{sys.argv[2]}: {total - failed:,} of {total:,} OK, {failed} failed, p95 {d['p(95)']:.1f}ms, max {d['max']:.0f}ms")
PY
kubectl rollout status deploy/catalog-svc -n shopsphere --timeout=120s >/dev/null && echo "   catalog back: $(kubectl get pods -n shopsphere -l app=catalog-svc --no-headers | grep -c Running) pods running"
