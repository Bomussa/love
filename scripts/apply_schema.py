#!/usr/bin/env python3
"""
Script to apply database schema to Supabase
"""

import os
import sys
import requests
import json

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Missing required environment variables: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

def read_schema_file():
    """Read the SQL schema file"""
    schema_path = "/home/ubuntu/love/supabase/migrations/20251105_initial_schema.sql"
    
    try:
        with open(schema_path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"❌ Schema file not found: {schema_path}")
        sys.exit(1)

def apply_schema_via_rest(sql_content):
    """Apply schema using Supabase REST API"""
    
    # Split SQL into individual statements
    statements = [s.strip() for s in sql_content.split(';') if s.strip() and not s.strip().startswith('--')]
    
    print(f"📝 Found {len(statements)} SQL statements")
    
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json'
    }
    
    # Use PostgREST to execute SQL
    url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
    
    success_count = 0
    error_count = 0
    
    for i, statement in enumerate(statements, 1):
        if not statement or len(statement) < 10:
            continue
            
        print(f"\n[{i}/{len(statements)}] Executing statement...")
        print(f"Preview: {statement[:100]}...")
        
        try:
            response = requests.post(
                url,
                headers=headers,
                json={'query': statement}
            )
            
            if response.status_code in [200, 201, 204]:
                print(f"✅ Success")
                success_count += 1
            else:
                print(f"⚠️  Status {response.status_code}: {response.text[:200]}")
                error_count += 1
                
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            error_count += 1
    
    print(f"\n{'='*50}")
    print(f"✅ Successful: {success_count}")
    print(f"❌ Errors: {error_count}")
    print(f"{'='*50}")
    
    return success_count, error_count

def test_connection():
    """Test Supabase connection"""
    print("🔍 Testing Supabase connection...")
    
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
    }
    
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/",
            headers=headers
        )
        
        if response.status_code == 200:
            print("✅ Supabase connection successful")
            return True
        else:
            print(f"❌ Connection failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Connection error: {str(e)}")
        return False

def main():
    print("=" * 60)
    print("  Supabase Schema Application Script")
    print("  MMC-MMS Medical Queue Management System")
    print("=" * 60)
    print()
    
    # Test connection
    if not test_connection():
        print("\n❌ Cannot proceed without connection")
        sys.exit(1)
    
    print()
    
    # Read schema
    print("📖 Reading schema file...")
    sql_content = read_schema_file()
    print(f"✅ Schema loaded ({len(sql_content)} characters)")
    
    print()
    
    # Apply schema
    print("🚀 Applying schema to Supabase...")
    print("⚠️  Note: This may take a few minutes...")
    print()
    
    success, errors = apply_schema_via_rest(sql_content)
    
    print()
    
    if errors == 0:
        print("🎉 Schema applied successfully!")
        return 0
    else:
        print(f"⚠️  Schema applied with {errors} errors")
        print("   Some errors may be expected (e.g., 'already exists')")
        return 1

if __name__ == "__main__":
    sys.exit(main())
