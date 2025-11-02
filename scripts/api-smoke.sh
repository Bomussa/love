#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-https://mmc-mms.com/api/v1}"
echo "[smoke] GET $BASE/healthz"
code=$(curl -s -o /tmp/out.txt -w "%{http_code}" "$BASE/healthz" || true)
echo "HTTP $code"; echo "---"; cat /tmp/out.txt
