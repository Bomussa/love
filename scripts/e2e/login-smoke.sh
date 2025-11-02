#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-https://mmc-mms.com}"
echo "Testing login endpoints on $BASE"
for U in \
  "$BASE/api/v1/login" \
  "$BASE/api/login" \
  "$BASE/auth/login" \
  "$BASE/login" \
  "$BASE/api/v1/signin" \
  "$BASE/signin"
do
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" "$U" || echo "000")
  echo "=> $U -> $CODE"
done
echo "Preflight:"
curl -sS -o /dev/null -w "%{http_code}\n" -X OPTIONS "$BASE/login" \
  -H "Origin: $BASE" -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
