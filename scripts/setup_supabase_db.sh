#!/bin/bash

set -euo pipefail

echo "============================================"
echo "  Supabase Database Setup"
echo "  MMC-MMS System"
echo "============================================"
echo ""

if [ -z "${SUPABASE_HOST:-}" ] || [ -z "${SUPABASE_DB:-}" ] || [ -z "${SUPABASE_USER:-}" ] || [ -z "${SUPABASE_PASSWORD:-}" ] || [ -z "${SUPABASE_PORT:-}" ]; then
  echo "❌ Missing Supabase environment variables"
  echo "   Required: SUPABASE_HOST, SUPABASE_DB, SUPABASE_USER, SUPABASE_PASSWORD, SUPABASE_PORT"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="${SCHEMA_FILE:-${SCRIPT_DIR}/../diagnostics/schema-plan.sql}"

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "❌ Schema file not found: $SCHEMA_FILE"
  exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "📦 Installing PostgreSQL client..."
    sudo apt-get update -qq
    sudo apt-get install -y postgresql-client
fi

echo "🔍 Testing connection to Supabase..."

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

PGPASSWORD="$SUPABASE_PASSWORD" psql \
    -h "$SUPABASE_HOST" \
    -U "$SUPABASE_USER" \
    -d "$SUPABASE_DB" \
    -p "$SUPABASE_PORT" \
    -c "\dt" 2>&1 | grep -E "patients|clinics|queues|pathways|notifications|unified_queue|direct_alerts|routes"

echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"