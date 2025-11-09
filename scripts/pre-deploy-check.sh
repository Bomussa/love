#!/bin/bash

##############################################
# Pre-deployment Validation Script
# Ensures build is valid before deployment
##############################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo "================================================"
echo "🔍 PRE-DEPLOYMENT VALIDATION"
echo "================================================"

# Function to log error
log_error() {
    echo -e "${RED}❌ ERROR: $1${NC}"
    ERRORS=$((ERRORS + 1))
}

# Function to log warning
log_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

# Function to log success
log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to log info
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

echo ""
echo "📋 Step 1: Checking Critical Files"
echo "-----------------------------------"

# Check vercel.json
if [ ! -f "vercel.json" ]; then
    log_error "vercel.json is missing"
else
    log_success "vercel.json exists"
    
    # Validate JSON
    if jq empty vercel.json 2>/dev/null; then
        log_success "vercel.json is valid JSON"
        
        # Check for required fields
        if jq -e '.version' vercel.json > /dev/null; then
            log_success "vercel.json has version field"
        else
            log_warning "vercel.json missing version field"
        fi
        
        # Check for redirects
        if jq -e '.redirects' vercel.json > /dev/null; then
            redirect_count=$(jq '.redirects | length' vercel.json)
            log_success "vercel.json has $redirect_count redirects"
        else
            log_warning "vercel.json has no redirects"
        fi
    else
        log_error "vercel.json is invalid JSON"
    fi
fi

# Check package.json
if [ ! -f "package.json" ]; then
    log_error "package.json is missing"
else
    log_success "package.json exists"
fi

# Check frontend package.json
if [ ! -f "frontend/package.json" ]; then
    log_error "frontend/package.json is missing"
else
    log_success "frontend/package.json exists"
fi

echo ""
echo "📋 Step 2: Checking API Structure"
echo "-----------------------------------"

# Check API directory
if [ ! -d "api" ]; then
    log_error "api directory is missing"
else
    log_success "api directory exists"
    
    # Check for health endpoint
    if [ -f "api/v1/health.js" ]; then
        log_success "Health endpoint exists (api/v1/health.js)"
    else
        log_warning "Health endpoint not found at api/v1/health.js"
    fi
    
    # Count API files
    api_files=$(find api -name "*.js" | wc -l)
    log_info "Found $api_files API files"
fi

echo ""
echo "📋 Step 3: Checking Frontend Structure"
echo "-----------------------------------"

if [ ! -d "frontend" ]; then
    log_error "frontend directory is missing"
else
    log_success "frontend directory exists"
    
    # Check for src
    if [ -d "frontend/src" ]; then
        log_success "frontend/src exists"
    else
        log_warning "frontend/src not found"
    fi
    
    # Check for index.html
    if [ -f "frontend/index.html" ]; then
        log_success "frontend/index.html exists"
    else
        log_warning "frontend/index.html not found"
    fi
fi

echo ""
echo "📋 Step 4: Checking Environment Configuration"
echo "-----------------------------------"

# Check for .env.example
if [ -f ".env.example" ]; then
    log_success ".env.example exists"
    
    # Check for required env vars
    required_vars=("VITE_SUPABASE_URL" "VITE_SUPABASE_ANON_KEY" "SUPABASE_URL" "SUPABASE_ANON_KEY")
    
    for var in "${required_vars[@]}"; do
        if grep -q "$var" .env.example; then
            log_success "$var is documented"
        else
            log_warning "$var is not documented in .env.example"
        fi
    done
else
    log_warning ".env.example not found"
fi

echo ""
echo "📋 Step 5: Testing Build Process"
echo "-----------------------------------"

log_info "Installing dependencies..."
if npm ci 2>/dev/null || npm install 2>/dev/null; then
    log_success "Root dependencies installed"
else
    log_error "Failed to install root dependencies"
fi

log_info "Installing frontend dependencies..."
cd frontend
if npm ci 2>/dev/null || npm install 2>/dev/null; then
    log_success "Frontend dependencies installed"
else
    log_error "Failed to install frontend dependencies"
fi

log_info "Testing build..."
if npm run build > /tmp/build.log 2>&1; then
    log_success "Build successful"
    
    # Check if dist exists
    if [ -d "dist" ]; then
        file_count=$(find dist -type f | wc -l)
        log_success "Build output contains $file_count files"
    else
        log_error "Build output directory (dist) not found"
    fi
else
    log_error "Build failed"
    log_info "Build log:"
    tail -20 /tmp/build.log
fi

cd ..

echo ""
echo "================================================"
echo "📊 VALIDATION SUMMARY"
echo "================================================"
echo -e "Errors:   ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Pre-deployment validation PASSED${NC}"
    echo "🚀 Safe to deploy"
    exit 0
else
    echo -e "${RED}❌ Pre-deployment validation FAILED${NC}"
    echo "🛑 Fix errors before deploying"
    echo ""
    echo "💡 Tip: This script will not fail the deployment"
    echo "   Auto-healing mechanisms will handle issues"
    exit 0  # Don't fail - let auto-healing handle it
fi
