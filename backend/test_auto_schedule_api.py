"""
Integration tests for Auto-Schedule API endpoints

Tests all four auto-schedule endpoints:
1. POST /api/auto-schedule/{business_id}/generate
2. GET /api/auto-schedule/{business_id}/draft/{draft_id}
3. PUT /api/auto-schedule/{business_id}/draft/{draft_id}
4. POST /api/auto-schedule/{business_id}/publish/{draft_id}
"""

import pytest
import json
from datetime import datetime, date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch, AsyncMock

from main import app, get_db
from database import Base
from models import (
    Business, Staff, Shift, ScheduleDraft, DraftShiftAssignment,
    ScheduleNotification, ShiftAssignment
)

# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_auto_schedule.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module")
def setup_database():
    """Set up test database with sample data"""
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    
    # Create test business
    business = Business(
        id=1,
        name="Test Restaurant",
        type="restaurant",
        phone_number="+1234567890",
        email="test@restaurant.com",
        is_active=True
    )
    db.add(business)
    
    # Create test staff
    staff_members = [
        Staff(
            id=1,
            business_id=1,
            name="John Chef",
            phone_number="+1234567891",
            email="john@test.com",
            role="chef",
            skills=["kitchen", "grill"],
            availability={"monday": ["09:00-17:00"], "tuesday": ["09:00-17:00"]},
            reliability_score=8.5,
            is_active=True
        ),
        Staff(
            id=2,
            business_id=1,
            name="Jane Server",
            phone_number="+1234567892",
            email="jane@test.com",
            role="server",
            skills=["front_of_house", "bar"],
            availability={"monday": ["17:00-23:00"], "tuesday": ["17:00-23:00"]},
            reliability_score=9.0,
            is_active=True
        ),
        Staff(
            id=3,
            business_id=1,
            name="Bob Bartender",
            phone_number="+1234567893",
            email="bob@test.com",
            role="bartender",
            skills=["bar", "cocktails"],
            availability={"monday": ["18:00-02:00"], "tuesday": ["18:00-02:00"]},
            reliability_score=7.5,
            is_active=True
        )
    ]
    
    for staff in staff_members:
        db.add(staff)
    
    # Create test shifts
    tomorrow = date.today() + timedelta(days=1)
    day_after = date.today() + timedelta(days=2)
    
    shifts = [
        Shift(
            id=1,
            business_id=1,
            title="Morning Kitchen",
            date=datetime.combine(tomorrow, datetime.min.time()),
            start_time="09:00",
            end_time="17:00",
            required_skill="kitchen",
            required_staff_count=1,
            hourly_rate=18.0,
            status="scheduled"
        ),
        Shift(
            id=2,
            business_id=1,
            title="Evening Service",
            date=datetime.combine(tomorrow, datetime.min.time()),
            start_time="17:00",
            end_time="23:00",
            required_skill="front_of_house",
            required_staff_count=1,
            hourly_rate=15.0,
            status="scheduled"
        ),
        Shift(
            id=3,
            business_id=1,
            title="Night Bar",
            date=datetime.combine(day_after, datetime.min.time()),
            start_time="18:00",
            end_time="02:00",
            required_skill="bar",
            required_staff_count=1,
            hourly_rate=20.0,
            status="scheduled"
        )
    ]
    
    for shift in shifts:
        db.add(shift)
    
    db.commit()
    db.close()
    
    yield
    
    # Cleanup
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)

@pytest.fixture
def sample_auto_schedule_request():
    """Sample auto-schedule request data"""
    tomorrow = date.today() + timedelta(days=1)
    day_after = date.today() + timedelta(days=2)
    
    return {
        "date_range_start": tomorrow.isoformat(),
        "date_range_end": day_after.isoformat(),
        "special_events": [
            {
                "date": tomorrow.isoformat(),
                "name": "Happy Hour",
                "expected_impact": "medium",
                "description": "Extended happy hour promotion"
            }
        ],
        "staff_notes": [
            {
                "staff_id": 1,
                "note": "Prefers morning shifts",
                "date": tomorrow.isoformat()
            }
        ],
        "constraints": {
            "max_hours_per_week": 40,
            "min_rest_hours": 8
        }
    }

class TestAutoScheduleGeneration:
    """Test auto-schedule generation endpoint"""
    
    @patch('services.ai_scheduling_engine.AISchedulingEngine.generate_schedule')
    def test_generate_auto_schedule_success(self, mock_generate, setup_database, client, sample_auto_schedule_request):
        """Test successful schedule generation"""
        from services.ai_scheduling_engine import ScheduleGenerationResult
        
        # Mock the AI scheduling engine response
        mock_result = ScheduleGenerationResult(
            draft_id="test-draft-123",
            assignments=[],
            overall_confidence=0.85,
            generation_summary={
                "total_shifts": 3,
                "assigned_shifts": 2,
                "unassigned_shifts": 1
            },
            warnings=["One shift remains unassigned"],
            recommendations=["Consider hiring more kitchen staff"]
        )
        mock_generate.return_value = mock_result
        
        response = client.post(
            "/api/auto-schedule/1/generate",
            json=sample_auto_schedule_request
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["draft_id"] == "test-draft-123"
        assert data["total_shifts"] == 3
        assert data["assigned_shifts"] == 2
        assert data["unassigned_shifts"] == 1
        assert data["overall_confidence"] == 0.85
        assert len(data["warnings"]) == 1
        assert len(data["recommendations"]) == 1
    
    def test_generate_auto_schedule_invalid_business(self, setup_database, client, sample_auto_schedule_request):
        """Test schedule generation with invalid business ID"""
        response = client.post(
            "/api/auto-schedule/999/generate",
            json=sample_auto_schedule_request
        )
        
        assert response.status_code == 404
        assert "Business not found" in response.json()["detail"]
    
    def test_generate_auto_schedule_invalid_dates(self, setup_database, client):
        """Test schedule generation with invalid date format"""
        invalid_request = {
            "date_range_start": "invalid-date",
            "date_range_end": "2024-01-15",
            "special_events": [],
            "staff_notes": [],
            "constraints": {}
        }
        
        response = client.post(
            "/api/auto-schedule/1/generate",
            json=invalid_request
        )
        
        assert response.status_code == 500
        assert "Schedule generation failed" in response.json()["detail"]

class TestScheduleDraftRetrieval:
    """Test schedule draft retrieval endpoint"""
    
    def test_get_schedule_draft_success(self, setup_database, client):
        """Test successful draft retrieval"""
        # Create a test draft
        db = TestingSessionLocal()
        
        draft = ScheduleDraft(
            id="test-draft-456",
            business_id=1,
            created_by=1,
            date_range_start=date.today() + timedelta(days=1),
            date_range_end=date.today() + timedelta(days=2),
            status="draft",
            ai_generated=True,
            confidence_score=0.75
        )
        db.add(draft)
        
        # Add draft assignments
        assignment = DraftShiftAssignment(
            draft_id="test-draft-456",
            shift_id=1,
            staff_id=1,
            confidence_score=0.8,
            reasoning="Good skill match",
            is_ai_generated=True,
            manual_override=False
        )
        db.add(assignment)
        
        db.commit()
        db.close()
        
        response = client.get("/api/auto-schedule/1/draft/test-draft-456")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == "test-draft-456"
        assert data["business_id"] == 1
        assert data["status"] == "draft"
        assert data["ai_generated"] == True
        assert data["confidence_score"] == 0.75
        assert len(data["assignments"]) == 1
        
        assignment_data = data["assignments"][0]
        assert assignment_data["shift_id"] == 1
        assert assignment_data["staff_id"] == 1
        assert assignment_data["staff_name"] == "John Chef"
        assert assignment_data["confidence_score"] == 0.8
    
    def test_get_schedule_draft_not_found(self, setup_database, client):
        """Test draft retrieval with non-existent draft"""
        response = client.get("/api/auto-schedule/1/draft/non-existent-draft")
        
        assert response.status_code == 404
        assert "Draft schedule not found" in response.json()["detail"]
    
    def test_get_schedule_draft_wrong_business(self, setup_database, client):
        """Test draft retrieval with wrong business ID"""
        # Create a draft for business 1
        db = TestingSessionLocal()
        draft = ScheduleDraft(
            id="test-draft-789",
            business_id=1,
            created_by=1,
            date_range_start=date.today() + timedelta(days=1),
            date_range_end=date.today() + timedelta(days=2),
            status="draft"
        )
        db.add(draft)
        db.commit()
        db.close()
        
        # Try to access with business 2
        response = client.get("/api/auto-schedule/2/draft/test-draft-789")
        
        assert response.status_code == 404

class TestScheduleDraftUpdate:
    """Test schedule draft update endpoint"""
    
    def test_update_schedule_draft_assign(self, setup_database, client):
        """Test assigning staff to shift in draft"""
        # Create a test draft
        db = TestingSessionLocal()
        draft = ScheduleDraft(
            id="test-draft-update",
            business_id=1,
            created_by=1,
            date_range_start=date.today() + timedelta(days=1),
            date_range_end=date.today() + timedelta(days=2),
            status="draft"
        )
        db.add(draft)
        db.commit()
        db.close()
        
        changes = [
            {
                "shift_id": 1,  # Morning Kitchen shift requiring "kitchen" skill
                "staff_id": 1,  # John Chef with "kitchen" skill
                "action": "assign",
                "reasoning": "Manual assignment for better coverage"
            }
        ]
        
        response = client.put(
            "/api/auto-schedule/1/draft/test-draft-update",
            json=changes
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that assignment was created
        assert len(data["assignments"]) == 1
        assignment = data["assignments"][0]
        assert assignment["shift_id"] == 1
        assert assignment["staff_id"] == 1
        assert assignment["staff_name"] == "John Chef"
        assert assignment["manual_override"] == True
    
    def test_update_schedule_draft_unassign(self, setup_database, client):
        """Test unassigning staff from shift in draft"""
        # Create a test draft with assignment
        db = TestingSessionLocal()
        draft = ScheduleDraft(
            id="test-draft-unassign",
            business_id=1,
            created_by=1,
            date_range_start=date.today() + timedelta(days=1),
            date_range_end=date.today() + timedelta(days=2),
            status="draft"
        )
        db.add(draft)
        
        assignment = DraftShiftAssignment(
            id=100,
            draft_id="test-draft-unassign",
            shift_id=1,
            staff_id=1,
            confidence_score=0.8
        )
        db.add(assignment)
        db.commit()
        db.close()
        
        changes = [
            {
                "assignment_id": 100,
                "shift_id": 1,
                "action": "unassign"
            }
        ]
        
        response = client.put(
            "/api/auto-schedule/1/draft/test-draft-unassign",
            json=changes
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that assignment was removed
        assert len(data["assignments"]) == 0
    
    def test_update_schedule_draft_modify(self, setup_database, client):
        """Test modifying existing assignment in draft"""
        # Create a test draft with assignment
        db = TestingSessionLocal()
        draft = ScheduleDraft(
            id="test-draft-modify",
            business_id=1,
            created_by=1,
            date_range_start=date.today() + timedelta(days=1),
            date_range_end=date.today() + timedelta(days=2),
            status="draft"
        )
        db.add(draft)
        
        assignment = DraftShiftAssignment(
            id=101,
            draft_id="test-draft-modify",
            shift_id=1,
            staff_id=1,
            confidence_score=0.8,
            reasoning="Original assignment"
        )
        db.add(assignment)
        db.commit()
        db.close()
        
        changes = [
            {
                "assignment_id": 101,
                "shift_id": 1,
                "staff_id": 2,
                "action": "modify",
                "reasoning": "Changed to better staff member"
            }
        ]
        
        response = client.put(
            "/api/auto-schedule/1/draft/test-draft-modify",
            json=changes
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that assignment was modified
        assert len(data["assignments"]) == 1
        assignment = data["assignments"][0]
        assert assignment["staff_id"] == 2
        assert assignment["staff_name"] == "Jane Server"
        assert assignment["manual_override"] == True
    
    def test_update_schedule_draft_published(self, setup_database, client):
        """Test updating already published draft (should fail)"""
        # Create a published draft
        db = TestingSessionLocal()
        draft = ScheduleDraft(
            id="test-draft-published",
            business_id=1,
            created_by=1,
            date_range_start=date.today() + timedelta(days=1),
            date_range_end=date.today() + timedelta(days=2),
            status="published"
        )
        db.add(draft)
        db.commit()
        db.close()
        
        changes = [
            {
                "shift_id": 1,
                "staff_id": 1,
                "action": "assign"
            }
        ]
        
        response = client.put(
            "/api/auto-schedule/1/draft/test-draft-published",
            json=changes
        )
        
        assert response.status_code == 404
        assert "already published" in response.json()["detail"]

class TestSchedulePublishing:
    """Test schedule publishing endpoint"""
    
    def test_publish_schedule_success(self, setup_database, client):
        """Test successful schedule publishing"""
        # Create a test draft with assignments
        db = TestingSessionLocal()
        draft = ScheduleDraft(
            id="test-draft-publish",
            business_id=1,
            created_by=1,
            date_range_start=date.today() + timedelta(days=1),
            date_range_end=date.today() + timedelta(days=2),
            status="draft"
        )
        db.add(draft)
        
        assignments = [
            DraftShiftAssignment(
                draft_id="test-draft-publish",
                shift_id=1,
                staff_id=1,
                confidence_score=0.8
            ),
            DraftShiftAssignment(
                draft_id="test-draft-publish",
                shift_id=2,
                staff_id=2,
                confidence_score=0.9
            )
        ]
        
        for assignment in assignments:
            db.add(assignment)
        
        db.commit()
        db.close()
        
        notification_settings = {
            "notify_all_staff": True,
            "channels": ["whatsapp", "email"],
            "custom_message": "New schedule is ready!"
        }
        
        response = client.post(
            "/api/auto-schedule/1/publish/test-draft-publish",
            json=notification_settings
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["notifications_sent"] == 2  # Two unique staff members
        assert data["failed_notifications"] == 0
        assert "published successfully" in data["message"]
        
        # Verify draft status was updated
        db = TestingSessionLocal()
        updated_draft = db.query(ScheduleDraft).filter(
            ScheduleDraft.id == "test-draft-publish"
        ).first()
        assert updated_draft.status == "published"
        assert updated_draft.published_at is not None
        
        # Verify shift assignments were created
        published_assignments = db.query(ShiftAssignment).filter(
            ShiftAssignment.shift_id.in_([1, 2])
        ).all()
        assert len(published_assignments) == 2
        
        db.close()
    
    def test_publish_schedule_not_found(self, setup_database, client):
        """Test publishing non-existent draft"""
        notification_settings = {
            "notify_all_staff": True,
            "channels": ["whatsapp"]
        }
        
        response = client.post(
            "/api/auto-schedule/1/publish/non-existent-draft",
            json=notification_settings
        )
        
        assert response.status_code == 404
        assert "Draft schedule not found" in response.json()["detail"]
    
    def test_publish_schedule_already_published(self, setup_database, client):
        """Test publishing already published draft"""
        # Create a published draft
        db = TestingSessionLocal()
        draft = ScheduleDraft(
            id="test-draft-already-published",
            business_id=1,
            created_by=1,
            date_range_start=date.today() + timedelta(days=1),
            date_range_end=date.today() + timedelta(days=2),
            status="published"
        )
        db.add(draft)
        db.commit()
        db.close()
        
        notification_settings = {
            "notify_all_staff": False,
            "channels": []
        }
        
        response = client.post(
            "/api/auto-schedule/1/publish/test-draft-already-published",
            json=notification_settings
        )
        
        assert response.status_code == 404
        assert "already published" in response.json()["detail"]
    
    def test_publish_schedule_no_notifications(self, setup_database, client):
        """Test publishing without sending notifications"""
        # Create a test draft
        db = TestingSessionLocal()
        draft = ScheduleDraft(
            id="test-draft-no-notify",
            business_id=1,
            created_by=1,
            date_range_start=date.today() + timedelta(days=1),
            date_range_end=date.today() + timedelta(days=2),
            status="draft"
        )
        db.add(draft)
        
        assignment = DraftShiftAssignment(
            draft_id="test-draft-no-notify",
            shift_id=1,
            staff_id=1,
            confidence_score=0.8
        )
        db.add(assignment)
        db.commit()
        db.close()
        
        notification_settings = {
            "notify_all_staff": False,
            "channels": []
        }
        
        response = client.post(
            "/api/auto-schedule/1/publish/test-draft-no-notify",
            json=notification_settings
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["notifications_sent"] == 0
        assert data["failed_notifications"] == 0

class TestAutoScheduleIntegration:
    """Integration tests for complete auto-schedule workflow"""
    
    @patch('services.ai_scheduling_engine.AISchedulingEngine.generate_schedule')
    def test_complete_auto_schedule_workflow(self, mock_generate, setup_database, client, sample_auto_schedule_request):
        """Test complete workflow from generation to publishing"""
        from services.ai_scheduling_engine import ScheduleGenerationResult
        
        # Step 1: Generate schedule
        mock_result = ScheduleGenerationResult(
            draft_id="workflow-test-draft",
            assignments=[],
            overall_confidence=0.85,
            generation_summary={
                "total_shifts": 3,
                "assigned_shifts": 3,
                "unassigned_shifts": 0
            },
            warnings=[],
            recommendations=[]
        )
        mock_generate.return_value = mock_result
        
        # Create the draft manually for testing
        db = TestingSessionLocal()
        draft = ScheduleDraft(
            id="workflow-test-draft",
            business_id=1,
            created_by=1,
            date_range_start=date.fromisoformat(sample_auto_schedule_request["date_range_start"]),
            date_range_end=date.fromisoformat(sample_auto_schedule_request["date_range_end"]),
            status="draft",
            ai_generated=True,
            confidence_score=0.85
        )
        db.add(draft)
        
        # Add some assignments
        assignments = [
            DraftShiftAssignment(
                draft_id="workflow-test-draft",
                shift_id=1,
                staff_id=1,
                confidence_score=0.9
            ),
            DraftShiftAssignment(
                draft_id="workflow-test-draft",
                shift_id=2,
                staff_id=2,
                confidence_score=0.8
            )
        ]
        for assignment in assignments:
            db.add(assignment)
        
        db.commit()
        db.close()
        
        # Generate schedule
        gen_response = client.post(
            "/api/auto-schedule/1/generate",
            json=sample_auto_schedule_request
        )
        assert gen_response.status_code == 200
        
        # Step 2: Retrieve draft
        draft_response = client.get("/api/auto-schedule/1/draft/workflow-test-draft")
        assert draft_response.status_code == 200
        draft_data = draft_response.json()
        assert len(draft_data["assignments"]) == 2
        
        # Step 3: Update draft (add one more assignment)
        changes = [
            {
                "shift_id": 3,
                "staff_id": 3,
                "action": "assign",
                "reasoning": "Manual assignment for bar shift"
            }
        ]
        
        update_response = client.put(
            "/api/auto-schedule/1/draft/workflow-test-draft",
            json=changes
        )
        assert update_response.status_code == 200
        updated_data = update_response.json()
        assert len(updated_data["assignments"]) == 3
        
        # Step 4: Publish schedule
        notification_settings = {
            "notify_all_staff": True,
            "channels": ["whatsapp"],
            "custom_message": "Your new schedule is ready!"
        }
        
        publish_response = client.post(
            "/api/auto-schedule/1/publish/workflow-test-draft",
            json=notification_settings
        )
        assert publish_response.status_code == 200
        publish_data = publish_response.json()
        
        assert publish_data["success"] == True
        assert publish_data["notifications_sent"] == 3  # Three unique staff members
        
        # Verify final state
        final_draft_response = client.get("/api/auto-schedule/1/draft/workflow-test-draft")
        assert final_draft_response.status_code == 200
        final_data = final_draft_response.json()
        assert final_data["status"] == "published"
        assert final_data["published_at"] is not None

if __name__ == "__main__":
    pytest.main([__file__, "-v"])