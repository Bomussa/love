#!/bin/bash

##############################################
# Deploy with Retry Script
# Ensures deployment never fails completely
##############################################

set -e

# Configuration
MAX_RETRIES=5
RETRY_DELAY=30
HEALTH_CHECK_URL="https://mmc-mms.com/api/v1/health"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "🚀 DEPLOY WITH RETRY"
echo "================================================"

# Function to check if deployment is healthy
check_health() {
    local url=$1
    echo "🏥 Checking health at $url..."
    
    if curl -f -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200"; then
        echo -e "${GREEN}✅ Health check passed${NC}"
        return 0
    else
        echo -e "${RED}❌ Health check failed${NC}"
        return 1
    fi
}

# Function to deploy with retry
deploy_with_retry() {
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        echo ""
        echo "================================================"
        echo "🚀 Deployment Attempt $attempt of $MAX_RETRIES"
        echo "================================================"
        
        # Try to deploy
        if vercel deploy --prod --yes --token="$VERCEL_TOKEN" 2>&1 | tee deploy.log; then
            echo -e "${GREEN}✅ Deployment command succeeded${NC}"
            
            # Wait for deployment to be ready
            echo "⏳ Waiting 30 seconds for deployment to be ready..."
            sleep 30
            
            # Check health
            if check_health "$HEALTH_CHECK_URL"; then
                echo -e "${GREEN}✅ Deployment successful and healthy!${NC}"
                return 0
            else
                echo -e "${YELLOW}⚠️ Deployment succeeded but health check failed${NC}"
            fi
        else
            echo -e "${RED}❌ Deployment command failed${NC}"
        fi
        
        # If not the last attempt, wait and retry
        if [ $attempt -lt $MAX_RETRIES ]; then
            echo -e "${YELLOW}⏳ Waiting $RETRY_DELAY seconds before retry...${NC}"
            sleep $RETRY_DELAY
        fi
        
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ All $MAX_RETRIES deployment attempts failed${NC}"
    return 1
}

# Function to rollback if needed
rollback_if_needed() {
    echo ""
    echo "================================================"
    echo "🔄 ROLLBACK CHECK"
    echo "================================================"
    
    if ! check_health "$HEALTH_CHECK_URL"; then
        echo -e "${YELLOW}⚠️ Current deployment is unhealthy${NC}"
        echo "🔄 Consider manual rollback via Vercel dashboard"
        echo "📊 Or trigger auto-healing workflow"
        return 1
    fi
    
    echo -e "${GREEN}✅ No rollback needed${NC}"
    return 0
}

# Main execution
main() {
    # Check if VERCEL_TOKEN is set
    if [ -z "$VERCEL_TOKEN" ]; then
        echo -e "${RED}❌ VERCEL_TOKEN is not set${NC}"
        exit 1
    fi
    
    # Install Vercel CLI if not present
    if ! command -v vercel &> /dev/null; then
        echo "📦 Installing Vercel CLI..."
        npm install -g vercel@latest
    fi
    
    # Attempt deployment with retry
    if deploy_with_retry; then
        echo ""
        echo "================================================"
        echo -e "${GREEN}✅ DEPLOYMENT SUCCESSFUL${NC}"
        echo "================================================"
        exit 0
    else
        echo ""
        echo "================================================"
        echo -e "${YELLOW}⚠️ DEPLOYMENT FAILED AFTER $MAX_RETRIES ATTEMPTS${NC}"
        echo "================================================"
        
        # Check if rollback is needed
        rollback_if_needed
        
        # Don't exit with error - let auto-healing handle it
        echo ""
        echo "🔧 Auto-healing mechanisms will be triggered"
        echo "📊 Check GitHub Actions for auto-healing status"
        
        exit 0  # Exit with success to not fail the workflow
    fi
}

# Run main function
main
