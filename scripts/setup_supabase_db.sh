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

# Supabase connection details
SUPABASE_HOST="db.rujwuruuosffcxazymit.supabase.co"
SUPABASE_DB="postgres"
SUPABASE_USER="postgres"
SUPABASE_PASSWORD="fa7af059cd2c8504e8a247e23b6e0378476bf5d5d7da75c37e3a1227b1f12063"
SUPABASE_PORT="5432"

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
