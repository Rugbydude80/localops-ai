import pytest
import asyncio
from datetime import datetime, date, timedelta
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from models import Staff, Shift, ScheduleDraft, Business, ScheduleNotification
from services.ai_scheduling_engine import AISchedulingEngine
from services.notification_service import NotificationService
from database import get_db


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_db():
    return Mock(spec=Session)


@pytest.fixture
def sample_business():
    return Business(
        id=1,
        name="Test Restaurant",
        timezone="America/New_York",
        is_active=True
    )


@pytest.fixture
def sample_staff_list():
    return [
        Staff(
            id=1,
            name="John Doe",
            email="john@test.com",
            phone="+1234567890",
            business_id=1,
            skills=["server"],
            hourly_rate=15.0,
            max_hours_per_week=40,
            is_active=True
        ),
        Staff(
            id=2,
            name="Jane Smith",
            email="jane@test.com",
            phone="+1234567891",
            business_id=1,
            skills=["cook"],
            hourly_rate=18.0,
            max_hours_per_week=40,
            is_active=True
        ),
        Staff(
            id=3,
            name="Bob Johnson",
            email="bob@test.com",
            phone="+1234567892",
            business_id=1,
            skills=["bartender"],
            hourly_rate=16.0,
            max_hours_per_week=35,
            is_active=True
        )
    ]


@pytest.fixture
def sample_shifts():
    base_date = date.today() + timedelta(days=1)
    return [
        Shift(
            id=1,
            business_id=1,
            title="Morning Shift",
            date=base_date,
            start_time="08:00",
            end_time="16:00",
            required_skill="server",
            is_published=False
        ),
        Shift(
            id=2,
            business_id=1,
            title="Evening Shift",
            date=base_date,
            start_time="16:00",
            end_time="24:00",
            required_skill="cook",
            is_published=False
        ),
        Shift(
            id=3,
            business_id=1,
            title="Bar Shift",
            date=base_date,
            start_time="18:00",
            end_time="02:00",
            required_skill="bartender",
            is_published=False
        )
    ]


@pytest.mark.integration
class TestCompleteAutoScheduleWorkflow:
    """Integration tests for the complete auto-schedule workflow"""

    async def test_end_to_end_schedule_generation_and_publishing(
        self, client, mock_db, sample_business, sample_staff_list, sample_shifts
    ):
        """Test complete workflow from generation to publishing with notifications"""
        
        # Mock database dependencies
        def override_get_db():
            return mock_db
        
        app.dependency_overrides[get_db] = override_get_db
        
        # Mock database queries
        mock_db.query.return_value.filter.return_value.first.return_value = sample_business
        mock_db.query.return_value.filter.return_value.all.return_value = sample_staff_list
        
        # Mock AI scheduling engine
        with patch('services.ai_scheduling_engine.AISchedulingEngine') as mock_ai_engine:
            mock_draft = ScheduleDraft(
                id="draft-123",
                business_id=1,
                date_range_start=date.today() + timedelta(days=1),
                date_range_end=date.today() + timedelta(days=7),
                status="draft",
                ai_generated=True,
                confidence_score=0.85
            )
            
            mock_ai_engine.return_value.generate_schedule.return_value = mock_draft
            
            # Step 1: Generate auto-schedule
            generate_response = client.post(
                "/api/auto-schedule/1/generate",
                json={
                    "date_range_start": (date.today() + timedelta(days=1)).isoformat(),
                    "date_range_end": (date.today() + timedelta(days=7)).isoformat(),
                    "special_events": [
                        {
                            "name": "Football Game",
                            "date": (date.today() + timedelta(days=3)).isoformat(),
                            "expected_impact": "high"
                        }
                    ],
                    "staff_notes": []
                }
            )
            
            assert generate_response.status_code == 200
            response_data = generate_response.json()
            assert response_data["draft_id"] == "draft-123"
            assert response_data["confidence_score"] == 0.85
            
            # Step 2: Retrieve and review draft
            draft_response = client.get("/api/auto-schedule/1/draft/draft-123")
            assert draft_response.status_code == 200
            draft_data = draft_response.json()
            assert draft_data["id"] == "draft-123"
            assert draft_data["status"] == "draft"
            
            # Step 3: Make manual edits to draft
            edit_response = client.put(
                "/api/auto-schedule/1/draft/draft-123",
                json={
                    "changes": [
                        {
                            "type": "assignment",
                            "shift_id": 1,
                            "staff_id": 2,
                            "action": "assign"
                        }
                    ]
                }
            )
            
            assert edit_response.status_code == 200
            
            # Step 4: Publish schedule with notifications
            with patch('services.notification_service.NotificationService') as mock_notification_service:
                mock_notification_service.return_value.send_schedule_notifications.return_value = [
                    Mock(success=True, staff_id=1, channel="whatsapp"),
                    Mock(success=True, staff_id=2, channel="email"),
                    Mock(success=True, staff_id=3, channel="sms")
                ]
                
                publish_response = client.post(
                    "/api/auto-schedule/1/publish/draft-123",
                    json={
                        "notify_staff": True,
                        "notification_channels": ["whatsapp", "sms", "email"],
                        "include_schedule_summary": True
                    }
                )
                
                assert publish_response.status_code == 200
                publish_data = publish_response.json()
                assert publish_data["success"] is True
                assert publish_data["notifications_sent"] == 3
                assert publish_data["failed_notifications"] == 0
        
        # Clean up
        app.dependency_overrides.clear()

    async def test_workflow_with_constraint_violations(
        self, client, mock_db, sample_business, sample_staff_list, sample_shifts
    ):
        """Test workflow handling when constraints cannot be satisfied"""
        
        def override_get_db():
            return mock_db
        
        app.dependency_overrides[get_db] = override_get_db
        
        mock_db.query.return_value.filter.return_value.first.return_value = sample_business
        mock_db.query.return_value.filter.return_value.all.return_value = sample_staff_list
        
        # Mock constraint violation scenario
        with patch('services.ai_scheduling_engine.AISchedulingEngine') as mock_ai_engine:
            from exceptions import InsufficientStaffException
            
            mock_ai_engine.return_value.generate_schedule.side_effect = InsufficientStaffException(
                required_skills=["server", "cook"],
                available_count=1
            )
            
            generate_response = client.post(
                "/api/auto-schedule/1/generate",
                json={
                    "date_range_start": (date.today() + timedelta(days=1)).isoformat(),
                    "date_range_end": (date.today() + timedelta(days=7)).isoformat(),
                    "special_events": [],
                    "staff_notes": []
                }
            )
            
            assert generate_response.status_code == 400
            error_data = generate_response.json()
            assert error_data["error"]["code"] == "INSUFFICIENT_STAFF"
            assert "server" in error_data["error"]["details"]["required_skills"]
            assert "cook" in error_data["error"]["details"]["required_skills"]
        
        app.dependency_overrides.clear()

    async def test_workflow_with_external_service_failures(
        self, client, mock_db, sample_business, sample_staff_list
    ):
        """Test workflow resilience when external services fail"""
        
        def override_get_db():
            return mock_db
        
        app.dependency_overrides[get_db] = override_get_db
        
        mock_db.query.return_value.filter.return_value.first.return_value = sample_business
        mock_db.query.return_value.filter.return_value.all.return_value = sample_staff_list
        
        # Mock successful schedule generation
        with patch('services.ai_scheduling_engine.AISchedulingEngine') as mock_ai_engine:
            mock_draft = ScheduleDraft(
                id="draft-456",
                business_id=1,
                date_range_start=date.today() + timedelta(days=1),
                date_range_end=date.today() + timedelta(days=7),
                status="draft",
                ai_generated=True,
                confidence_score=0.75
            )
            
            mock_ai_engine.return_value.generate_schedule.return_value = mock_draft
            
            # Generate schedule successfully
            generate_response = client.post(
                "/api/auto-schedule/1/generate",
                json={
                    "date_range_start": (date.today() + timedelta(days=1)).isoformat(),
                    "date_range_end": (date.today() + timedelta(days=7)).isoformat(),
                    "special_events": [],
                    "staff_notes": []
                }
            )
            
            assert generate_response.status_code == 200
            
            # Mock notification service failures
            with patch('services.notification_service.NotificationService') as mock_notification_service:
                mock_notification_service.return_value.send_schedule_notifications.return_value = [
                    Mock(success=True, staff_id=1, channel="whatsapp"),
                    Mock(success=False, staff_id=2, channel="email", error_message="SMTP error"),
                    Mock(success=False, staff_id=3, channel="sms", error_message="Invalid phone number")
                ]
                
                publish_response = client.post(
                    "/api/auto-schedule/1/publish/draft-456",
                    json={
                        "notify_staff": True,
                        "notification_channels": ["whatsapp", "sms", "email"],
                        "include_schedule_summary": True
                    }
                )
                
                assert publish_response.status_code == 200
                publish_data = publish_response.json()
                assert publish_data["success"] is True  # Schedule still published
                assert publish_data["notifications_sent"] == 1
                assert publish_data["failed_notifications"] == 2
                assert len(publish_data["notification_errors"]) == 2
        
        app.dependency_overrides.clear()

    async def test_concurrent_workflow_operations(
        self, client, mock_db, sample_business, sample_staff_list
    ):
        """Test handling of concurrent workflow operations"""
        
        def override_get_db():
            return mock_db
        
        app.dependency_overrides[get_db] = override_get_db
        
        mock_db.query.return_value.filter.return_value.first.return_value = sample_business
        mock_db.query.return_value.filter.return_value.all.return_value = sample_staff_list
        
        with patch('services.ai_scheduling_engine.AISchedulingEngine') as mock_ai_engine:
            # Mock different drafts for concurrent requests
            mock_ai_engine.return_value.generate_schedule.side_effect = [
                ScheduleDraft(id=f"draft-{i}", business_id=1, status="draft", confidence_score=0.8)
                for i in range(3)
            ]
            
            # Simulate concurrent schedule generation requests
            async def make_request(request_id):
                response = client.post(
                    "/api/auto-schedule/1/generate",
                    json={
                        "date_range_start": (date.today() + timedelta(days=1)).isoformat(),
                        "date_range_end": (date.today() + timedelta(days=7)).isoformat(),
                        "special_events": [],
                        "staff_notes": [{"note": f"Request {request_id}"}]
                    }
                )
                return response
            
            # Make concurrent requests
            tasks = [make_request(i) for i in range(3)]
            responses = await asyncio.gather(*[asyncio.create_task(asyncio.to_thread(lambda: task)) for task in tasks])
            
            # All requests should succeed
            for response in responses:
                assert response.status_code == 200
                response_data = response.json()
                assert "draft_id" in response_data
                assert response_data["confidence_score"] == 0.8
        
        app.dependency_overrides.clear()

    async def test_workflow_data_consistency(
        self, client, mock_db, sample_business, sample_staff_list
    ):
        """Test data consistency throughout the workflow"""
        
        def override_get_db():
            return mock_db
        
        app.dependency_overrides[get_db] = override_get_db
        
        # Track database operations
        db_operations = []
        
        def track_db_operation(operation, *args, **kwargs):
            db_operations.append({
                'operation': operation,
                'timestamp': datetime.now(),
                'args': args,
                'kwargs': kwargs
            })
            return Mock()
        
        mock_db.add.side_effect = lambda obj: track_db_operation('add', obj)
        mock_db.commit.side_effect = lambda: track_db_operation('commit')
        mock_db.rollback.side_effect = lambda: track_db_operation('rollback')
        
        mock_db.query.return_value.filter.return_value.first.return_value = sample_business
        mock_db.query.return_value.filter.return_value.all.return_value = sample_staff_list
        
        with patch('services.ai_scheduling_engine.AISchedulingEngine') as mock_ai_engine:
            mock_draft = ScheduleDraft(
                id="draft-consistency",
                business_id=1,
                status="draft",
                confidence_score=0.9
            )
            
            mock_ai_engine.return_value.generate_schedule.return_value = mock_draft
            
            # Generate schedule
            generate_response = client.post(
                "/api/auto-schedule/1/generate",
                json={
                    "date_range_start": (date.today() + timedelta(days=1)).isoformat(),
                    "date_range_end": (date.today() + timedelta(days=7)).isoformat(),
                    "special_events": [],
                    "staff_notes": []
                }
            )
            
            assert generate_response.status_code == 200
            
            # Verify database operations were tracked
            add_operations = [op for op in db_operations if op['operation'] == 'add']
            commit_operations = [op for op in db_operations if op['operation'] == 'commit']
            
            assert len(add_operations) > 0  # Should have added draft and assignments
            assert len(commit_operations) > 0  # Should have committed changes
            
            # No rollbacks should have occurred for successful operation
            rollback_operations = [op for op in db_operations if op['operation'] == 'rollback']
            assert len(rollback_operations) == 0
        
        app.dependency_overrides.clear()


@pytest.mark.integration
class TestScheduleManagementIntegration:
    """Integration tests for schedule management features"""

    async def test_real_time_collaboration_workflow(self, client, mock_db):
        """Test real-time collaboration features during schedule editing"""
        
        def override_get_db():
            return mock_db
        
        app.dependency_overrides[get_db] = override_get_db
        
        # Mock WebSocket connections
        with patch('services.collaboration_service.CollaborationService') as mock_collab_service:
            mock_collab_service.return_value.notify_users.return_value = True
            mock_collab_service.return_value.handle_conflict.return_value = {
                'resolution': 'merge',
                'resolved_changes': []
            }
            
            # Simulate concurrent edits
            edit1_response = client.put(
                "/api/schedule/1/shifts/1/assign",
                json={
                    "staff_id": 1,
                    "user_id": "user1",
                    "timestamp": datetime.now().isoformat()
                }
            )
            
            edit2_response = client.put(
                "/api/schedule/1/shifts/1/assign",
                json={
                    "staff_id": 2,
                    "user_id": "user2",
                    "timestamp": (datetime.now() + timedelta(seconds=1)).isoformat()
                }
            )
            
            # Both edits should be processed
            assert edit1_response.status_code == 200
            assert edit2_response.status_code == 200
            
            # Collaboration service should have been called
            assert mock_collab_service.return_value.notify_users.called
            assert mock_collab_service.return_value.handle_conflict.called
        
        app.dependency_overrides.clear()

    async def test_schedule_validation_workflow(self, client, mock_db, sample_staff_list):
        """Test schedule validation during editing"""
        
        def override_get_db():
            return mock_db
        
        app.dependency_overrides[get_db] = override_get_db
        
        mock_db.query.return_value.filter.return_value.all.return_value = sample_staff_list
        
        # Test constraint validation
        with patch('services.constraint_solver.ConstraintSolver') as mock_constraint_solver:
            mock_constraint_solver.return_value.validate_assignment.return_value = {
                'valid': False,
                'violations': ['max_hours_exceeded', 'skill_mismatch'],
                'suggestions': ['Reduce hours', 'Assign different staff member']
            }
            
            assign_response = client.put(
                "/api/schedule/1/shifts/1/assign",
                json={
                    "staff_id": 1,
                    "validate_constraints": True
                }
            )
            
            assert assign_response.status_code == 400
            error_data = assign_response.json()
            assert error_data["error"]["code"] == "CONSTRAINT_VIOLATION"
            assert "max_hours_exceeded" in error_data["error"]["details"]["violations"]
            assert len(error_data["error"]["details"]["suggestions"]) > 0
        
        app.dependency_overrides.clear()


@pytest.mark.integration
class TestNotificationIntegration:
    """Integration tests for notification system"""

    async def test_multi_channel_notification_workflow(self, client, mock_db, sample_staff_list):
        """Test complete multi-channel notification workflow"""
        
        def override_get_db():
            return mock_db
        
        app.dependency_overrides[get_db] = override_get_db
        
        mock_db.query.return_value.filter.return_value.all.return_value = sample_staff_list
        
        with patch('services.notification_service.NotificationService') as mock_notification_service:
            # Mock successful notifications across all channels
            mock_notification_service.return_value.send_schedule_notifications.return_value = [
                Mock(success=True, staff_id=1, channel="whatsapp", external_id="wa-123"),
                Mock(success=True, staff_id=1, channel="email", external_id="email-123"),
                Mock(success=True, staff_id=2, channel="sms", external_id="sms-123"),
                Mock(success=True, staff_id=3, channel="whatsapp", external_id="wa-124")
            ]
            
            # Test bulk notification sending
            notification_response = client.post(
                "/api/notifications/1/send-schedule",
                json={
                    "staff_ids": [1, 2, 3],
                    "channels": ["whatsapp", "sms", "email"],
                    "message_template": "schedule_update",
                    "schedule_data": {
                        "week_start": date.today().isoformat(),
                        "changes": []
                    }
                }
            )
            
            assert notification_response.status_code == 200
            response_data = notification_response.json()
            assert response_data["total_sent"] == 4
            assert response_data["success_rate"] == 1.0
            
            # Verify notification records were created
            assert mock_notification_service.return_value.send_schedule_notifications.called
        
        app.dependency_overrides.clear()

    async def test_notification_failure_recovery(self, client, mock_db, sample_staff_list):
        """Test notification failure handling and recovery"""
        
        def override_get_db():
            return mock_db
        
        app.dependency_overrides[get_db] = override_get_db
        
        mock_db.query.return_value.filter.return_value.all.return_value = sample_staff_list
        
        with patch('services.notification_service.NotificationService') as mock_notification_service:
            # Mock mixed success/failure scenario
            mock_notification_service.return_value.send_schedule_notifications.return_value = [
                Mock(success=True, staff_id=1, channel="whatsapp"),
                Mock(success=False, staff_id=2, channel="sms", error_message="Invalid phone number"),
                Mock(success=False, staff_id=3, channel="email", error_message="SMTP error")
            ]
            
            # Mock retry mechanism
            mock_notification_service.return_value.retry_failed_notifications.return_value = [
                Mock(success=True, staff_id=2, channel="email"),  # Fallback channel
                Mock(success=False, staff_id=3, channel="sms", error_message="Still failing")
            ]
            
            notification_response = client.post(
                "/api/notifications/1/send-schedule",
                json={
                    "staff_ids": [1, 2, 3],
                    "channels": ["whatsapp", "sms", "email"],
                    "enable_retry": True,
                    "enable_fallback": True
                }
            )
            
            assert notification_response.status_code == 200
            response_data = notification_response.json()
            assert response_data["initial_success_rate"] < 1.0
            assert response_data["final_success_rate"] > response_data["initial_success_rate"]
            assert len(response_data["retry_results"]) > 0
        
        app.dependency_overrides.clear()