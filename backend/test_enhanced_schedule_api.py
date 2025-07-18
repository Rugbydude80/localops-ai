import pytest
import asyncio
import json
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocket
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, date, timedelta
from unittest.mock import AsyncMock, patch

from main import app, get_db
from database import Base
from models import Business, Staff, Shift, ShiftAssignment, ScheduleDraft, DraftShiftAssignment

# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_enhanced_schedule.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture
def db_session():
    """Create a fresh database session for each test"""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def sample_business(db_session):
    """Create a sample business for testing"""
    business = Business(
        name="Test Restaurant",
        type="restaurant",
        phone_number="+1234567890",
        email="test@restaurant.com",
        is_active=True
    )
    db_session.add(business)
    db_session.commit()
    db_session.refresh(business)
    return business

@pytest.fixture
def sample_staff(db_session, sample_business):
    """Create sample staff members for testing"""
    staff_members = []
    
    # Manager
    manager = Staff(
        business_id=sample_business.id,
        name="John Manager",
        phone_number="+1234567891",
        email="john@restaurant.com",
        role="manager",
        skills=["management", "kitchen", "front_of_house"],
        availability={"monday": ["09:00-17:00"], "tuesday": ["09:00-17:00"]},
        is_active=True,
        can_assign_shifts=True
    )
    staff_members.append(manager)
    
    # Chef
    chef = Staff(
        business_id=sample_business.id,
        name="Jane Chef",
        phone_number="+1234567892",
        email="jane@restaurant.com",
        role="chef",
        skills=["kitchen", "food_prep"],
        availability={"monday": ["10:00-18:00"], "tuesday": ["10:00-18:00"]},
        is_active=True
    )
    staff_members.append(chef)
    
    # Server
    server = Staff(
        business_id=sample_business.id,
        name="Bob Server",
        phone_number="+1234567893",
        email="bob@restaurant.com",
        role="server",
        skills=["front_of_house", "customer_service"],
        availability={"monday": ["11:00-19:00"], "tuesday": ["11:00-19:00"]},
        is_active=True
    )
    staff_members.append(server)
    
    for staff in staff_members:
        db_session.add(staff)
    
    db_session.commit()
    
    for staff in staff_members:
        db_session.refresh(staff)
    
    return staff_members

@pytest.fixture
def sample_shifts(db_session, sample_business):
    """Create sample shifts for testing"""
    shifts = []
    
    # Morning shift
    morning_shift = Shift(
        business_id=sample_business.id,
        title="Morning Kitchen",
        date=datetime.now() + timedelta(days=1),
        start_time="09:00",
        end_time="15:00",
        required_skill="kitchen",
        required_staff_count=2,
        hourly_rate=15.0,
        status="scheduled"
    )
    shifts.append(morning_shift)
    
    # Evening shift
    evening_shift = Shift(
        business_id=sample_business.id,
        title="Evening Service",
        date=datetime.now() + timedelta(days=1),
        start_time="17:00",
        end_time="23:00",
        required_skill="front_of_house",
        required_staff_count=3,
        hourly_rate=12.0,
        status="scheduled"
    )
    shifts.append(evening_shift)
    
    for shift in shifts:
        db_session.add(shift)
    
    db_session.commit()
    
    for shift in shifts:
        db_session.refresh(shift)
    
    return shifts

@pytest.fixture
def sample_draft(db_session, sample_business, sample_staff):
    """Create a sample schedule draft for testing"""
    draft = ScheduleDraft(
        business_id=sample_business.id,
        created_by=sample_staff[0].id,  # Manager
        date_range_start=date.today() + timedelta(days=1),
        date_range_end=date.today() + timedelta(days=7),
        status="draft",
        ai_generated=True,
        confidence_score=0.85
    )
    db_session.add(draft)
    db_session.commit()
    db_session.refresh(draft)
    return draft

class TestEnhancedCalendarAPI:
    """Test enhanced calendar API with draft schedule support"""
    
    def test_get_calendar_view_basic(self, sample_business, sample_shifts):
        """Test basic calendar view without drafts"""
        start_date = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        end_date = (datetime.now() + timedelta(days=2)).strftime('%Y-%m-%d')
        
        response = client.get(
            f"/api/schedule/{sample_business.id}/calendar",
            params={"start_date": start_date, "end_date": end_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "calendar" in data
        assert "date_range" in data
        assert data["date_range"]["start"] == start_date
        assert data["date_range"]["end"] == end_date
        
        # Check calendar structure
        calendar = data["calendar"]
        assert len(calendar) == 2  # Two days
        
        for date_str, day_data in calendar.items():
            assert "shifts" in day_data
            assert "total_shifts" in day_data
            assert "filled_shifts" in day_data
            assert "understaffed_shifts" in day_data
            assert "draft_shifts" in day_data
    
    def test_get_calendar_view_with_draft(self, sample_business, sample_shifts, sample_draft, sample_staff):
        """Test calendar view with draft schedule"""
        # Create draft assignment
        draft_assignment = DraftShiftAssignment(
            draft_id=sample_draft.id,
            shift_id=sample_shifts[0].id,
            staff_id=sample_staff[1].id,  # Chef
            confidence_score=0.9,
            reasoning="AI assigned based on skills and availability",
            is_ai_generated=True
        )
        
        db_session = TestingSessionLocal()
        db_session.add(draft_assignment)
        db_session.commit()
        db_session.close()
        
        start_date = sample_draft.date_range_start.strftime('%Y-%m-%d')
        end_date = sample_draft.date_range_end.strftime('%Y-%m-%d')
        
        response = client.get(
            f"/api/schedule/{sample_business.id}/calendar",
            params={
                "start_date": start_date,
                "end_date": end_date,
                "draft_id": sample_draft.id
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "draft_info" in data
        assert data["draft_info"]["id"] == sample_draft.id
        assert data["draft_info"]["confidence_score"] == 0.85
        
        # Check for draft assignments in shifts
        calendar = data["calendar"]
        found_draft_assignment = False
        
        for day_data in calendar.values():
            for shift in day_data["shifts"]:
                if shift["draft_assignments"]:
                    found_draft_assignment = True
                    draft_assign = shift["draft_assignments"][0]
                    assert draft_assign["confidence_score"] == 0.9
                    assert draft_assign["is_ai_generated"] is True
                    assert "reasoning" in draft_assign
        
        assert found_draft_assignment, "Draft assignment should be found in calendar"

class TestEnhancedShiftManagement:
    """Test enhanced shift creation and management"""
    
    @patch('main.broadcast_schedule_update')
    def test_create_shift_with_draft(self, mock_broadcast, sample_business, sample_draft):
        """Test creating a shift with draft integration"""
        shift_data = {
            "business_id": sample_business.id,  # Include business_id in schema
            "title": "Test Shift",
            "date": (datetime.now() + timedelta(days=2)).isoformat(),
            "start_time": "10:00",
            "end_time": "16:00",
            "required_skill": "kitchen",
            "required_staff_count": 1,
            "hourly_rate": 15.0,
            "notes": "Test shift for draft"
        }
        
        response = client.post(
            f"/api/schedule/{sample_business.id}/shifts",
            json=shift_data,
            params={"draft_id": sample_draft.id}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["title"] == "Test Shift"
        assert data["business_id"] == sample_business.id
        assert data["status"] == "scheduled"
        
        # Verify broadcast was called
        mock_broadcast.assert_called_once()
        call_args = mock_broadcast.call_args
        assert call_args[0][0] == sample_business.id  # business_id
        assert call_args[0][1] == sample_draft.id     # draft_id
        assert call_args[0][2]["type"] == "shift_created"
    
    def test_create_shift_without_draft(self, sample_business):
        """Test creating a shift without draft integration"""
        shift_data = {
            "business_id": sample_business.id,  # Include business_id in schema
            "title": "Regular Shift",
            "date": (datetime.now() + timedelta(days=3)).isoformat(),
            "start_time": "12:00",
            "end_time": "18:00",
            "required_skill": "front_of_house",
            "required_staff_count": 2,
            "hourly_rate": 12.0
        }
        
        response = client.post(
            f"/api/schedule/{sample_business.id}/shifts",
            json=shift_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["title"] == "Regular Shift"
        assert data["business_id"] == sample_business.id

class TestEnhancedStaffAssignment:
    """Test enhanced staff assignment with draft support"""
    
    @patch('main.broadcast_schedule_update')
    def test_assign_staff_to_draft(self, mock_broadcast, sample_business, sample_shifts, sample_staff, sample_draft):
        """Test assigning staff to a shift in draft mode"""
        assignment_data = {
            "shift_id": sample_shifts[0].id,
            "staff_id": sample_staff[1].id  # Chef
        }
        
        response = client.post(
            f"/api/schedule/{sample_business.id}/shifts/{sample_shifts[0].id}/assign",
            json=assignment_data,
            params={"draft_id": sample_draft.id}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["shift_id"] == sample_shifts[0].id
        assert data["staff_id"] == sample_staff[1].id
        assert data["status"] == "assigned"
        
        # Verify broadcast was called
        mock_broadcast.assert_called_once()
        call_args = mock_broadcast.call_args
        assert call_args[0][2]["type"] == "staff_assigned"
        assert call_args[0][2]["is_draft"] is True
    
    @patch('main.broadcast_schedule_update')
    def test_assign_staff_regular(self, mock_broadcast, sample_business, sample_shifts, sample_staff):
        """Test assigning staff to a regular published shift"""
        assignment_data = {
            "shift_id": sample_shifts[1].id,
            "staff_id": sample_staff[2].id  # Server
        }
        
        response = client.post(
            f"/api/schedule/{sample_business.id}/shifts/{sample_shifts[1].id}/assign",
            json=assignment_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["shift_id"] == sample_shifts[1].id
        assert data["staff_id"] == sample_staff[2].id
        
        # Verify broadcast was called
        mock_broadcast.assert_called_once()
        call_args = mock_broadcast.call_args
        assert call_args[0][2]["is_draft"] is False
    
    def test_assign_staff_skill_mismatch(self, sample_business, sample_shifts, sample_staff):
        """Test assigning staff without required skill"""
        assignment_data = {
            "shift_id": sample_shifts[0].id,  # Kitchen shift
            "staff_id": sample_staff[2].id   # Server (no kitchen skill)
        }
        
        response = client.post(
            f"/api/schedule/{sample_business.id}/shifts/{sample_shifts[0].id}/assign",
            json=assignment_data
        )
        
        assert response.status_code == 400
        assert "does not have required skill" in response.json()["detail"]
    
    @patch('main.broadcast_schedule_update')
    def test_unassign_staff_from_draft(self, mock_broadcast, sample_business, sample_shifts, sample_staff, sample_draft):
        """Test removing staff assignment from draft"""
        # First create an assignment
        draft_assignment = DraftShiftAssignment(
            draft_id=sample_draft.id,
            shift_id=sample_shifts[0].id,
            staff_id=sample_staff[1].id,
            confidence_score=0.8,
            reasoning="Test assignment"
        )
        
        db_session = TestingSessionLocal()
        db_session.add(draft_assignment)
        db_session.commit()
        db_session.refresh(draft_assignment)
        assignment_id = draft_assignment.id
        db_session.close()
        
        # Now remove it
        response = client.delete(
            f"/api/schedule/{sample_business.id}/shifts/{sample_shifts[0].id}/assign/{assignment_id}",
            params={"draft_id": sample_draft.id}
        )
        
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        
        # Verify broadcast was called
        mock_broadcast.assert_called_once()
        call_args = mock_broadcast.call_args
        assert call_args[0][2]["type"] == "staff_unassigned"
        assert call_args[0][2]["is_draft"] is True

class TestScheduleConflictDetection:
    """Test schedule conflict detection"""
    
    def test_detect_double_booking(self, sample_business, sample_staff):
        """Test detection of double booking conflicts"""
        # Create overlapping shifts
        shift1 = Shift(
            business_id=sample_business.id,
            title="Morning Shift",
            date=datetime.now() + timedelta(days=1),
            start_time="09:00",
            end_time="15:00",
            required_skill="kitchen",
            required_staff_count=1
        )
        
        shift2 = Shift(
            business_id=sample_business.id,
            title="Lunch Shift",
            date=datetime.now() + timedelta(days=1),
            start_time="12:00",
            end_time="18:00",
            required_skill="kitchen",
            required_staff_count=1
        )
        
        db_session = TestingSessionLocal()
        db_session.add(shift1)
        db_session.add(shift2)
        db_session.commit()
        db_session.refresh(shift1)
        db_session.refresh(shift2)
        
        # Assign same staff to both shifts
        assignment1 = ShiftAssignment(shift_id=shift1.id, staff_id=sample_staff[1].id)
        assignment2 = ShiftAssignment(shift_id=shift2.id, staff_id=sample_staff[1].id)
        
        db_session.add(assignment1)
        db_session.add(assignment2)
        db_session.commit()
        db_session.close()
        
        start_date = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        end_date = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        
        response = client.get(
            f"/api/schedule/{sample_business.id}/conflicts",
            params={"start_date": start_date, "end_date": end_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        

        
        assert data["total_conflicts"] > 0
        
        # Find double booking conflict
        double_booking = next(
            (c for c in data["conflicts"] if c["type"] == "double_booking"), 
            None
        )
        assert double_booking is not None
        assert double_booking["staff_id"] == sample_staff[1].id
        assert len(double_booking["shift_ids"]) == 2
    
    def test_detect_understaffed_shifts(self, sample_business, sample_shifts):
        """Test detection of understaffed shifts"""
        # Ensure shifts exist by accessing the fixture
        assert len(sample_shifts) >= 2
        
        start_date = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        end_date = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        
        response = client.get(
            f"/api/schedule/{sample_business.id}/conflicts",
            params={"start_date": start_date, "end_date": end_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        

        
        # Should detect understaffed shifts (no assignments created)
        understaffed_conflicts = [
            c for c in data["conflicts"] if c["type"] == "understaffed"
        ]
        assert len(understaffed_conflicts) >= 2  # Both sample shifts should be understaffed

class TestScheduleDraftManagement:
    """Test schedule draft management endpoints"""
    
    def test_get_schedule_drafts(self, sample_business, sample_draft):
        """Test retrieving schedule drafts"""
        response = client.get(f"/api/schedule/{sample_business.id}/drafts")
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) >= 1
        draft = data[0]
        assert draft["id"] == sample_draft.id
        assert draft["business_id"] == sample_business.id
        assert draft["status"] == "draft"
        assert draft["ai_generated"] is True
        assert "assignment_count" in draft
    
    def test_get_schedule_drafts_filtered(self, sample_business, sample_draft):
        """Test retrieving schedule drafts with status filter"""
        response = client.get(
            f"/api/schedule/{sample_business.id}/drafts",
            params={"status": "draft"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) >= 1
        for draft in data:
            assert draft["status"] == "draft"

class TestWebSocketIntegration:
    """Test WebSocket functionality for real-time updates"""
    
    def test_websocket_connection(self, sample_business):
        """Test WebSocket connection establishment"""
        with client.websocket_connect(f"/ws/schedule/{sample_business.id}") as websocket:
            # Send ping
            websocket.send_text(json.dumps({"type": "ping"}))
            
            # Receive pong
            data = websocket.receive_text()
            message = json.loads(data)
            assert message["type"] == "pong"
    
    def test_websocket_user_presence(self, sample_business):
        """Test user presence broadcasting"""
        with client.websocket_connect(f"/ws/schedule/{sample_business.id}") as websocket1:
            with client.websocket_connect(f"/ws/schedule/{sample_business.id}") as websocket2:
                # Send user presence from first connection
                presence_message = {
                    "type": "user_presence",
                    "user_id": 1,
                    "user_name": "Test User",
                    "action": "editing"
                }
                websocket1.send_text(json.dumps(presence_message))
                
                # Second connection should receive the broadcast
                data = websocket2.receive_text()
                message = json.loads(data)
                
                assert message["type"] == "user_presence"
                assert message["user_id"] == 1
                assert message["user_name"] == "Test User"
                assert message["action"] == "editing"

class TestShiftModification:
    """Test shift modification endpoints"""
    
    @patch('main.broadcast_schedule_update')
    def test_update_shift(self, mock_broadcast, sample_business, sample_shifts):
        """Test updating shift details"""
        shift_update = {
            "title": "Updated Morning Kitchen",
            "start_time": "08:00",
            "end_time": "14:00",
            "required_staff_count": 3
        }
        
        response = client.put(
            f"/api/schedule/{sample_business.id}/shifts/{sample_shifts[0].id}",
            json=shift_update
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "success"
        assert "shift" in data
        
        # Verify broadcast was called
        mock_broadcast.assert_called_once()
        call_args = mock_broadcast.call_args
        assert call_args[0][2]["type"] == "shift_updated"
    
    @patch('main.broadcast_schedule_update')
    def test_delete_shift(self, mock_broadcast, sample_business, sample_shifts):
        """Test deleting a shift"""
        response = client.delete(
            f"/api/schedule/{sample_business.id}/shifts/{sample_shifts[1].id}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "success"
        assert "deleted successfully" in data["message"]
        
        # Verify broadcast was called
        mock_broadcast.assert_called_once()
        call_args = mock_broadcast.call_args
        assert call_args[0][2]["type"] == "shift_deleted"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])