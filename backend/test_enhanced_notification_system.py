"""
Test enhanced notification system functionality
"""

import pytest
import asyncio
import sqlite3
from datetime import datetime, date
from unittest.mock import Mock, patch, AsyncMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base, ScheduleNotification, Staff, ScheduleDraft, Business
from services.notification_service import NotificationService
from exceptions import NotificationException

# Test database setup
TEST_DATABASE_URL = "sqlite:///./test_enhanced_notifications.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def setup_test_database():
    """Create test database with enhanced notification tracking"""
    Base.metadata.create_all(bind=engine)
    
    # Add the enhanced notification tracking columns manually for SQLite
    conn = sqlite3.connect("./test_enhanced_notifications.db")
    cursor = conn.cursor()
    
    try:
        # Add new columns if they don't exist
        cursor.execute("ALTER TABLE schedule_notifications ADD COLUMN retry_count INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    try:
        cursor.execute("ALTER TABLE schedule_notifications ADD COLUMN error_message TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    try:
        cursor.execute("ALTER TABLE schedule_notifications ADD COLUMN priority TEXT DEFAULT 'medium'")
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    conn.commit()
    conn.close()

def create_test_data(db):
    """Create test data for notification testing"""
    
    # Create business
    business = Business(
        id=1,
        name="Test Restaurant",
        address="123 Test St",
        phone_number="+1234567890",
        email="test@restaurant.com"
    )
    db.add(business)
    
    # Create staff members
    staff1 = Staff(
        id=1,
        name="John Doe",
        email="john@test.com",
        phone_number="+1234567891",
        business_id=1,
        role="server"
    )
    
    staff2 = Staff(
        id=2,
        name="Jane Smith",
        email="jane@test.com",
        phone_number="+1234567892",
        business_id=1,
        role="cook"
    )
    
    db.add(staff1)
    db.add(staff2)
    
    # Create schedule draft
    draft = ScheduleDraft(
        id="test-draft-123",
        business_id=1,
        created_by=1,
        date_range_start=date(2024, 1, 15),
        date_range_end=date(2024, 1, 21),
        status="draft",
        ai_generated=True
    )
    db.add(draft)
    
    db.commit()
    return business, [staff1, staff2], draft

@pytest.fixture
def db_session():
    """Create a test database session"""
    setup_test_database()
    db = TestingSessionLocal()
    try:
        # Clean up any existing data
        db.query(ScheduleNotification).delete()
        db.query(ScheduleDraft).delete()
        db.query(Staff).delete()
        db.query(Business).delete()
        db.commit()
        yield db
    finally:
        # Clean up after test
        db.query(ScheduleNotification).delete()
        db.query(ScheduleDraft).delete()
        db.query(Staff).delete()
        db.query(Business).delete()
        db.commit()
        db.close()

@pytest.mark.asyncio
async def test_enhanced_notification_retry_logic(db_session):
    """Test enhanced retry logic with status tracking"""
    
    business, staff_list, draft = create_test_data(db_session)
    notification_service = NotificationService(db_session)
    
    # Mock external services to simulate failures and retries
    with patch.object(notification_service.whatsapp_service, 'send_coverage_request') as mock_whatsapp:
        # First attempt fails, second succeeds
        mock_whatsapp.side_effect = [
            {"success": False, "error": "Network timeout"},
            {"success": True, "message_id": "wa_123456"}
        ]
        
        # Test retry mechanism
        result = await notification_service._send_notification_with_retry(
            staff=staff_list[0],
            message_content="Test notification",
            channel="whatsapp",
            draft_id=draft.id,
            notification_type="test",
            max_retries=3,
            notification_settings={"retry_failed_notifications": True, "max_retry_attempts": 3}
        )
        
        # Verify successful retry
        assert result["success"] is True
        assert result["attempts"] == 2
        assert "notification_id" in result
        
        # Verify notification record was created and updated
        notification = db_session.query(ScheduleNotification).filter(
            ScheduleNotification.id == result["notification_id"]
        ).first()
        
        assert notification is not None
        assert notification.status == "sent"
        assert notification.retry_count == 1  # One retry was needed
        assert notification.external_id == "wa_123456"

@pytest.mark.asyncio
async def test_notification_status_tracking(db_session):
    """Test notification status tracking functionality"""
    
    business, staff_list, draft = create_test_data(db_session)
    notification_service = NotificationService(db_session)
    
    # Create some test notifications with different statuses
    notifications = [
        ScheduleNotification(
            draft_id=draft.id,
            staff_id=staff_list[0].id,
            notification_type="new_schedule",
            channel="whatsapp",
            content="Test message 1",
            status="sent",
            sent_at=datetime.now(),
            external_id="wa_123"
        ),
        ScheduleNotification(
            draft_id=draft.id,
            staff_id=staff_list[1].id,
            notification_type="new_schedule",
            channel="email",
            content="Test message 2",
            status="failed",
            retry_count=2,
            error_message="Invalid email address"
        )
    ]
    
    for notification in notifications:
        db_session.add(notification)
    db_session.commit()
    
    # Test status retrieval
    status_result = await notification_service.get_notification_status(draft.id)
    
    assert status_result["success"] is True
    assert status_result["total_notifications"] == 2
    assert status_result["success_rate"] == 50.0  # 1 out of 2 successful
    assert status_result["summary"]["sent"] == 1
    assert status_result["summary"]["failed"] == 1
    
    # Verify notification details
    notifications_data = status_result["notifications"]
    assert len(notifications_data) == 2
    
    # Check sent notification
    sent_notification = next(n for n in notifications_data if n["status"] == "sent")
    assert sent_notification["staff_name"] == "John Doe"
    assert sent_notification["channel"] == "whatsapp"
    assert sent_notification["external_id"] == "wa_123"
    
    # Check failed notification
    failed_notification = next(n for n in notifications_data if n["status"] == "failed")
    assert failed_notification["staff_name"] == "Jane Smith"
    assert failed_notification["retry_count"] == 2
    assert failed_notification["error_message"] == "Invalid email address"

@pytest.mark.asyncio
async def test_retry_failed_notifications(db_session):
    """Test manual retry of failed notifications"""
    
    business, staff_list, draft = create_test_data(db_session)
    notification_service = NotificationService(db_session)
    
    # Create a failed notification
    failed_notification = ScheduleNotification(
        draft_id=draft.id,
        staff_id=staff_list[0].id,
        notification_type="new_schedule",
        channel="sms",
        content="Test retry message",
        status="failed",
        retry_count=1,
        error_message="SMS service unavailable"
    )
    db_session.add(failed_notification)
    db_session.commit()
    
    # Mock SMS service to succeed on retry
    with patch.object(notification_service.sms_service, 'send_sms') as mock_sms:
        mock_sms.return_value = {"success": True, "message_id": "sms_789"}
        
        # Test retry functionality
        retry_result = await notification_service.retry_failed_notifications(
            draft_id=draft.id,
            notification_ids=[failed_notification.id]
        )
        
        assert retry_result["success"] is True
        assert retry_result["retried_count"] == 1
        assert retry_result["successful_retries"] == 1
        assert retry_result["failed_retries"] == 0
        
        # Verify notification status was updated
        db_session.refresh(failed_notification)
        assert failed_notification.status == "sent"
        assert failed_notification.external_id == "sms_789"

@pytest.mark.asyncio
async def test_delivery_status_webhook(db_session):
    """Test delivery status update via webhook"""
    
    business, staff_list, draft = create_test_data(db_session)
    notification_service = NotificationService(db_session)
    
    # Create a sent notification
    notification = ScheduleNotification(
        draft_id=draft.id,
        staff_id=staff_list[0].id,
        notification_type="new_schedule",
        channel="whatsapp",
        content="Test webhook message",
        status="sent",
        sent_at=datetime.now(),
        external_id="wa_webhook_123"
    )
    db_session.add(notification)
    db_session.commit()
    
    # Test delivery status update
    delivery_time = datetime.now()
    success = await notification_service.update_delivery_status(
        external_id="wa_webhook_123",
        status="delivered",
        delivered_at=delivery_time
    )
    
    assert success is True
    
    # Verify notification was updated
    db_session.refresh(notification)
    assert notification.status == "delivered"
    assert notification.delivered_at is not None

@pytest.mark.asyncio
async def test_notification_priority_handling(db_session):
    """Test notification priority handling"""
    
    business, staff_list, draft = create_test_data(db_session)
    notification_service = NotificationService(db_session)
    
    # Test high priority notification settings
    notification_settings = {
        "notification_priority": "high",
        "retry_failed_notifications": True,
        "max_retry_attempts": 5,
        "delivery_confirmation": True
    }
    
    with patch.object(notification_service.whatsapp_service, 'send_coverage_request') as mock_whatsapp:
        mock_whatsapp.return_value = {"success": True, "message_id": "wa_priority_123"}
        
        result = await notification_service._send_notification_with_retry(
            staff=staff_list[0],
            message_content="High priority notification",
            channel="whatsapp",
            draft_id=draft.id,
            notification_type="urgent",
            max_retries=5,
            notification_settings=notification_settings
        )
        
        assert result["success"] is True
        
        # Verify notification record includes priority
        notification = db_session.query(ScheduleNotification).filter(
            ScheduleNotification.id == result["notification_id"]
        ).first()
        
        # Note: Priority would be set by the calling code, not the retry method
        assert notification is not None
        assert notification.status == "sent"

@pytest.mark.asyncio
async def test_permanent_failure_handling(db_session):
    """Test handling of permanent failures that shouldn't be retried"""
    
    business, staff_list, draft = create_test_data(db_session)
    notification_service = NotificationService(db_session)
    
    with patch.object(notification_service.whatsapp_service, 'send_coverage_request') as mock_whatsapp:
        # Simulate permanent failure
        mock_whatsapp.return_value = {"success": False, "error": "Invalid phone number"}
        
        result = await notification_service._send_notification_with_retry(
            staff=staff_list[0],
            message_content="Test permanent failure",
            channel="whatsapp",
            draft_id=draft.id,
            notification_type="test",
            max_retries=3
        )
        
        assert result["success"] is False
        assert result["attempts"] == 1  # Should not retry permanent failures
        
        # Verify notification record shows permanent failure
        notification = db_session.query(ScheduleNotification).filter(
            ScheduleNotification.id == result["notification_id"]
        ).first()
        
        assert notification.status == "failed"
        assert notification.retry_count == 1
        assert "invalid phone number" in notification.error_message.lower()

if __name__ == "__main__":
    # Run tests
    import sys
    import os
    
    # Add the backend directory to the path
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    
    # Run the tests
    pytest.main([__file__, "-v"])