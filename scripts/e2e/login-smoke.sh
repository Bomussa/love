#!/usr/bin/env bash
#
# Login Smoke Test Script
# 
# Purpose: Manual/local testing of login endpoints
# Tests both /api/login and /login paths with POST and OPTIONS
# Accepts 200/401/403 as valid responses, ensures OPTIONS never returns 5xx
#
# Usage:
#   ./scripts/e2e/login-smoke.sh                  # Test production
#   ./scripts/e2e/login-smoke.sh localhost:3000   # Test local dev
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Target URL (default to production)
TARGET="${1:-https://mmc-mms.com}"
echo "=========================================="
echo "Testing login endpoints on: $TARGET"
echo "=========================================="
echo ""

# Track test results
PASSED=0
FAILED=0

# Helper function to check status code
check_status() {
  local endpoint=$1
  local method=$2
  local expected=$3
  local actual=$4
  
  if [[ "$expected" == "200|401|403" ]]; then
    if [[ "$actual" == "200" ]] || [[ "$actual" == "401" ]] || [[ "$actual" == "403" ]]; then
      echo -e "${GREEN}✓${NC} $method $endpoint returned $actual (valid)"
      ((PASSED++))
      return 0
    else
      echo -e "${RED}✗${NC} $method $endpoint returned $actual (expected 200/401/403)"
      ((FAILED++))
      return 1
    fi
  elif [[ "$expected" == "non-5xx" ]]; then
    case "$actual" in
      2*|3*|4*)
        echo -e "${GREEN}✓${NC} $method $endpoint returned $actual (non-5xx)"
        ((PASSED++))
        return 0
        ;;
      5*)
        echo -e "${RED}✗${NC} $method $endpoint returned $actual (5xx error)"
        ((FAILED++))
        return 1
        ;;
      *)
        echo -e "${YELLOW}⚠${NC} $method $endpoint returned unexpected status: $actual"
        ((FAILED++))
        return 1
        ;;
    esac
  fi
}

# Test 1: POST /api/login
echo "Test 1: POST /api/login"
STATUS=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}' \
  "$TARGET/api/login")
check_status "/api/login" "POST" "200|401|403" "$STATUS"
echo ""

# Test 2: OPTIONS /api/login
echo "Test 2: OPTIONS /api/login"
STATUS=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X OPTIONS \
  -H "Origin: $TARGET" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  "$TARGET/api/login")
check_status "/api/login" "OPTIONS" "non-5xx" "$STATUS"
echo ""

# Test 3: POST /login (via rewrite)
echo "Test 3: POST /login (rewrite)"
STATUS=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}' \
  "$TARGET/login")
check_status "/login" "POST" "200|401|403" "$STATUS"
echo ""

# Test 4: OPTIONS /login
echo "Test 4: OPTIONS /login (rewrite)"
STATUS=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X OPTIONS \
  -H "Origin: $TARGET" \
  -H "Access-Control-Request-Method: POST" \
  "$TARGET/login")
check_status "/login" "OPTIONS" "non-5xx" "$STATUS"
echo ""

# Test 5: POST /signin (alias for login)
echo "Test 5: POST /signin (alias)"
STATUS=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}' \
  "$TARGET/signin")
check_status "/signin" "POST" "200|401|403" "$STATUS"
echo ""

# Test 6: OPTIONS /signin
echo "Test 6: OPTIONS /signin (alias)"
STATUS=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X OPTIONS \
  -H "Origin: $TARGET" \
  -H "Access-Control-Request-Method: POST" \
  "$TARGET/signin")
check_status "/signin" "OPTIONS" "non-5xx" "$STATUS"
echo ""

# Summary
echo "=========================================="
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC} ($PASSED/$((PASSED + FAILED)))"
  echo "=========================================="
  exit 0
else
  echo -e "${RED}Some tests failed!${NC} (Passed: $PASSED, Failed: $FAILED)"
  echo "=========================================="
  exit 1
fi
