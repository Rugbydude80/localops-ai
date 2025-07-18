#!/usr/bin/env python3
"""
Generate DDL statements for Auto-Scheduling System tables
This script generates the SQL DDL without requiring a database connection
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, MetaData
from sqlalchemy.schema import CreateTable, CreateIndex
from models import ScheduleDraft, DraftShiftAssignment, SchedulingConstraint, StaffPreference, ScheduleNotification

def generate_ddl():
    """Generate DDL statements for auto-scheduling tables"""
    
    print("-- Auto-Scheduling System DDL")
    print("-- Generated DDL statements for creating tables and indexes")
    print("-- Execute these statements in your PostgreSQL database\n")
    
    # Create a mock engine for DDL generation (doesn't connect)
    engine = create_engine("postgresql://", strategy='mock', executor=lambda sql, *_: print(f"{sql};"))
    
    # Generate CREATE TABLE statements
    tables = [
        ScheduleDraft.__table__,
        DraftShiftAssignment.__table__,
        SchedulingConstraint.__table__,
        StaffPreference.__table__,
        ScheduleNotification.__table__
    ]
    
    print("-- CREATE TABLE statements")
    for table in tables:
        create_table_ddl = CreateTable(table).compile(engine)
        print(f"{create_table_ddl};\n")
    
    # Generate CREATE INDEX statements
    print("-- CREATE INDEX statements for optimal query performance")
    
    index_statements = [
        """CREATE INDEX IF NOT EXISTS idx_schedule_drafts_business_date_range 
ON schedule_drafts (business_id, date_range_start, date_range_end)""",
        
        """CREATE INDEX IF NOT EXISTS idx_schedule_drafts_status_created 
ON schedule_drafts (status, created_at)""",
        
        """CREATE INDEX IF NOT EXISTS idx_draft_assignments_draft_shift 
ON draft_shift_assignments (draft_id, shift_id)""",
        
        """CREATE INDEX IF NOT EXISTS idx_draft_assignments_staff_confidence 
ON draft_shift_assignments (staff_id, confidence_score)""",
        
        """CREATE INDEX IF NOT EXISTS idx_constraints_business_type_active 
ON scheduling_constraints (business_id, constraint_type, is_active)""",
        
        """CREATE INDEX IF NOT EXISTS idx_preferences_staff_type_active 
ON staff_preferences (staff_id, preference_type, is_active)""",
        
        """CREATE INDEX IF NOT EXISTS idx_preferences_date_range 
ON staff_preferences (effective_date, expiry_date)""",
        
        """CREATE INDEX IF NOT EXISTS idx_notifications_draft_staff 
ON schedule_notifications (draft_id, staff_id)""",
        
        """CREATE INDEX IF NOT EXISTS idx_notifications_status_sent 
ON schedule_notifications (status, sent_at)""",
        
        """CREATE INDEX IF NOT EXISTS idx_notifications_type_channel 
ON schedule_notifications (notification_type, channel)"""
    ]
    
    for index_sql in index_statements:
        print(f"{index_sql};\n")
    
    print("-- End of Auto-Scheduling System DDL")

if __name__ == "__main__":
    generate_ddl()