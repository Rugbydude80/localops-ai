"""
Migration: Enhance notification tracking with retry logic and status tracking
Date: 2024-01-15
"""

import sqlite3
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

def upgrade_database(db_path: str):
    """Add enhanced notification tracking fields"""
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(schedule_notifications)")
        columns = [column[1] for column in cursor.fetchall()]
        
        # Add retry_count column if it doesn't exist
        if 'retry_count' not in columns:
            cursor.execute("""
                ALTER TABLE schedule_notifications 
                ADD COLUMN retry_count INTEGER DEFAULT 0
            """)
            logger.info("Added retry_count column to schedule_notifications")
        
        # Add error_message column if it doesn't exist
        if 'error_message' not in columns:
            cursor.execute("""
                ALTER TABLE schedule_notifications 
                ADD COLUMN error_message TEXT
            """)
            logger.info("Added error_message column to schedule_notifications")
        
        # Add priority column if it doesn't exist
        if 'priority' not in columns:
            cursor.execute("""
                ALTER TABLE schedule_notifications 
                ADD COLUMN priority TEXT DEFAULT 'medium'
            """)
            logger.info("Added priority column to schedule_notifications")
        
        # Update status column to include new statuses (SQLite doesn't support ALTER COLUMN)
        # The status column already exists, so we just need to ensure it can handle the new values
        # 'retrying' status will be handled by the application logic
        
        # Create indexes for better performance
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_schedule_notifications_status_retry 
                ON schedule_notifications(status, retry_count)
            """)
            logger.info("Created index on status and retry_count")
        except sqlite3.Error as e:
            logger.warning(f"Index creation failed (may already exist): {e}")
        
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_schedule_notifications_external_id 
                ON schedule_notifications(external_id)
            """)
            logger.info("Created index on external_id")
        except sqlite3.Error as e:
            logger.warning(f"Index creation failed (may already exist): {e}")
        
        conn.commit()
        logger.info("Successfully enhanced notification tracking schema")
        
    except sqlite3.Error as e:
        logger.error(f"Database migration failed: {e}")
        raise
    finally:
        if conn:
            conn.close()

def downgrade_database(db_path: str):
    """Remove enhanced notification tracking fields (not recommended)"""
    
    logger.warning("Downgrade not implemented - enhanced fields will remain in database")
    # SQLite doesn't support DROP COLUMN, so we can't easily remove the added columns
    # This is generally acceptable as the additional columns don't break existing functionality

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) != 2:
        print("Usage: python 002_enhance_notification_tracking.py <database_path>")
        sys.exit(1)
    
    db_path = sys.argv[1]
    
    if not Path(db_path).exists():
        print(f"Database file {db_path} does not exist")
        sys.exit(1)
    
    try:
        upgrade_database(db_path)
        print("Migration completed successfully")
    except Exception as e:
        print(f"Migration failed: {e}")
        sys.exit(1)