#!/usr/bin/env python3
"""
Verification script to test if the scheduling_constraints table was created successfully
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from supabase_database import get_supabase_db

def verify_constraints_table():
    """Verify that the scheduling_constraints table exists and has data"""
    print("🔍 Verifying scheduling_constraints table...")
    
    try:
        supabase_db = get_supabase_db()
        
        # Test if table exists by querying it
        response = supabase_db.client.table('scheduling_constraints').select('*').execute()
        constraints = response.data
        
        print(f"✅ Table exists and is accessible")
        print(f"📊 Found {len(constraints)} constraints")
        
        if constraints:
            print("\n📋 Sample constraints:")
            for constraint in constraints[:3]:  # Show first 3
                print(f"   - {constraint['constraint_type']}: {constraint['constraint_value']} (Priority: {constraint['priority']})")
        
        # Test business-specific query
        business_constraints = supabase_db.client.table('scheduling_constraints').select('*').eq('business_id', 1).execute()
        print(f"\n🏢 Business 1 has {len(business_constraints.data)} constraints")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_api_endpoint():
    """Test the API endpoint after table creation"""
    print("\n🌐 Testing API endpoint...")
    
    try:
        import requests
        
        response = requests.get("http://localhost:8001/api/business/1/constraints")
        
        if response.status_code == 200:
            constraints = response.json()
            print(f"✅ API endpoint working")
            print(f"📊 Returned {len(constraints)} constraints")
            
            if constraints:
                print("\n📋 API Response:")
                for constraint in constraints[:2]:  # Show first 2
                    print(f"   - {constraint['constraint_type']}: {constraint['constraint_value']}")
            
            return True
        else:
            print(f"❌ API endpoint failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing API: {e}")
        return False

if __name__ == "__main__":
    print("🔧 Verifying scheduling_constraints table setup...")
    
    # Verify table exists
    table_ok = verify_constraints_table()
    
    if table_ok:
        print("\n✅ Table verification successful!")
        
        # Test API endpoint if server is running
        print("\n🌐 Testing API endpoint...")
        api_ok = test_api_endpoint()
        
        if api_ok:
            print("\n🎉 Everything is working correctly!")
            print("   - Table created successfully")
            print("   - API endpoint returning data")
        else:
            print("\n⚠️  Table created but API endpoint needs testing")
            print("   - Make sure the backend server is running")
            print("   - Try: cd backend && python3 main.py")
    else:
        print("\n❌ Table verification failed")
        print("   - Please execute the SQL script in Supabase")
        print("   - Check the create_constraints_table.sql file") 