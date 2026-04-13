#!/usr/bin/env python3
"""
Setup Supabase Database Schema
This script creates all necessary tables, indexes, and policies
"""

import psycopg2
import os
import sys

# Database connection string
DB_URL = "postgres://postgres.utgsoizsnqchiduzffxo:uFv031NrmT4D6wwi@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"

def setup_database():
    """Execute the schema.sql file to set up the database"""
    
    print("🚀 Starting database setup...")
    print(f"📡 Connecting to Supabase...")
    
    try:
        # Connect to database
        conn = psycopg2.connect(DB_URL)
        conn.autocommit = True
        cursor = conn.cursor()
        
        print("✅ Connected successfully!")
        
        # Read schema.sql file
        schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
        with open(schema_path, 'r', encoding='utf-8') as f:
            schema_sql = f.read()
        
        print("📄 Executing schema.sql...")
        
        # Execute the schema
        cursor.execute(schema_sql)
        
        print("✅ Schema executed successfully!")
        
        # Verify tables were created
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        
        tables = cursor.fetchall()
        print(f"\n📊 Created {len(tables)} tables:")
        for table in tables:
            print(f"   ✓ {table[0]}")
        
        # Verify clinics data
        cursor.execute("SELECT COUNT(*) FROM clinics;")
        clinic_count = cursor.fetchone()[0]
        print(f"\n🏥 Inserted {clinic_count} clinics")
        
        # Show clinic details
        cursor.execute("SELECT id, name_ar, pin, requires_pin FROM clinics ORDER BY display_order;")
        clinics = cursor.fetchall()
        print("\n📋 Clinic Details:")
        for clinic in clinics:
            pin_status = "🔐 PIN Required" if clinic[3] else "🔓 No PIN"
            print(f"   • {clinic[1]} ({clinic[0]}): PIN={clinic[2]} {pin_status}")
        
        # Close connection
        cursor.close()
        conn.close()
        
        print("\n✅ Database setup completed successfully!")
        print("🎉 Ready to use!")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = setup_database()
    sys.exit(0 if success else 1)
