#!/usr/bin/env python3

import os
from dotenv import load_dotenv
from supabase._sync.client import create_client

# Load environment variables
load_dotenv()

def create_test_business():
    """Create a test business in Supabase"""
    
    # Get Supabase configuration
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase URL or key")
        return
    
    # Create Supabase client
    client = create_client(supabase_url, supabase_key)
    
    try:
        # Check if business with ID 1 already exists
        response = client.table('businesses').select('*').eq('id', 1).execute()
        
        if response.data:
            print(f"✅ Business with ID 1 already exists: {response.data[0]['name']}")
            return
        
        # Create a test business
        business_data = {
            "id": 1,
            "name": "Test Restaurant",
            "type": "restaurant",
            "phone_number": "+1234567890",
            "email": "test@restaurant.com",
            "address": "123 Test Street, Test City",
            "owner_name": "Test Owner",
            "subscription_tier": "starter",
            "is_active": True
        }
        
        response = client.table('businesses').insert(business_data).execute()
        
        if response.data:
            print("✅ Created test business with ID 1 in Supabase")
        else:
            print("❌ Failed to create business")
            
    except Exception as e:
        print(f"❌ Error creating business: {e}")

if __name__ == "__main__":
    create_test_business() 