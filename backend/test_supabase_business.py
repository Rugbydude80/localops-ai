#!/usr/bin/env python3

from supabase_database import get_supabase_db

def test_get_business():
    """Test the get_business method"""
    try:
        supabase_db = get_supabase_db()
        
        # Test getting business with ID 1
        business = supabase_db.get_business(1)
        
        if business:
            print(f"✅ Business found: {business['name']}")
            print(f"   ID: {business['id']}")
            print(f"   Type: {business['type']}")
        else:
            print("❌ Business not found")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_get_business() 