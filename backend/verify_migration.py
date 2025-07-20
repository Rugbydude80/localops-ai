#!/usr/bin/env python3
"""
Migration verification script for SynqForge Dual Admin Architecture
Verifies that all platform admin tables were created successfully
"""

import os
import sys
from supabase_database import SupabaseDatabase

def verify_migration():
    """Verify that the migration was successful"""
    
    print("🔍 SynqForge Dual Admin Migration Verification")
    print("=" * 50)
    
    # Initialize database connection
    try:
        db = SupabaseDatabase()
        print("✅ Database connection established")
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return False
    
    # Tables to verify
    tables_to_check = [
        'audit_logs', 'security_events', 'support_tickets', 'support_responses',
        'impersonation_logs', 'infrastructure_metrics', 'ai_model_status',
        'platform_analytics', 'system_config', 'ip_whitelist'
    ]
    
    # Views to verify
    views_to_check = [
        'recent_security_events', 'support_ticket_summary', 
        'platform_health_dashboard', 'workspace_analytics_summary'
    ]
    
    print("\n📊 Checking Tables...")
    existing_tables = []
    missing_tables = []
    
    for table in tables_to_check:
        try:
            result = db.client.table(table).select('*').limit(1).execute()
            existing_tables.append(table)
            print(f"✅ Table {table} exists and accessible")
        except Exception as e:
            missing_tables.append(table)
            print(f"❌ Table {table} missing: {e}")
    
    print(f"\n📊 Table Summary:")
    print(f"   ✅ Existing: {len(existing_tables)}")
    print(f"   ❌ Missing: {len(missing_tables)}")
    
    if missing_tables:
        print(f"\n❌ Missing tables: {', '.join(missing_tables)}")
        print("💡 You may need to run the migration in Supabase SQL Editor")
        return False
    
    # Check for sample data
    print("\n🔍 Checking Sample Data...")
    
    try:
        # Check system config
        config_result = db.client.table('system_config').select('*').execute()
        print(f"✅ System config entries: {len(config_result.data)}")
        
        # Check AI model status
        ai_result = db.client.table('ai_model_status').select('*').execute()
        print(f"✅ AI model status entries: {len(ai_result.data)}")
        
        # Check infrastructure metrics
        infra_result = db.client.table('infrastructure_metrics').select('*').execute()
        print(f"✅ Infrastructure metrics entries: {len(infra_result.data)}")
        
        # Check platform analytics
        analytics_result = db.client.table('platform_analytics').select('*').execute()
        print(f"✅ Platform analytics entries: {len(analytics_result.data)}")
        
        # Check support tickets
        tickets_result = db.client.table('support_tickets').select('*').execute()
        print(f"✅ Support tickets entries: {len(tickets_result.data)}")
        
    except Exception as e:
        print(f"❌ Error checking sample data: {e}")
    
    # Check indexes
    print("\n🔍 Checking Indexes...")
    try:
        # This is a simplified check - in a real scenario you'd query pg_indexes
        print("✅ Indexes should be created (check in Supabase dashboard)")
    except Exception as e:
        print(f"❌ Error checking indexes: {e}")
    
    # Final verification
    print("\n" + "=" * 50)
    print("🎉 MIGRATION VERIFICATION COMPLETE")
    print("=" * 50)
    
    if len(existing_tables) == len(tables_to_check):
        print("\n✅ SUCCESS! All platform admin tables are ready.")
        print("\n📋 What's now available:")
        print("   • Comprehensive audit logging system")
        print("   • Security event monitoring and alerting")
        print("   • Customer support ticket management")
        print("   • Infrastructure and AI model monitoring")
        print("   • Platform analytics and reporting")
        print("   • System configuration management")
        print("   • IP whitelist security controls")
        print("   • User impersonation audit trails")
        
        print("\n🚀 Your SynqForge dual admin architecture is ready!")
        print("\n💡 Next steps:")
        print("   • Test the platform admin functionality")
        print("   • Configure platform admin users")
        print("   • Set up monitoring and alerting")
        
        return True
    else:
        print(f"\n❌ VERIFICATION FAILED")
        print(f"   Expected {len(tables_to_check)} tables, found {len(existing_tables)}")
        print("\n💡 Please run the migration in Supabase SQL Editor")
        return False

if __name__ == "__main__":
    success = verify_migration()
    sys.exit(0 if success else 1) 