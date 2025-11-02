#!/usr/bin/env bash
# Login Smoke Test Script
# Tests login endpoints to ensure they return expected status codes
# Usage: ./scripts/e2e/login-smoke.sh [URL]
# Example: ./scripts/e2e/login-smoke.sh https://mmc-mms.com

set -e

# Configuration
TARGET_URL="${1:-https://mmc-mms.com}"
TEST_EMAIL="${TEST_EMAIL:-test@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-testpassword123}"

echo "=========================================="
echo "Login Smoke Test"
echo "Target: $TARGET_URL"
echo "=========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to check status code
check_status() {
  local endpoint="$1"
  local method="$2"
  local expected_pattern="$3"
  local description="$4"
  local extra_args="${5:-}"
  
  echo "Testing: $description"
  echo "  Endpoint: $method $endpoint"
  
  # Make request and capture status code
  if [ "$method" = "POST" ]; then
    STATUS=$(curl -sS -o /dev/null -w "%{http_code}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
      $extra_args \
      "$TARGET_URL$endpoint")
  else
    STATUS=$(curl -sS -o /dev/null -w "%{http_code}" \
      -X "$method" \
      $extra_args \
      "$TARGET_URL$endpoint")
  fi
  
  # Check if status matches expected pattern
  if [[ "$STATUS" =~ $expected_pattern ]]; then
    echo -e "  ${GREEN}✓ PASS${NC}: Got status $STATUS"
    ((TESTS_PASSED++))
    return 0
  else
    echo -e "  ${RED}✗ FAIL${NC}: Got status $STATUS, expected pattern: $expected_pattern"
    ((TESTS_FAILED++))
    return 1
  fi
}

# Test 1: POST /api/login - should return 200/401/403 (not 404/5xx)
echo "Test 1: POST /api/login endpoint"
check_status "/api/login" "POST" "^(200|401|403)$" "POST request to /api/login" || true
echo ""

# Test 2: OPTIONS /api/login - should return non-5xx
echo "Test 2: OPTIONS /api/login preflight"
check_status "/api/login" "OPTIONS" "^[234][0-9][0-9]$" "OPTIONS preflight for /api/login" \
  "-H 'Origin: $TARGET_URL' -H 'Access-Control-Request-Method: POST'" || true
echo ""

# Test 3: POST /login - should return 200/401/403 (not 404/5xx)
echo "Test 3: POST /login endpoint (rewrite)"
check_status "/login" "POST" "^(200|401|403)$" "POST request to /login" || true
echo ""

# Test 4: OPTIONS /login - should return non-5xx
echo "Test 4: OPTIONS /login preflight"
check_status "/login" "OPTIONS" "^[234][0-9][0-9]$" "OPTIONS preflight for /login" \
  "-H 'Origin: $TARGET_URL' -H 'Access-Control-Request-Method: POST'" || true
echo ""

# Test 5: POST /signin - should return 200/401/403 (not 404/5xx)
echo "Test 5: POST /signin endpoint (rewrite)"
check_status "/signin" "POST" "^(200|401|403)$" "POST request to /signin" || true
echo ""

# Test 6: OPTIONS /signin - should return non-5xx
echo "Test 6: OPTIONS /signin preflight"
check_status "/signin" "OPTIONS" "^[234][0-9][0-9]$" "OPTIONS preflight for /signin" \
  "-H 'Origin: $TARGET_URL' -H 'Access-Control-Request-Method: POST'" || true
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo "=========================================="

# Exit with failure if any tests failed
if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "${RED}❌ Some tests failed${NC}"
  exit 1
else
  echo -e "${GREEN}✓ All tests passed successfully${NC}"
  exit 0
fi
