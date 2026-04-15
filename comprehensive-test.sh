#!/bin/bash

# MMC-MMS Comprehensive Test Suite
# Tests all API endpoints with complete scenarios

BASE_URL="https://www.mmc-mms.com/api/v1"
CLINIC="lab"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   MMC-MMS Comprehensive Test Suite                       ║"
echo "║   Testing all endpoints and scenarios                    ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local url="$3"
    local data="$4"
    local expected_field="$5"
    
    echo -n "Testing: $name ... "
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -X POST "$url" -H "Content-Type: application/json" -d "$data")
    else
        response=$(curl -s "$url")
    fi
    
    # Check if expected field exists
    if echo "$response" | jq -e ".$expected_field" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "Response: $response"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo "═══════════════════════════════════════════════════════════"
echo "1. HEALTH CHECK"
echo "═══════════════════════════════════════════════════════════"

test_endpoint "Health Status" "GET" "$BASE_URL/health/status" "" "pages_fullstack"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "2. PIN MANAGEMENT"
echo "═══════════════════════════════════════════════════════════"

# Assign PIN
IDEMPOTENCY_KEY="test-$(date +%s)-$RANDOM"
PIN_RESPONSE=$(curl -s -X POST "$BASE_URL/pin/$CLINIC/assign" -H "Idempotency-Key: $IDEMPOTENCY_KEY")
PIN=$(echo "$PIN_RESPONSE" | jq -r '.pin')
SESSION_CODE=$(echo "$PIN_RESPONSE" | jq -r '.session_code')

if [ "$PIN" != "null" ] && [ "$PIN" != "" ]; then
    echo -e "Testing: PIN Assignment ... ${GREEN}✓ PASSED${NC}"
    echo "  → Assigned PIN: $PIN"
    echo "  → Session Code: $SESSION_CODE"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "Testing: PIN Assignment ... ${RED}✗ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

test_endpoint "PIN Status" "GET" "$BASE_URL/pin/$CLINIC/status" "" "clinic"

# Test Idempotency
echo -n "Testing: Idempotency (same key) ... "
DUPLICATE_RESPONSE=$(curl -s -X POST "$BASE_URL/pin/$CLINIC/assign" -H "Idempotency-Key: $IDEMPOTENCY_KEY")
DUPLICATE_PIN=$(echo "$DUPLICATE_RESPONSE" | jq -r '.pin')

if [ "$DUPLICATE_PIN" = "$PIN" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    echo "  → Same PIN returned: $DUPLICATE_PIN"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "3. QUEUE MANAGEMENT"
echo "═══════════════════════════════════════════════════════════"

# Enter Queue
QUEUE_RESPONSE=$(curl -s -X POST "$BASE_URL/queue/$CLINIC/enter" \
    -H "Content-Type: application/json" \
    -d "{\"pin\":\"$PIN\"}")

POSITION=$(echo "$QUEUE_RESPONSE" | jq -r '.position')

if [ "$POSITION" != "null" ] && [ "$POSITION" != "" ]; then
    echo -e "Testing: Queue Enter ... ${GREEN}✓ PASSED${NC}"
    echo "  → Position: $POSITION"
    echo "  → Status: $(echo "$QUEUE_RESPONSE" | jq -r '.status')"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "Testing: Queue Enter ... ${RED}✗ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

test_endpoint "Queue Status" "GET" "$BASE_URL/queue/$CLINIC/status" "" "clinic"

# Test duplicate entry
echo -n "Testing: Duplicate Entry Prevention ... "
DUPLICATE_QUEUE=$(curl -s -X POST "$BASE_URL/queue/$CLINIC/enter" \
    -H "Content-Type: application/json" \
    -d "{\"pin\":\"$PIN\"}")

if echo "$DUPLICATE_QUEUE" | grep -q "already in queue"; then
    echo -e "${GREEN}✓ PASSED${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "4. QUEUE ACTIONS"
echo "═══════════════════════════════════════════════════════════"

# Call Next
CALL_RESPONSE=$(curl -s "$BASE_URL/queue/$CLINIC/status?action=call")
CALLED_PIN=$(echo "$CALL_RESPONSE" | jq -r '.called_pin')

if [ "$CALLED_PIN" = "$PIN" ]; then
    echo -e "Testing: Queue Call ... ${GREEN}✓ PASSED${NC}"
    echo "  → Called PIN: $CALLED_PIN"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "Testing: Queue Call ... ${RED}✗ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Mark as Done
DONE_RESPONSE=$(curl -s "$BASE_URL/queue/$CLINIC/status?action=done&pin=$PIN")
WAIT_SECONDS=$(echo "$DONE_RESPONSE" | jq -r '.wait_seconds')

if [ "$WAIT_SECONDS" != "null" ]; then
    echo -e "Testing: Queue Done ... ${GREEN}✓ PASSED${NC}"
    echo "  → Wait Time: ${WAIT_SECONDS}s"
    echo "  → Total Served: $(echo "$DONE_RESPONSE" | jq -r '.total_served')"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "Testing: Queue Done ... ${RED}✗ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "5. NOTIFICATIONS"
echo "═══════════════════════════════════════════════════════════"

test_endpoint "Notify Status" "GET" "$BASE_URL/notify/status?pin=$PIN&clinic=$CLINIC" "" "success"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "6. RESET FUNCTIONALITY"
echo "═══════════════════════════════════════════════════════════"

RESET_RESPONSE=$(curl -s "$BASE_URL/pin/$CLINIC/status?action=reset")
AVAILABLE=$(echo "$RESET_RESPONSE" | jq -r '.available')

if [ "$AVAILABLE" = "20" ]; then
    echo -e "Testing: PIN Reset ... ${GREEN}✓ PASSED${NC}"
    echo "  → Available PINs: $AVAILABLE"
    echo "  → Reserve PINs: $(echo "$RESET_RESPONSE" | jq -r '.reserve')"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "Testing: PIN Reset ... ${RED}✗ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "7. MULTI-CLINIC SUPPORT"
echo "═══════════════════════════════════════════════════════════"

for clinic in "radiology" "emergency" "pharmacy"; do
    test_endpoint "$clinic Status" "GET" "$BASE_URL/pin/$clinic/status" "" "clinic"
done

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    TEST SUMMARY                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo -e "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✓ ALL TESTS PASSED - SYSTEM 100% FUNCTIONAL            ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ✗ SOME TESTS FAILED - PLEASE REVIEW                     ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi

