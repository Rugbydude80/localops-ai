import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
from models import (
    Business, Staff, Shift, ScheduleDraft, DraftShiftAssignment, 
    ScheduleNotification
)
from services.notification_service import NotificationService, ScheduleChangeDetector


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_notification.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db_session():
    """Create a test database session"""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sample_business(db_session):
    """Create a sample business for testing"""
    business = Business(
        id=1,
        name="Test Restaurant",
        type="restaurant",
        phone_number="+1234567890",
        email="test@restaurant.com"
    )
    db_session.add(business)
    db_session.commit()
    return business


@pytest.fixture
def sample_staff(db_session, sample_business):
    """Create sample staff members for testing"""
    staff_members = [
        Staff(
            id=1,
            business_id=sample_business.id,
            name="John Doe",
            phone_number="+1234567891",
            email="john@test.com",
            role="server",
            skills=["front_of_house"],
            is_active=True
        ),
        Staff(
            id=2,
            business_id=sample_business.id,
            name="Jane Smith",
            phone_number="+1234567892",
            email="jane@test.com",
            role="chef",
            skills=["kitchen"],
            is_active=True
        ),
        Staff(
            id=3,
            business_id=sample_business.id,
            name="Bob Wilson",
            phone_number="+1234567893",
            email="bob@test.com",
            role="bartender",
            skills=["bar"],
            is_active=True
        )
    ]
    
    for staff in staff_members:
        db_session.add(staff)
    db_session.commit()
    return staff_members


@pytest.fixture
def sample_shifts(db_session, sample_business):
    """Create sample shifts for testing"""
    shifts = [
        Shift(
            id=1,
            business_id=sample_business.id,
            title="Morning Service",
            date=datetime(2024, 1, 15, 9, 0),
            start_time="09:00",
            end_time="17:00",
            required_skill="front_of_house",
            required_staff_count=2
        ),
        Shift(
            id=2,
            business_id=sample_business.id,
            title="Evening Kitchen",
            date=datetime(2024, 1, 15, 17, 0),
            start_time="17:00",
            end_time="23:00",
            required_skill="kitchen",
            required_staff_count=1
        ),
        Shift(
            id=3,
            business_id=sample_business.id,
            title="Bar Service",
            date=datetime(2024, 1, 16, 18, 0),
            start_time="18:00",
            end_time="02:00",
            required_skill="bar",
            required_staff_count=1
        )
    ]
    
    for shift in shifts:
        db_session.add(shift)
    db_session.commit()
    return shifts


@pytest.fixture
def sample_draft(db_session, sample_business, sample_staff):
    """Create a sample schedule draft for testing"""
    draft = ScheduleDraft(
        id="test-draft-123",
        business_id=sample_business.id,
        created_by=sample_staff[0].id,
        date_range_start=date(2024, 1, 15),
        date_range_end=date(2024, 1, 21),
        status="draft",
        ai_generated=True,
        confidence_score=0.85
    )
    db_session.add(draft)
    db_session.commit()
    return draft


@pytest.fixture
def sample_assignments(db_session, sample_draft, sample_shifts, sample_staff):
    """Create sample draft assignments for testing"""
    assignments = [
        DraftShiftAssignment(
            id=1,
            draft_id=sample_draft.id,
            shift_id=sample_shifts[0].id,
            staff_id=sample_staff[0].id,
            confidence_score=0.9,
            reasoning="High availability and skill match",
            is_ai_generated=True
        ),
        DraftShiftAssignment(
            id=2,
            draft_id=sample_draft.id,
            shift_id=sample_shifts[1].id,
            staff_id=sample_staff[1].id,
            confidence_score=0.8,
            reasoning="Kitchen expertise required",
            is_ai_generated=True
        ),
        DraftShiftAssignment(
            id=3,
            draft_id=sample_draft.id,
            shift_id=sample_shifts[2].id,
            staff_id=sample_staff[2].id,
            confidence_score=0.85,
            reasoning="Bar experience and availability",
            is_ai_generated=True
        )
    ]
    
    for assignment in assignments:
        db_session.add(assignment)
    db_session.commit()
    return assignments


class TestNotificationService:
    """Test cases for NotificationService"""
    
    @pytest.fixture
    def notification_service(self, db_session):
        """Create NotificationService instance with mocked external services"""
        service = NotificationService(db_session)
        
        # Mock external services
        service.whatsapp_service = AsyncMock()
        service.sms_service = AsyncMock()
        service.email_service = AsyncMock()
        
        return service
    
    @pytest.mark.asyncio
    async def test_send_schedule_notifications_success(
        self, notification_service, sample_draft, sample_assignments
    ):
        """Test successful schedule notification sending"""
        
        # Mock successful external service responses
        notification_service.whatsapp_service.send_coverage_request.return_value = {
            "success": True,
            "message_id": "whatsapp_123"
        }
        
        notification_settings = {
            "channels": ["whatsapp"],
            "notify_all_staff": True,
            "custom_message": "Please review your schedule"
        }
        
        result = await notification_service.send_schedule_notifications(
            sample_draft.id, notification_settings
        )
        
        assert result["success"] is True
        assert result["notifications_sent"] == 3  # 3 staff members
        assert result["failed_notifications"] == 0
        assert result["total_staff"] == 3
        
        # Verify WhatsApp service was called for each staff member
        assert notification_service.whatsapp_service.send_coverage_request.call_count == 3
    
    @pytest.mark.asyncio
    async def test_send_schedule_notifications_with_fallback(
        self, notification_service, sample_draft, sample_assignments
    ):
        """Test notification sending with fallback to SMS when WhatsApp fails"""
        
        # Mock WhatsApp failure and SMS success
        notification_service.whatsapp_service.send_coverage_request.return_value = {
            "success": False,
            "error": "WhatsApp API unavailable"
        }
        notification_service.sms_service.send_sms.return_value = {
            "success": True,
            "message_id": "sms_123"
        }
        
        notification_settings = {
            "channels": ["whatsapp", "sms"],
            "notify_all_staff": True
        }
        
        result = await notification_service.send_schedule_notifications(
            sample_draft.id, notification_settings
        )
        
        assert result["success"] is True
        assert result["notifications_sent"] == 3
        assert result["failed_notifications"] == 0
        
        # Verify both services were called
        assert notification_service.whatsapp_service.send_coverage_request.call_count == 3
        assert notification_service.sms_service.send_sms.call_count == 3
    
    @pytest.mark.asyncio
    async def test_send_schedule_notifications_email_only(
        self, notification_service, sample_draft, sample_assignments
    ):
        """Test sending notifications via email only"""
        
        notification_service.email_service.send_email.return_value = {
            "success": True,
            "message_id": "email_123"
        }
        
        notification_settings = {
            "channels": ["email"],
            "notify_all_staff": True
        }
        
        result = await notification_service.send_schedule_notifications(
            sample_draft.id, notification_settings
        )
        
        assert result["success"] is True
        assert result["notifications_sent"] == 3
        
        # Verify email service was called
        assert notification_service.email_service.send_email.call_count == 3
    
    @pytest.mark.asyncio
    async def test_send_schedule_notifications_invalid_draft(
        self, notification_service
    ):
        """Test handling of invalid draft ID"""
        
        result = await notification_service.send_schedule_notifications(
            "invalid-draft-id", {"channels": ["whatsapp"]}
        )
        
        assert result["success"] is False
        assert "not found" in result["error"]
        assert result["notifications_sent"] == 0
    
    @pytest.mark.asyncio
    async def test_send_schedule_notifications_no_assignments(
        self, notification_service, sample_draft
    ):
        """Test handling of draft with no assignments"""
        
        result = await notification_service.send_schedule_notifications(
            sample_draft.id, {"channels": ["whatsapp"]}
        )
        
        assert result["success"] is True
        assert result["notifications_sent"] == 0
        assert "No staff assignments" in result["message"]
    
    @pytest.mark.asyncio
    async def test_generate_schedule_message_content(
        self, notification_service, sample_staff, sample_assignments, sample_draft
    ):
        """Test schedule message content generation"""
        
        staff = sample_staff[0]
        staff_assignments = [sample_assignments[0]]  # Just one assignment
        settings = {
            "custom_message": "Great work this week!"
        }
        
        message = await notification_service._generate_schedule_message(
            staff, staff_assignments, sample_draft, settings
        )
        
        assert staff.name in message
        assert "Test Restaurant" in message
        assert "January 15" in message
        assert "09:00 - 17:00" in message
        assert "Great work this week!" in message
        assert "Front Of House" in message
    
    @pytest.mark.asyncio
    async def test_send_schedule_change_notifications(
        self, notification_service, sample_draft, sample_shifts, sample_staff
    ):
        """Test sending change notifications"""
        
        notification_service.whatsapp_service.send_coverage_request.return_value = {
            "success": True,
            "message_id": "whatsapp_change_123"
        }
        
        changes = [
            {
                "shift_id": sample_shifts[0].id,
                "action": "assign",
                "staff_id": sample_staff[0].id,
                "previous_staff_id": None
            },
            {
                "shift_id": sample_shifts[1].id,
                "action": "unassign",
                "staff_id": None,
                "previous_staff_id": sample_staff[1].id
            }
        ]
        
        notification_settings = {
            "channels": ["whatsapp"]
        }
        
        result = await notification_service.send_schedule_change_notifications(
            sample_draft.id, changes, notification_settings
        )
        
        assert result["success"] is True
        assert result["notifications_sent"] == 2  # 2 affected staff members
        assert len(result["results"]) == 2
    
    @pytest.mark.asyncio
    async def test_generate_change_summary(
        self, notification_service, sample_shifts, sample_staff, db_session
    ):
        """Test change summary generation"""
        
        staff_id = sample_staff[0].id  # Use actual staff ID from fixture
        
        changes = [
            {
                "shift_id": sample_shifts[0].id,
                "action": "assign",
                "staff_id": staff_id,
                "previous_staff_id": None
            },
            {
                "shift_id": sample_shifts[1].id,
                "action": "unassign",
                "staff_id": None,
                "previous_staff_id": staff_id
            }
        ]
        
        summary = await notification_service._generate_change_summary(
            staff_id, changes, "test-draft-123"
        )
        
        assert summary["has_changes"] is True
        assert len(summary["changes"]) == 2
        assert "✅ Added:" in summary["changes"][0]
        assert "❌ Removed:" in summary["changes"][1]
        assert "John Doe" in summary["message"]
    
    @pytest.mark.asyncio
    async def test_multi_channel_notification_with_preferences(
        self, notification_service, sample_staff
    ):
        """Test multi-channel notification respects channel preferences"""
        
        staff = sample_staff[0]
        message = "Test notification message"
        channels = ["whatsapp", "sms", "email"]
        
        # Mock WhatsApp success (should stop after first success)
        notification_service.whatsapp_service.send_coverage_request.return_value = {
            "success": True,
            "message_id": "whatsapp_123"
        }
        
        results = await notification_service._send_multi_channel_notification(
            staff, message, channels, "test-draft-123", "new_schedule"
        )
        
        # Should only try WhatsApp since it succeeded
        assert len(results) == 1
        assert results[0]["channel"] == "whatsapp"
        assert results[0]["success"] is True
        
        # SMS and email should not be called
        notification_service.sms_service.send_sms.assert_not_called()
        notification_service.email_service.send_email.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_notification_logging_to_database(
        self, notification_service, sample_staff, db_session
    ):
        """Test that notifications are properly logged to database"""
        
        staff = sample_staff[0]
        message = "Test notification"
        
        notification_service.whatsapp_service.send_coverage_request.return_value = {
            "success": True,
            "message_id": "whatsapp_log_123"
        }
        
        await notification_service._send_whatsapp_notification(
            staff, message, "test-draft-123", "new_schedule"
        )
        
        # Check that notification was logged to database
        notification = db_session.query(ScheduleNotification).filter(
            ScheduleNotification.staff_id == staff.id
        ).first()
        
        assert notification is not None
        assert notification.channel == "whatsapp"
        assert notification.status == "sent"
        assert notification.content == message
        assert notification.external_id == "whatsapp_log_123"
    
    @pytest.mark.asyncio
    async def test_get_notification_status(
        self, notification_service, sample_draft, sample_staff, db_session
    ):
        """Test getting notification status for a draft"""
        
        # Create some test notifications
        notifications = [
            ScheduleNotification(
                draft_id=sample_draft.id,
                staff_id=sample_staff[0].id,
                notification_type="new_schedule",
                channel="whatsapp",
                content="Test message 1",
                status="sent",
                sent_at=datetime.now()
            ),
            ScheduleNotification(
                draft_id=sample_draft.id,
                staff_id=sample_staff[1].id,
                notification_type="new_schedule",
                channel="sms",
                content="Test message 2",
                status="failed"
            )
        ]
        
        for notification in notifications:
            db_session.add(notification)
        db_session.commit()
        
        status = await notification_service.get_notification_status(sample_draft.id)
        
        assert status["draft_id"] == sample_draft.id
        assert status["total_notifications"] == 2
        assert status["status_summary"]["sent"] == 1
        assert status["status_summary"]["failed"] == 1
        assert status["channel_summary"]["whatsapp"] == 1
        assert status["channel_summary"]["sms"] == 1
    
    @pytest.mark.asyncio
    async def test_retry_failed_notifications(
        self, notification_service, sample_draft, sample_staff, db_session
    ):
        """Test retrying failed notifications"""
        
        # Create a failed notification
        failed_notification = ScheduleNotification(
            draft_id=sample_draft.id,
            staff_id=sample_staff[0].id,
            notification_type="new_schedule",
            channel="whatsapp",
            content="Failed message",
            status="failed"
        )
        db_session.add(failed_notification)
        db_session.commit()
        
        # Mock successful retry
        notification_service.whatsapp_service.send_coverage_request.return_value = {
            "success": True,
            "message_id": "retry_123"
        }
        
        result = await notification_service.retry_failed_notifications(sample_draft.id)
        
        assert result["success"] is True
        assert result["retried"] == 1
        assert result["successful_retries"] == 1
        
        # Check that notification status was updated
        db_session.refresh(failed_notification)
        assert failed_notification.status == "sent"
        assert failed_notification.external_id == "retry_123"


class TestScheduleChangeDetector:
    """Test cases for ScheduleChangeDetector"""
    
    @pytest.fixture
    def change_detector(self, db_session):
        return ScheduleChangeDetector(db_session)
    
    def test_detect_new_assignments(self, change_detector):
        """Test detecting new assignments"""
        
        original_assignments = []
        updated_assignments = [
            Mock(shift_id=1, staff_id=10),
            Mock(shift_id=2, staff_id=20)
        ]
        
        changes = change_detector.detect_changes(original_assignments, updated_assignments)
        
        assert len(changes) == 2
        assert changes[0]["action"] == "assign"
        assert changes[0]["shift_id"] == 1
        assert changes[0]["staff_id"] == 10
        assert changes[0]["previous_staff_id"] is None
    
    def test_detect_removed_assignments(self, change_detector):
        """Test detecting removed assignments"""
        
        original_assignments = [
            Mock(shift_id=1, staff_id=10),
            Mock(shift_id=2, staff_id=20)
        ]
        updated_assignments = []
        
        changes = change_detector.detect_changes(original_assignments, updated_assignments)
        
        assert len(changes) == 2
        assert changes[0]["action"] == "unassign"
        assert changes[0]["shift_id"] == 1
        assert changes[0]["previous_staff_id"] == 10
        assert changes[0]["staff_id"] is None
    
    def test_detect_staff_changes(self, change_detector):
        """Test detecting staff reassignments"""
        
        original_assignments = [
            Mock(shift_id=1, staff_id=10),
            Mock(shift_id=2, staff_id=20)
        ]
        updated_assignments = [
            Mock(shift_id=1, staff_id=15),  # Staff changed
            Mock(shift_id=2, staff_id=20)   # No change
        ]
        
        changes = change_detector.detect_changes(original_assignments, updated_assignments)
        
        assert len(changes) == 1
        assert changes[0]["action"] == "reassign"
        assert changes[0]["shift_id"] == 1
        assert changes[0]["previous_staff_id"] == 10
        assert changes[0]["staff_id"] == 15
    
    def test_detect_no_changes(self, change_detector):
        """Test when there are no changes"""
        
        assignments = [
            Mock(shift_id=1, staff_id=10),
            Mock(shift_id=2, staff_id=20)
        ]
        
        changes = change_detector.detect_changes(assignments, assignments)
        
        assert len(changes) == 0


class TestNotificationServiceIntegration:
    """Integration tests for NotificationService"""
    
    @pytest.mark.asyncio
    async def test_complete_notification_workflow(
        self, db_session, sample_business, sample_staff, sample_shifts
    ):
        """Test complete notification workflow from draft creation to delivery"""
        
        # Create notification service with real database
        service = NotificationService(db_session)
        
        # Mock external services
        service.whatsapp_service = AsyncMock()
        service.whatsapp_service.send_coverage_request.return_value = {
            "success": True,
            "message_id": "integration_test_123"
        }
        
        # Create draft and assignments
        draft = ScheduleDraft(
            id="integration-test-draft",
            business_id=sample_business.id,
            created_by=sample_staff[0].id,
            date_range_start=date(2024, 1, 15),
            date_range_end=date(2024, 1, 21),
            status="draft",
            ai_generated=True
        )
        db_session.add(draft)
        
        assignment = DraftShiftAssignment(
            draft_id=draft.id,
            shift_id=sample_shifts[0].id,
            staff_id=sample_staff[0].id,
            confidence_score=0.9,
            reasoning="Test assignment"
        )
        db_session.add(assignment)
        db_session.commit()
        
        # Send notifications
        result = await service.send_schedule_notifications(
            draft.id,
            {"channels": ["whatsapp"], "notify_all_staff": True}
        )
        
        # Verify results
        assert result["success"] is True
        assert result["notifications_sent"] == 1
        
        # Verify database logging
        notification = db_session.query(ScheduleNotification).filter(
            ScheduleNotification.draft_id == draft.id
        ).first()
        
        assert notification is not None
        assert notification.status == "sent"
        assert notification.external_id == "integration_test_123"
        
        # Test status retrieval
        status = await service.get_notification_status(draft.id)
        assert status["total_notifications"] == 1
        assert status["status_summary"]["sent"] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])