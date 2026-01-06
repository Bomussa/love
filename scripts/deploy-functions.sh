#!/bin/bash
# Supabase Functions Deployment Script
# Deploy all functions for MMC-MMS Queue System

set -e

PROJECT_REF="rujwuruuosffcxazymit"
FUNCTIONS_DIR="supabase/functions"

echo "🚀 Starting Supabase Functions Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Link to project
echo "🔗 Linking to Supabase project: $PROJECT_REF"
supabase link --project-ref $PROJECT_REF

# List of functions to deploy
FUNCTIONS=(
    "api-v1-status"
    "queue-enter"
    "queue-status"
    "queue-call"
    "pin-generate"
    "pin-verify"
    "pin-status"
    "reports-daily"
    "stats-dashboard"
)

echo ""
echo "📦 Deploying ${#FUNCTIONS[@]} functions..."
echo ""

DEPLOYED=0
FAILED=0

for FUNC in "${FUNCTIONS[@]}"; do
    echo "┌─ Deploying: $FUNC"
    if supabase functions deploy $FUNC --no-verify-jwt; then
        echo "└─ ✅ $FUNC deployed successfully"
        ((DEPLOYED++))
    else
        echo "└─ ❌ $FUNC deployment failed"
        ((FAILED++))
    fi
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Deployment Summary:"
echo "   ✅ Deployed: $DEPLOYED"
echo "   ❌ Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 All functions deployed successfully!"
    echo ""
    echo "🔍 List deployed functions:"
    supabase functions list
    echo ""
    echo "🧪 Test health endpoint:"
    echo "   curl https://mmc-mms.com/api/api-v1-status"
else
    echo "⚠️  Some deployments failed. Check errors above."
    exit 1
fi
