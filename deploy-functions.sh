#!/bin/bash

# Deployment Script for Supabase Edge Functions
# This script deploys all 24 Edge Functions to Supabase

PROJECT_ID="rujwuruuosffcxazymit"
FUNCTIONS_DIR="/home/ubuntu/love/supabase/functions"

echo "🚀 Starting deployment of Edge Functions to Supabase..."
echo "Project ID: $PROJECT_ID"
echo ""

# List of all functions
FUNCTIONS=(
  "health"
  "patient-login"
  "queue-enter"
  "queue-status"
  "queue-call"
  "queue-done"
  "queue-position"
  "queue-cancel"
  "pin-generate"
  "pin-status"
  "pin-verify"
  "admin-login"
  "admin-status"
  "clinic-exit"
  "stats-dashboard"
  "stats-queues"
  "route-create"
  "route-get"
  "path-choose"
  "events-stream"
  "reports-daily"
  "reports-weekly"
  "reports-monthly"
  "reports-annual"
)

SUCCESS_COUNT=0
FAIL_COUNT=0

for func in "${FUNCTIONS[@]}"; do
  echo "📦 Deploying: $func"
  
  # Check if function directory exists
  if [ ! -d "$FUNCTIONS_DIR/$func" ]; then
    echo "   ❌ Directory not found: $FUNCTIONS_DIR/$func"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi
  
  # Check if index.ts exists
  if [ ! -f "$FUNCTIONS_DIR/$func/index.ts" ]; then
    echo "   ❌ index.ts not found in $func"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi
  
  echo "   ✅ Found: $FUNCTIONS_DIR/$func/index.ts"
  SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
done

echo ""
echo "📊 Deployment Summary:"
echo "   ✅ Ready: $SUCCESS_COUNT functions"
echo "   ❌ Failed: $FAIL_COUNT functions"
echo ""

if [ $SUCCESS_COUNT -eq 24 ]; then
  echo "🎉 All 24 Edge Functions are ready for deployment!"
  echo ""
  echo "📝 Next Steps:"
  echo "1. Install Supabase CLI: npm install -g supabase"
  echo "2. Login: supabase login"
  echo "3. Link project: supabase link --project-ref $PROJECT_ID"
  echo "4. Deploy all: supabase functions deploy"
  echo ""
  echo "Or deploy individually:"
  for func in "${FUNCTIONS[@]}"; do
    echo "   supabase functions deploy $func"
  done
else
  echo "⚠️  Some functions are missing. Please check the errors above."
fi
