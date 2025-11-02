#!/usr/bin/env bash
#
# Login Smoke Test - Local/Manual Testing
# 
# Tests login endpoints to ensure they work reliably
# Accepts 200/401/403 as valid responses (not 404 or 5xx)
# OPTIONS requests should never return 5xx
#
# Usage:
#   ./scripts/e2e/login-smoke.sh [BASE_URL]
#
# Examples:
#   ./scripts/e2e/login-smoke.sh https://mmc-mms.com
#   ./scripts/e2e/login-smoke.sh http://localhost:3000
#

set -e

# Default to production if no URL provided
BASE_URL="${1:-https://mmc-mms.com}"

echo "=========================================="
echo "Login Smoke Test"
echo "Target: $BASE_URL"
echo "=========================================="
echo ""

# Test 1: POST /api/login
echo "Test 1: POST /api/login"
API_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}' \
  "$BASE_URL/api/login")

if [ "$API_STATUS" != "200" ] && [ "$API_STATUS" != "401" ] && [ "$API_STATUS" != "403" ]; then
  echo "  ❌ Expected 200/401/403, got $API_STATUS"
  exit 1
fi
echo "  ✓ Status: $API_STATUS"
echo ""

# Test 2: OPTIONS /api/login
echo "Test 2: OPTIONS /api/login"
OPT_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X OPTIONS \
  "$BASE_URL/api/login" \
  -H "Origin: $BASE_URL" \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: Content-Type')

case "$OPT_STATUS" in
  2*|3*|4*) 
    echo "  ✓ Status: $OPT_STATUS (non-5xx)"
    ;;
  5*)
    echo "  ❌ 5xx error: $OPT_STATUS"
    exit 1
    ;;
  *)
    echo "  ⚠️  Unexpected status: $OPT_STATUS"
    exit 1
    ;;
esac
echo ""

# Test 3: POST /login (rewrite)
echo "Test 3: POST /login (rewrite)"
LOGIN_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}' \
  "$BASE_URL/login")

if [ "$LOGIN_STATUS" != "200" ] && [ "$LOGIN_STATUS" != "401" ] && [ "$LOGIN_STATUS" != "403" ]; then
  echo "  ❌ Expected 200/401/403, got $LOGIN_STATUS"
  exit 1
fi
echo "  ✓ Status: $LOGIN_STATUS"
echo ""

# Test 4: OPTIONS /login
echo "Test 4: OPTIONS /login"
OPT_LOGIN=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X OPTIONS \
  "$BASE_URL/login" \
  -H "Origin: $BASE_URL" \
  -H 'Access-Control-Request-Method: POST')

case "$OPT_LOGIN" in
  2*|3*|4*) 
    echo "  ✓ Status: $OPT_LOGIN (non-5xx)"
    ;;
  5*)
    echo "  ❌ 5xx error: $OPT_LOGIN"
    exit 1
    ;;
  *)
    echo "  ⚠️  Unexpected status: $OPT_LOGIN"
    exit 1
    ;;
esac
echo ""

# Test 5: POST /api/signin (should map to login)
echo "Test 5: POST /api/signin"
SIGNIN_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}' \
  "$BASE_URL/api/signin")

if [ "$SIGNIN_STATUS" != "200" ] && [ "$SIGNIN_STATUS" != "401" ] && [ "$SIGNIN_STATUS" != "403" ]; then
  echo "  ❌ Expected 200/401/403, got $SIGNIN_STATUS"
  exit 1
fi
echo "  ✓ Status: $SIGNIN_STATUS"
echo ""

# Test 6: OPTIONS /api/signin
echo "Test 6: OPTIONS /api/signin"
OPT_SIGNIN=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X OPTIONS \
  "$BASE_URL/api/signin" \
  -H "Origin: $BASE_URL" \
  -H 'Access-Control-Request-Method: POST')

case "$OPT_SIGNIN" in
  2*|3*|4*) 
    echo "  ✓ Status: $OPT_SIGNIN (non-5xx)"
    ;;
  5*)
    echo "  ❌ 5xx error: $OPT_SIGNIN"
    exit 1
    ;;
  *)
    echo "  ⚠️  Unexpected status: $OPT_SIGNIN"
    exit 1
    ;;
esac
echo ""

echo "=========================================="
echo "✅ All login smoke tests passed!"
echo "  - POST /api/login: $API_STATUS"
echo "  - OPTIONS /api/login: $OPT_STATUS"
echo "  - POST /login: $LOGIN_STATUS"
echo "  - OPTIONS /login: $OPT_LOGIN"
echo "  - POST /api/signin: $SIGNIN_STATUS"
echo "  - OPTIONS /api/signin: $OPT_SIGNIN"
echo "=========================================="
