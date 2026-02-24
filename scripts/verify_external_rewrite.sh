#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${1:-https://mmc-mms.com}"
OUT="integration_results.log"
TS() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

log() { echo "[$(TS)] $*" | tee -a "$OUT"; }

: > "$OUT"
log "Verifying External Rewrite on $BASE_URL"
log "1) GET /api/api-v1-status (no Origin)"
{
  time_total=$(curl -sw "time_total=%{time_total}\n" -o /tmp/resp1 -D /tmp/h1 "$BASE_URL/api/api-v1-status" || true)
  status=$(grep -m1 -oE "HTTP/[0-9.]+ [0-9]+" /tmp/h1 | awk '{print $2}')
  origin=$(grep -i "access-control-allow-origin" /tmp/h1 | awk -F": " '{print $2}')
  log "status=$status $time_total"
  log "access-control-allow-origin=${origin:-<none>}"
  log "body=$(head -c 200 /tmp/resp1)"
}

log "2) GET /api/api-v1-status with Origin: $BASE_URL"
{
  time_total=$(curl -sw "time_total=%{time_total}\n" -H "Origin: $BASE_URL" -o /tmp/resp2 -D /tmp/h2 "$BASE_URL/api/api-v1-status" || true)
  status=$(grep -m1 -oE "HTTP/[0-9.]+ [0-9]+" /tmp/h2 | awk '{print $2}')
  origin=$(grep -i "access-control-allow-origin" /tmp/h2 | awk -F": " '{print $2}')
  log "status=$status $time_total"
  log "access-control-allow-origin=${origin:-<none>}"
  log "body=$(head -c 200 /tmp/resp2)"
}

log "3) Summary"
log "Expected: HTTP 200 JSON from Supabase Edge Function."
log "If status is 404 with 'Endpoint not found', the request still hits Vercel local API — redeploy with rewrites + .vercelignore + Root Directory=frontend/."
