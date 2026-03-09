#!/bin/bash

# ============================================
# Supabase Database Setup Script
# MMC-MMS Medical Queue Management System
# ============================================

echo "============================================"
echo "  Supabase Database Setup"
echo "  MMC-MMS System"
echo "============================================"
echo ""

# Supabase connection details (strict env-only)
SUPABASE_HOST="${SUPABASE_HOST:-}"
SUPABASE_DB="${SUPABASE_DB:-postgres}"
SUPABASE_USER="${SUPABASE_USER:-postgres}"
SUPABASE_PASSWORD="${SUPABASE_PASSWORD:-}"
SUPABASE_PORT="${SUPABASE_PORT:-5432}"

if [ -z "$SUPABASE_HOST" ] || [ -z "$SUPABASE_PASSWORD" ]; then
  echo "❌ Missing required env vars: SUPABASE_HOST and SUPABASE_PASSWORD"
  exit 1
fi

# Schema file
SCHEMA_FILE="/home/ubuntu/love/supabase/migrations/20251105_initial_schema.sql"

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "📦 Installing PostgreSQL client..."
    sudo apt-get update -qq
    sudo apt-get install -y postgresql-client
fi

echo "🔍 Testing connection to Supabase..."

# Test connection
PGPASSWORD="$SUPABASE_PASSWORD" psql \
    -h "$SUPABASE_HOST" \
    -U "$SUPABASE_USER" \
    -d "$SUPABASE_DB" \
    -p "$SUPABASE_PORT" \
    -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Connection successful!"
else
    echo "❌ Connection failed!"
    echo "Please check your credentials and network connection"
    exit 1
fi

echo ""
echo "🚀 Applying database schema..."
echo ""

# Apply schema
PGPASSWORD="$SUPABASE_PASSWORD" psql \
    -h "$SUPABASE_HOST" \
    -U "$SUPABASE_USER" \
    -d "$SUPABASE_DB" \
    -p "$SUPABASE_PORT" \
    -f "$SCHEMA_FILE" \
    2>&1 | tee /tmp/schema_apply.log

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo ""
    echo "✅ Schema applied successfully!"
else
    echo ""
    echo "⚠️  Schema application completed with some warnings"
    echo "Check /tmp/schema_apply.log for details"
fi

echo ""
echo "🔍 Verifying tables..."

# Verify tables
PGPASSWORD="$SUPABASE_PASSWORD" psql \
    -h "$SUPABASE_HOST" \
    -U "$SUPABASE_USER" \
    -d "$SUPABASE_DB" \
    -p "$SUPABASE_PORT" \
    -c "\dt" 2>&1 | grep -E "patients|clinics|queues|pathways|notifications"

echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
