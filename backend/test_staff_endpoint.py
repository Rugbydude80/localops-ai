#!/usr/bin/env python3
"""
Test script to verify staff endpoint functionality using Supabase
"""
import os
from dotenv import load_dotenv
from supabase_database import get_supabase_db

# Load environment variables
load_dotenv()

print("🔍 Testing Staff Endpoint with Supabase...")

try:
    # Get Supabase database instance
    supabase_db = get_supabase_db()
    
    # Test getting business
    print("🔗 Testing business retrieval...")
    business = supabase_db.get_business(1)
    if business:
        print(f"✅ Business found: {business['name']}")
    else:
        print("❌ Business not found")
    
    # Test getting staff
    print("🔗 Testing staff retrieval...")
    staff_data = supabase_db.get_staff(1)
    print(f"✅ Found {len(staff_data)} staff members")
    
    for staff in staff_data:
        print(f"  - {staff['name']} ({staff['role']})")
    
    # Test creating a staff member
    print("🔗 Testing staff creation...")
    new_staff_data = {
        "business_id": 1,
        "name": "Test Staff Member",
        "phone_number": "+44 20 7123 4568",
        "email": "test@localops.ai",
        "role": "server",
        "skills": ["front_of_house", "customer_service"],
        "availability": {"monday": ["09:00-17:00"], "tuesday": ["18:00-23:00"]},
        "reliability_score": 5.0,
        "is_active": True
    }
    
    created_staff = supabase_db.create_staff(new_staff_data)
    if created_staff:
        print(f"✅ Staff created: {created_staff['name']} (ID: {created_staff['id']})")
        
        # Test updating staff
        print("🔗 Testing staff update...")
        updates = {"role": "senior_server", "reliability_score": 7.0}
        updated_staff = supabase_db.update_staff(created_staff['id'], updates)
        if updated_staff:
            print(f"✅ Staff updated: {updated_staff['name']} - New role: {updated_staff['role']}")
        
        # Test deleting staff (soft delete)
        print("🔗 Testing staff deletion...")
        if supabase_db.delete_staff(created_staff['id']):
            print("✅ Staff deleted (soft delete)")
        
    else:
        print("❌ Failed to create staff")
    
    print("🏁 Staff endpoint test complete!")
    
except Exception as e:
    print(f"❌ Test failed: {e}")
    import traceback
    traceback.print_exc() 