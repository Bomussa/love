#!/bin/bash

echo "========================================="
echo "  Vercel Deployment Readiness Check"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Check 1: index.html exists
echo -n "✓ Checking index.html... "
if [ -f "index.html" ]; then
    echo -e "${GREEN}FOUND${NC}"
else
    echo -e "${RED}MISSING${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check 2: vercel.json exists
echo -n "✓ Checking vercel.json... "
if [ -f "vercel.json" ]; then
    echo -e "${GREEN}FOUND${NC}"
else
    echo -e "${RED}MISSING${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check 3: package.json exists and has build script
echo -n "✓ Checking package.json build script... "
if [ -f "package.json" ] && grep -q '"build"' package.json; then
    echo -e "${GREEN}FOUND${NC}"
else
    echo -e "${RED}MISSING${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check 4: Build test
echo -n "✓ Testing build command... "
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}SUCCESS${NC}"
else
    echo -e "${RED}FAILED${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check 5: dist/index.html created
echo -n "✓ Checking dist/index.html... "
if [ -f "dist/index.html" ]; then
    echo -e "${GREEN}FOUND${NC}"
else
    echo -e "${RED}MISSING${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check 6: vercel.json routes
echo -n "✓ Checking vercel.json routes... "
if grep -q '"routes"' vercel.json && grep -q '/api/v1/' vercel.json; then
    echo -e "${GREEN}CONFIGURED${NC}"
else
    echo -e "${YELLOW}WARNING${NC}"
fi

echo ""
echo "========================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ ALL CHECKS PASSED - READY FOR DEPLOYMENT${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Push to GitHub: git push origin main"
    echo "2. Go to Vercel Dashboard"
    echo "3. Redeploy the 'love' project"
    echo "4. Verify deployment at your domain"
else
    echo -e "${RED}✗ $ERRORS ERROR(S) FOUND - FIX BEFORE DEPLOYMENT${NC}"
fi
echo "========================================="
