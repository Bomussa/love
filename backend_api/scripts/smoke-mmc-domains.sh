#!/usr/bin/env bash
set -euo pipefail

BASE="https://mmc-mms.com"
WWW="https://www.mmc-mms.com"

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

run_request() {
  local method="$1"
  local url="$2"
  local output_path="$3"
  local data="${4:-}"

  if [[ "$method" == "POST" ]]; then
    curl -sSL -o "$output_path" -w "%{http_code}" \
      -X POST "$url" \
      -H "content-type: application/json" \
      -d "$data"
  else
    curl -sSL -o "$output_path" -w "%{http_code}" "$url"
  fi
}

validate_status_code() {
  local path="$1"
  local code="$2"

  case "$path" in
    "/api/health"|"/api/v1/status")
      [[ "$code" == "200" ]] || fail "$path expected 200, got $code"
      ;;
    *)
      # Some routes are protected by edge authentication in production.
      [[ "$code" == "200" || "$code" == "401" ]] || fail "$path expected 200 or 401, got $code"
      ;;
  esac
}

echo "[INFO] Fetching homepage from both hosts..."
curl -fsSL "$BASE" -o /tmp/mmc-main.html || fail "Unable to fetch $BASE"
curl -fsSL "$WWW" -o /tmp/mmc-www.html || fail "Unable to fetch $WWW"

main_hash=$(sha256sum /tmp/mmc-main.html | awk '{print $1}')
www_hash=$(sha256sum /tmp/mmc-www.html | awk '{print $1}')

if [[ "$main_hash" != "$www_hash" ]]; then
  fail "Host mismatch: mmc-mms.com and www.mmc-mms.com return different HTML payloads"
fi

echo "[PASS] Host payload parity verified ($main_hash)"

check_endpoint_pair() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local base_url="$BASE$path"
  local www_url="$WWW$path"

  local base_code
  local www_code

  base_code=$(run_request "$method" "$base_url" /tmp/mmc-endpoint-base.json "$data") || fail "Request failed: $method $base_url"
  www_code=$(run_request "$method" "$www_url" /tmp/mmc-endpoint-www.json "$data") || fail "Request failed: $method $www_url"

  validate_status_code "$path" "$base_code"
  validate_status_code "$path" "$www_code"

  if [[ "$base_code" != "$www_code" ]]; then
    fail "$method $path returned different status codes across hosts: base=$base_code www=$www_code"
  fi

  echo "[PASS] $method $path -> base/www HTTP $base_code"
}

check_endpoint_pair GET /api/health
check_endpoint_pair GET /api/v1/status
check_endpoint_pair GET /api/v1/health
check_endpoint_pair GET '/api/v1/queue/status?clinic_id=demo'
check_endpoint_pair POST /api/v1/pin/verify '{"pin":"0000","clinic_id":"demo"}'

echo "[PASS] smoke-mmc-domains completed successfully"
