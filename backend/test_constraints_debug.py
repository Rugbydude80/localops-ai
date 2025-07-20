#!/usr/bin/env python3
"""
Debug script to test Supabase connection and business constraints functionality
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from supabase_database import get_supabase_db

def test_business_lookup():
    """Test business lookup functionality"""
    print("Testing business lookup...")
    
    try:
        supabase_db = get_supabase_db()
        print(f"✅ Supabase DB instance created: {supabase_db}")
        
        # Test business lookup
        business = supabase_db.get_business(1)
        print(f"✅ Business lookup result: {business}")
        
        if business:
            print(f"✅ Business found: {business['name']}")
        else:
            print("❌ Business not found")
            
        return business is not None
        
    except Exception as e:
        print(f"❌ Error in business lookup: {e}")
        return False

def test_constraints_lookup():
    """Test constraints lookup functionality"""
    print("\nTesting constraints lookup...")
    
    try:
        supabase_db = get_supabase_db()
        
        # Test constraints lookup
        response = supabase_db.client.table('scheduling_constraints').select('*').eq('business_id', 1).execute()
        constraints = response.data
        print(f"✅ Constraints lookup result: {constraints}")
        
        return constraints
        
    except Exception as e:
        print(f"❌ Error in constraints lookup: {e}")
        return []

if __name__ == "__main__":
    print("🔍 Debugging Supabase connection and business constraints...")
    
    # Test business lookup
    business_exists = test_business_lookup()
    
    # Test constraints lookup
    constraints = test_constraints_lookup()
    
    print(f"\n📊 Summary:")
    print(f"   Business exists: {business_exists}")
    print(f"   Constraints found: {len(constraints)}")
    
    if constraints:
        print(f"   Constraint types: {[c.get('constraint_type') for c in constraints]}") 