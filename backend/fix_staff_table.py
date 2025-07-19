#!/usr/bin/env python3
"""
Migration script to add missing columns to staff table
"""

from sqlalchemy import text
from database import engine

def migrate_staff_table():
    """Add missing columns to staff table"""
    
    with engine.connect() as conn:
        try:
            # Check if password_hash column exists
            result = conn.execute(text("PRAGMA table_info(staff)"))
            columns = [row[1] for row in result.fetchall()]
            
            print(f"Current columns in staff table: {columns}")
            
            # Add missing columns if they don't exist
            if 'password_hash' not in columns:
                print("Adding password_hash column...")
                conn.execute(text("ALTER TABLE staff ADD COLUMN password_hash TEXT"))
                print("✅ password_hash column added")
            
            if 'can_assign_shifts' not in columns:
                print("Adding can_assign_shifts column...")
                conn.execute(text("ALTER TABLE staff ADD COLUMN can_assign_shifts BOOLEAN DEFAULT 0"))
                print("✅ can_assign_shifts column added")
            
            if 'can_manage_staff' not in columns:
                print("Adding can_manage_staff column...")
                conn.execute(text("ALTER TABLE staff ADD COLUMN can_manage_staff BOOLEAN DEFAULT 0"))
                print("✅ can_manage_staff column added")
            
            if 'can_view_all_shifts' not in columns:
                print("Adding can_view_all_shifts column...")
                conn.execute(text("ALTER TABLE staff ADD COLUMN can_view_all_shifts BOOLEAN DEFAULT 0"))
                print("✅ can_view_all_shifts column added")
            
            if 'department' not in columns:
                print("Adding department column...")
                conn.execute(text("ALTER TABLE staff ADD COLUMN department TEXT"))
                print("✅ department column added")
            
            if 'reports_to' not in columns:
                print("Adding reports_to column...")
                conn.execute(text("ALTER TABLE staff ADD COLUMN reports_to INTEGER"))
                print("✅ reports_to column added")
            
            conn.commit()
            print("✅ Migration completed successfully!")
            
        except Exception as e:
            print(f"❌ Error during migration: {e}")
            conn.rollback()

if __name__ == "__main__":
    migrate_staff_table() 