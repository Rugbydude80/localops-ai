#!/usr/bin/env python3
"""
Test script to verify Supabase connection
"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

print("🔍 Testing Supabase Connection...")
print(f"SUPABASE_URL: {os.getenv('SUPABASE_URL')}")
print(f"DATABASE_URL: {os.getenv('DATABASE_URL')}")

try:
    # Test Supabase client
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")
    
    if not url or not key:
        print("❌ Missing Supabase URL or key")
        exit(1)
    
    supabase: Client = create_client(url, key)
    
    # Test connection by querying a table
    print("🔗 Testing Supabase client connection...")
    response = supabase.table('businesses').select('*').limit(1).execute()
    print("✅ Supabase client connection successful!")
    print(f"Response: {response}")
    
except Exception as e:
    print(f"❌ Supabase client connection failed: {e}")

try:
    # Test direct database connection
    from sqlalchemy import create_engine, text
    
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("❌ Missing DATABASE_URL")
        exit(1)
    
    print(f"🔗 Testing direct database connection...")
    print(f"Database URL: {database_url}")
    
    engine = create_engine(database_url, pool_pre_ping=True)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1 as test")).fetchone()
        print("✅ Direct database connection successful!")
        print(f"Test query result: {result}")
        
except Exception as e:
    print(f"❌ Direct database connection failed: {e}")

print("🏁 Connection test complete!") 