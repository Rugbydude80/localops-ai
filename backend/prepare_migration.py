#!/usr/bin/env python3
"""
Migration preparation script for SynqForge Dual Admin Architecture
Prepares the SQL migration and provides instructions for running in Supabase
"""

import os
import sys
from pathlib import Path
from supabase_database import SupabaseDatabase

def prepare_migration():
    """Prepare the migration and provide instructions"""
    
    print("🚀 SynqForge Dual Admin Migration Preparation")
    print("=" * 50)
    
    # Initialize database connection to verify it works
    try:
        db = SupabaseDatabase()
        print("✅ Database connection verified")
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return False
    
    # Read the migration SQL file
    migration_file = Path(__file__).parent.parent / "complete_dual_admin_migration.sql"
    
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        return False
    
    try:
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        print(f"📄 Migration file loaded: {len(migration_sql)} characters")
    except Exception as e:
        print(f"❌ Failed to read migration file: {e}")
        return False
    
    # Check current database state
    print("\n🔍 Checking current database state...")
    
    tables_to_check = [
        'audit_logs', 'security_events', 'support_tickets', 'support_responses',
        'impersonation_logs', 'infrastructure_metrics', 'ai_model_status',
        'platform_analytics', 'system_config', 'ip_whitelist'
    ]
    
    existing_tables = []
    missing_tables = []
    
    for table in tables_to_check:
        try:
            result = db.client.table(table).select('*').limit(1).execute()
            existing_tables.append(table)
            print(f"✅ Table {table} already exists")
        except Exception as e:
            missing_tables.append(table)
            print(f"❌ Table {table} missing")
    
    print(f"\n📊 Current State:")
    print(f"   Existing tables: {len(existing_tables)}")
    print(f"   Missing tables: {len(missing_tables)}")
    
    if len(missing_tables) == 0:
        print("\n🎉 All platform admin tables already exist!")
        print("Your SynqForge dual admin architecture is already set up.")
        return True
    
    # Create a copy of the migration file in the backend directory for easy access
    backend_migration_file = Path(__file__).parent / "dual_admin_migration.sql"
    
    try:
        with open(backend_migration_file, 'w') as f:
            f.write(migration_sql)
        print(f"\n📁 Migration SQL saved to: {backend_migration_file}")
    except Exception as e:
        print(f"❌ Failed to save migration file: {e}")
    
    # Provide instructions
    print("\n" + "=" * 50)
    print("📋 MIGRATION INSTRUCTIONS")
    print("=" * 50)
    print("\nTo complete the migration, follow these steps:")
    print("\n1. 📱 Open your Supabase Dashboard")
    print("2. 🔗 Go to the SQL Editor")
    print("3. 📄 Copy the contents of the migration file:")
    print(f"   File: {backend_migration_file}")
    print("\n4. 🖥️  Paste the SQL into the Supabase SQL Editor")
    print("5. ▶️  Click 'Run' to execute the migration")
    print("\n6. ✅ Verify the migration by running these queries:")
    
    for table in missing_tables:
        print(f"   SELECT COUNT(*) FROM {table};")
    
    print("\n📋 What this migration will create:")
    print("   • 10 Platform Admin Tables")
    print("   • Comprehensive indexes for performance")
    print("   • Database views for common queries")
    print("   • Sample data and configuration")
    print("   • Row Level Security policies")
    
    print("\n⚠️  Important Notes:")
    print("   • This migration is idempotent (safe to run multiple times)")
    print("   • Existing data will be preserved")
    print("   • The migration may take 2-3 minutes to complete")
    
    print("\n🚀 Ready to migrate!")
    print(f"📄 Migration file: {backend_migration_file}")
    
    return True

if __name__ == "__main__":
    success = prepare_migration()
    sys.exit(0 if success else 1) 