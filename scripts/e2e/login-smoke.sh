#!/usr/bin/env bash
#
# Login Smoke Test Script
# Tests login endpoints to ensure they work reliably
#
set -euo pipefail

# Configuration
PRODUCTION_URL="${PRODUCTION_URL:-https://mmc-mms.com}"
VERBOSE="${VERBOSE:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
  echo -e "${GREEN}✓${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test function wrapper
run_test() {
  local test_name="$1"
  local test_func="$2"
  
  if $VERBOSE; then
    echo "Running: $test_name"
  fi
  
  if $test_func; then
    log_info "$test_name"
    ((TESTS_PASSED++))
    return 0
  else
    log_error "$test_name"
    ((TESTS_FAILED++))
    return 1
  fi
}

# Test /api/login POST endpoint
test_api_login_post() {
  local status
  status=$(curl -sS -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test"}' \
    "$PRODUCTION_URL/api/login")
  
  # Accept 200 (success), 401 (auth required), or 403 (forbidden) as valid
  if [[ "$status" == "200" ]] || [[ "$status" == "401" ]] || [[ "$status" == "403" ]]; then
    return 0
  else
    echo "Expected 200/401/403, got $status" >&2
    return 1
  fi
}

# Test /api/login OPTIONS preflight
test_api_login_options() {
  local status
  status=$(curl -sS -o /dev/null -w "%{http_code}" \
    -X OPTIONS \
    "$PRODUCTION_URL/api/login" \
    -H "Origin: $PRODUCTION_URL" \
    -H 'Access-Control-Request-Method: POST' \
    -H 'Access-Control-Request-Headers: Content-Type')
  
  # Should not return 5xx (server errors)
  if [[ "$status" =~ ^[2-4] ]]; then
    return 0
  else
    echo "Got 5xx error: $status" >&2
    return 1
  fi
}

# Test /login POST endpoint (rewrite)
test_login_post() {
  local status
  status=$(curl -sS -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test"}' \
    "$PRODUCTION_URL/login")
  
  # Accept 200 (success), 401 (auth required), or 403 (forbidden) as valid
  if [[ "$status" == "200" ]] || [[ "$status" == "401" ]] || [[ "$status" == "403" ]]; then
    return 0
  else
    echo "Expected 200/401/403, got $status" >&2
    return 1
  fi
}

# Test /login OPTIONS preflight
test_login_options() {
  local status
  status=$(curl -sS -o /dev/null -w "%{http_code}" \
    -X OPTIONS \
    "$PRODUCTION_URL/login" \
    -H "Origin: $PRODUCTION_URL" \
    -H 'Access-Control-Request-Method: POST')
  
  # Should not return 5xx (server errors)
  if [[ "$status" =~ ^[2-4] ]]; then
    return 0
  else
    echo "Got 5xx error: $status" >&2
    return 1
  fi
}

# Test /signin POST endpoint (alias)
test_signin_post() {
  local status
  status=$(curl -sS -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test"}' \
    "$PRODUCTION_URL/signin")
  
  # Accept 200 (success), 401 (auth required), or 403 (forbidden) as valid
  if [[ "$status" == "200" ]] || [[ "$status" == "401" ]] || [[ "$status" == "403" ]]; then
    return 0
  else
    echo "Expected 200/401/403, got $status" >&2
    return 1
  fi
}

# Main execution
main() {
  echo "=========================================="
  echo "Login Smoke Tests"
  echo "Target: $PRODUCTION_URL"
  echo "=========================================="
  echo ""
  
  run_test "POST /api/login responds with valid status" test_api_login_post
  run_test "OPTIONS /api/login preflight works" test_api_login_options
  run_test "POST /login responds with valid status" test_login_post
  run_test "OPTIONS /login preflight works" test_login_options
  run_test "POST /signin responds with valid status" test_signin_post
  
  echo ""
  echo "=========================================="
  echo "Results: $TESTS_PASSED passed, $TESTS_FAILED failed"
  echo "=========================================="
  
  if [ $TESTS_FAILED -eq 0 ]; then
    exit 0
  else
    exit 1
  fi
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
