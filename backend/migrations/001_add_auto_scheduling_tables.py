#!/usr/bin/env python3
"""
Migration script for Auto-Scheduling System
Adds tables: schedule_drafts, draft_shift_assignments, scheduling_constraints, 
staff_preferences, and schedule_notifications
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from database import DATABASE_URL, SessionLocal, engine
from models import Base, ScheduleDraft, DraftShiftAssignment, SchedulingConstraint, StaffPreference, ScheduleNotification
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_auto_scheduling_tables():
    """Create auto-scheduling system tables with proper indexes"""
    
    print("🔄 Creating auto-scheduling system tables...")
    
    try:
        # Create the new tables
        Base.metadata.create_all(bind=engine, tables=[
            ScheduleDraft.__table__,
            DraftShiftAssignment.__table__,
            SchedulingConstraint.__table__,
            StaffPreference.__table__,
            ScheduleNotification.__table__
        ])
        
        # Create additional indexes for optimal query performance
        db = SessionLocal()
        
        # Indexes for schedule_drafts table
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_schedule_drafts_business_date_range 
            ON schedule_drafts (business_id, date_range_start, date_range_end);
        """))
        
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_schedule_drafts_status_created 
            ON schedule_drafts (status, created_at);
        """))
        
        # Indexes for draft_shift_assignments table
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_draft_assignments_draft_shift 
            ON draft_shift_assignments (draft_id, shift_id);
        """))
        
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_draft_assignments_staff_confidence 
            ON draft_shift_assignments (staff_id, confidence_score);
        """))
        
        # Indexes for scheduling_constraints table
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_constraints_business_type_active 
            ON scheduling_constraints (business_id, constraint_type, is_active);
        """))
        
        # Indexes for staff_preferences table
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_preferences_staff_type_active 
            ON staff_preferences (staff_id, preference_type, is_active);
        """))
        
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_preferences_date_range 
            ON staff_preferences (effective_date, expiry_date);
        """))
        
        # Indexes for schedule_notifications table
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_notifications_draft_staff 
            ON schedule_notifications (draft_id, staff_id);
        """))
        
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_notifications_status_sent 
            ON schedule_notifications (status, sent_at);
        """))
        
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_notifications_type_channel 
            ON schedule_notifications (notification_type, channel);
        """))
        
        db.commit()
        db.close()
        
        print("✅ Auto-scheduling system tables created successfully!")
        print("   Tables created:")
        print("   - schedule_drafts")
        print("   - draft_shift_assignments")
        print("   - scheduling_constraints")
        print("   - staff_preferences")
        print("   - schedule_notifications")
        print("   - All performance indexes added")
        
    except Exception as e:
        print(f"❌ Error creating auto-scheduling tables: {e}")
        raise

def rollback_auto_scheduling_tables():
    """Rollback auto-scheduling system tables"""
    
    print("🔄 Rolling back auto-scheduling system tables...")
    
    try:
        db = SessionLocal()
        
        # Drop tables in reverse order to handle foreign key constraints
        tables_to_drop = [
            "schedule_notifications",
            "draft_shift_assignments", 
            "staff_preferences",
            "scheduling_constraints",
            "schedule_drafts"
        ]
        
        for table_name in tables_to_drop:
            db.execute(text(f"DROP TABLE IF EXISTS {table_name} CASCADE;"))
        
        db.commit()
        db.close()
        
        print("✅ Auto-scheduling system tables rolled back successfully!")
        
    except Exception as e:
        print(f"❌ Error rolling back auto-scheduling tables: {e}")
        raise

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        rollback_auto_scheduling_tables()
    else:
        create_auto_scheduling_tables()