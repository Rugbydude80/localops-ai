#!/usr/bin/env python3
"""
Script to set up the scheduling_constraints table in Supabase
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from supabase_database import get_supabase_db

def setup_constraints_table():
    """Set up the scheduling_constraints table in Supabase"""
    print("Setting up scheduling_constraints table in Supabase...")
    
    try:
        supabase_db = get_supabase_db()
        
        # SQL to create the scheduling_constraints table
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS scheduling_constraints (
            id SERIAL PRIMARY KEY,
            business_id INTEGER NOT NULL REFERENCES businesses(id),
            constraint_type VARCHAR NOT NULL,
            constraint_value JSON NOT NULL,
            priority VARCHAR DEFAULT 'medium',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        );
        """
        
        # Create index for better performance
        create_index_sql = """
        CREATE INDEX IF NOT EXISTS idx_constraints_business_type_active 
        ON scheduling_constraints (business_id, constraint_type, is_active);
        """
        
        # Execute the SQL using Supabase's rpc function
        # Note: We'll use a different approach since direct SQL execution might not be available
        
        print("✅ Table creation SQL prepared")
        print("📝 Please execute the following SQL in your Supabase SQL editor:")
        print("\n" + "="*50)
        print(create_table_sql)
        print(create_index_sql)
        print("="*50)
        
        return True
        
    except Exception as e:
        print(f"❌ Error setting up table: {e}")
        return False

def create_sample_constraints():
    """Create some sample constraints for testing"""
    print("\nCreating sample constraints...")
    
    try:
        supabase_db = get_supabase_db()
        
        # Sample constraints
        sample_constraints = [
            {
                "business_id": 1,
                "constraint_type": "max_hours_per_week",
                "constraint_value": {"hours": 40},
                "priority": "high",
                "is_active": True
            },
            {
                "business_id": 1,
                "constraint_type": "min_rest_between_shifts",
                "constraint_value": {"hours": 8},
                "priority": "medium",
                "is_active": True
            },
            {
                "business_id": 1,
                "constraint_type": "skill_match_required",
                "constraint_value": {"required": True},
                "priority": "critical",
                "is_active": True
            }
        ]
        
        # Insert sample constraints
        for constraint in sample_constraints:
            response = supabase_db.client.table('scheduling_constraints').insert(constraint).execute()
            print(f"✅ Created constraint: {constraint['constraint_type']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating sample constraints: {e}")
        return False

def test_constraints_table():
    """Test if the constraints table exists and works"""
    print("\nTesting constraints table...")
    
    try:
        supabase_db = get_supabase_db()
        
        # Try to query the table
        response = supabase_db.client.table('scheduling_constraints').select('*').limit(1).execute()
        print(f"✅ Constraints table exists and is accessible")
        print(f"   Found {len(response.data)} constraints")
        
        return True
        
    except Exception as e:
        print(f"❌ Constraints table not accessible: {e}")
        return False

if __name__ == "__main__":
    print("🔧 Setting up scheduling_constraints table...")
    
    # First, test if table exists
    if test_constraints_table():
        print("✅ Constraints table already exists!")
    else:
        # Set up the table
        if setup_constraints_table():
            print("✅ Table setup instructions provided")
        else:
            print("❌ Failed to prepare table setup")
    
    # Try to create sample constraints
    if test_constraints_table():
        create_sample_constraints()
    
    print("\n🎉 Setup complete!") 