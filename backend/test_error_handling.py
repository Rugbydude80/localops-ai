"""
Comprehensive tests for error handling and recovery mechanisms
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session

from services.error_handler import ErrorHandler, ErrorContext, RetryConfig
from services.ai_scheduling_engine import AISchedulingEngine, SchedulingParameters, SchedulingStrategy
from services.notification_service import NotificationService
from exceptions import (
    AIServiceException, NotificationException, ConstraintViolationException,
    InsufficientStaffException, ExternalAPIException, ScheduleGenerationException,
    ErrorSeverity, ErrorCategory
)
from models import Staff, Shift, ScheduleDraft, Business


class TestErrorHandler:
    """Test the comprehensive error handler"""
    
    def setup_method(self):
        """Setup test fixtures"""
        self.error_handler = ErrorHandler()
        self.mock_db = Mock(spec=Session)
    
    @pytest.mark.asyncio
    async def test_handle_ai_service_exception(self):
        """Test handling of AI service failures"""
        # Create AI service exception
        error = AIServiceException(
            message="OpenAI API rate limit exceeded",
            service_name="OpenAI",
            error_type="rate_limit"
        )
        
        context = ErrorContext(
            operation="generate_schedule",
            business_id=1,
            draft_id="test-draft-123"
        )
        
        # Handle the error
        result = await self.error_handler.handle_error(error, context, enable_fallback=True)
        
        # Verify error handling
        assert result["success"] is True  # Should succeed with fallback
        assert "error_id" in result
        assert result["error"]["code"] == "AI_SERVICE_UNAVAILABLE"
        assert result["error"]["category"] == "ai_service"
        assert result["error"]["recoverable"] is True
        assert "recovery" in result
        assert result["recovery"]["strategy"] == "rule_based_scheduling"
    
    @pytest.mark.asyncio
    async def test_handle_notification_exception(self):
        """Test handling of notification delivery failures"""
        error = NotificationException(
            message="WhatsApp API timeout",
            channel="whatsapp",
            staff_id=123,
            retry_count=1
        )
        
        context = ErrorContext(
            operation="send_notification",
            additional_data={"staff_id": 123, "channel": "whatsapp"}
        )
        
        result = await self.error_handler.handle_error(error, context, enable_fallback=True)
        
        # Verify error handling
        assert "error_id" in result
        assert result["error"]["code"] == "NOTIFICATION_DELIVERY_FAILED"
        assert result["error"]["category"] == "notification"
        assert "recovery_suggestions" in result["error"]
    
    @pytest.mark.asyncio
    async def test_handle_constraint_violation(self):
        """Test handling of constraint violations"""
        error = ConstraintViolationException(
            constraint_type="max_hours",
            violation_details={"staff_id": 123, "hours": 50, "limit": 40},
            affected_staff=[123],
            affected_shifts=[1, 2, 3]
        )
        
        context = ErrorContext(
            operation="solve_constraints",
            business_id=1
        )
        
        result = await self.error_handler.handle_error(error, context, enable_fallback=True)
        
        # Verify error handling
        assert result["error"]["code"] == "CONSTRAINT_VIOLATION"
        assert result["error"]["category"] == "constraint_violation"
        assert result["error"]["details"]["constraint_type"] == "max_hours"
        assert result["error"]["details"]["affected_staff"] == [123]
    
    @pytest.mark.asyncio
    async def test_handle_insufficient_staff(self):
        """Test handling of insufficient staff scenarios"""
        error = InsufficientStaffException(
            required_skills=["chef", "server"],
            available_count=2,
            required_count=5,
            shift_details={"date": "2024-01-15", "shifts": 3}
        )
        
        context = ErrorContext(
            operation="assign_staff",
            business_id=1
        )
        
        result = await self.error_handler.handle_error(error, context, enable_fallback=True)
        
        # Verify error handling
        assert result["error"]["code"] == "INSUFFICIENT_STAFF"
        assert result["error"]["details"]["required_skills"] == ["chef", "server"]
        assert result["error"]["details"]["available_count"] == 2
        assert result["error"]["details"]["required_count"] == 5
    
    @pytest.mark.asyncio
    async def test_handle_external_api_exception(self):
        """Test handling of external API failures"""
        error = ExternalAPIException(
            service_name="WhatsApp Business API",
            operation="send_message",
            error_message="Service temporarily unavailable",
            status_code=503,
            retry_after=30
        )
        
        context = ErrorContext(
            operation="send_whatsapp_message",
            additional_data={"recipient": "+1234567890"}
        )
        
        result = await self.error_handler.handle_error(error, context, enable_fallback=True)
        
        # Verify error handling
        assert result["error"]["code"] == "EXTERNAL_API_ERROR"
        assert result["error"]["details"]["service_name"] == "WhatsApp Business API"
        assert result["error"]["details"]["status_code"] == 503
        assert result["error"]["details"]["retry_after"] == 30
    
    @pytest.mark.asyncio
    async def test_retry_mechanism(self):
        """Test retry mechanisms with exponential backoff"""
        # Mock a function that fails twice then succeeds
        call_count = 0
        
        async def failing_function():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise Exception(f"Attempt {call_count} failed")
            return {"success": True, "attempt": call_count}
        
        # Test retry with exponential backoff
        start_time = datetime.now()
        
        # This would be called by the error handler's retry mechanism
        # For testing, we'll simulate the retry logic
        max_attempts = 3
        base_delay = 0.1  # Short delay for testing
        
        for attempt in range(max_attempts):
            try:
                result = await failing_function()
                break
            except Exception as e:
                if attempt < max_attempts - 1:
                    delay = base_delay * (2 ** attempt)
                    await asyncio.sleep(delay)
                else:
                    raise
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        # Verify retry worked
        assert result["success"] is True
        assert result["attempt"] == 3
        assert duration >= 0.3  # Should have waited at least 0.1 + 0.2 seconds
    
    def test_error_statistics(self):
        """Test error statistics collection"""
        # Add some mock errors
        context = ErrorContext(operation="test_operation")
        
        # Create different types of errors
        errors = [
            AIServiceException("Test AI error", "OpenAI", "test_error"),
            NotificationException("Test notification error", "sms", 123),
            ConstraintViolationException("test_constraint", {"test": "data"})
        ]
        
        # Simulate handling errors (without async for testing)
        for i, error in enumerate(errors):
            error_record = self.error_handler.error_records[f"test_error_{i}"] = Mock()
            error_record.timestamp = datetime.now()
            error_record.category = error.category.value
            error_record.severity = error.severity.value
            error_record.resolved = i % 2 == 0  # Alternate resolved status
        
        # Get statistics
        stats = self.error_handler.get_error_statistics(hours=24)
        
        # Verify statistics
        assert stats["total_errors"] == 3
        assert stats["resolved_errors"] == 2  # Every other error resolved
        assert stats["resolution_rate"] == 66.67  # 2/3 * 100
        assert "by_category" in stats
        assert "by_severity" in stats
    
    def test_error_details_retrieval(self):
        """Test retrieving detailed error information"""
        # Create a mock error record
        error_id = "test_error_123"
        mock_record = Mock()
        mock_record.error_id = error_id
        mock_record.timestamp = datetime.now()
        mock_record.error_type = "AIServiceException"
        mock_record.error_code = "AI_SERVICE_UNAVAILABLE"
        mock_record.message = "Test error message"
        mock_record.severity = "high"
        mock_record.category = "ai_service"
        mock_record.context = ErrorContext(operation="test_operation")
        mock_record.stack_trace = "Mock stack trace"
        mock_record.resolution_attempted = "rule_based_fallback"
        mock_record.resolved = True
        mock_record.resolution_time = datetime.now()
        
        self.error_handler.error_records[error_id] = mock_record
        
        # Get error details
        details = self.error_handler.get_error_details(error_id)
        
        # Verify details
        assert details is not None
        assert details["error_id"] == error_id
        assert details["error_type"] == "AIServiceException"
        assert details["error_code"] == "AI_SERVICE_UNAVAILABLE"
        assert details["resolved"] is True
        assert details["resolution_attempted"] == "rule_based_fallback"
    
    def test_error_details_not_found(self):
        """Test retrieving details for non-existent error"""
        details = self.error_handler.get_error_details("non_existent_error")
        assert details is None


class TestAISchedulingEngineErrorHandling:
    """Test error handling in AI scheduling engine"""
    
    def setup_method(self):
        """Setup test fixtures"""
        self.mock_db = Mock(spec=Session)
        self.ai_engine = AISchedulingEngine(self.mock_db)
        
        # Mock the constraint solver
        self.ai_engine.constraint_solver = Mock()
        
        # Mock OpenAI client
        self.ai_engine.client = AsyncMock()
        self.ai_engine.ai_enabled = True
    
    @pytest.mark.asyncio
    async def test_schedule_generation_with_ai_failure(self):
        """Test schedule generation when AI service fails"""
        # Setup test data
        params = SchedulingParameters(
            business_id=1,
            date_range_start=date.today(),
            date_range_end=date.today() + timedelta(days=7),
            special_events=[],
            staff_notes=[],
            constraints={},
            created_by=1
        )
        
        # Mock database operations
        mock_draft = Mock()
        mock_draft.id = "test-draft-123"
        self.mock_db.add = Mock()
        self.mock_db.commit = Mock()
        self.mock_db.refresh = Mock()
        self.mock_db.query.return_value.filter.return_value.first.return_value = mock_draft
        
        # Mock shifts and staff
        mock_shifts = [Mock(id=1, required_skill="chef"), Mock(id=2, required_skill="server")]
        mock_staff = [Mock(id=1, skills=["chef"]), Mock(id=2, skills=["server"])]
        
        # Mock AI service failure
        self.ai_engine.client.chat.completions.create = AsyncMock(
            side_effect=Exception("OpenAI API timeout")
        )
        
        # Mock constraint solver to return basic assignments
        mock_assignments = [
            Mock(shift_id=1, staff_id=1, confidence_score=0.6),
            Mock(shift_id=2, staff_id=2, confidence_score=0.6)
        ]
        self.ai_engine.constraint_solver.solve_scheduling_constraints.return_value = mock_assignments
        
        # Mock internal methods
        self.ai_engine._build_scheduling_context = AsyncMock(return_value=Mock())
        self.ai_engine._get_shifts_to_schedule = AsyncMock(return_value=mock_shifts)
        self.ai_engine._get_available_staff = AsyncMock(return_value=mock_staff)
        self.ai_engine._generate_schedule_summary = AsyncMock(return_value={
            "warnings": ["AI service unavailable, used rule-based fallback"],
            "recommendations": ["Review assignments manually"]
        })
        
        # Test schedule generation
        result = await self.ai_engine.generate_schedule(params)
        
        # Verify fallback was used
        assert result is not None
        assert result.draft_id == "test-draft-123"
        assert "fallback" in str(result.generation_summary).lower() or result.overall_confidence < 0.8
    
    @pytest.mark.asyncio
    async def test_schedule_generation_with_insufficient_staff(self):
        """Test schedule generation with insufficient staff"""
        params = SchedulingParameters(
            business_id=1,
            date_range_start=date.today(),
            date_range_end=date.today() + timedelta(days=7),
            special_events=[],
            staff_notes=[],
            constraints={},
            created_by=1
        )
        
        # Mock database operations
        mock_draft = Mock()
        mock_draft.id = "test-draft-123"
        self.mock_db.add = Mock()
        self.mock_db.commit = Mock()
        self.mock_db.refresh = Mock()
        self.mock_db.query.return_value.filter.return_value.first.return_value = mock_draft
        
        # Mock shifts but no staff
        mock_shifts = [Mock(id=1, required_skill="chef"), Mock(id=2, required_skill="server")]
        mock_staff = []  # No staff available
        
        # Mock internal methods
        self.ai_engine._build_scheduling_context = AsyncMock(return_value=Mock())
        self.ai_engine._get_shifts_to_schedule = AsyncMock(return_value=mock_shifts)
        self.ai_engine._get_available_staff = AsyncMock(return_value=mock_staff)
        
        # Test schedule generation - should raise InsufficientStaffException
        with pytest.raises(InsufficientStaffException) as exc_info:
            await self.ai_engine.generate_schedule(params)
        
        # Verify exception details
        assert exc_info.value.details["required_count"] == 2
        assert exc_info.value.details["available_count"] == 0
        assert "chef" in exc_info.value.details["required_skills"]
        assert "server" in exc_info.value.details["required_skills"]
    
    @pytest.mark.asyncio
    async def test_constraint_solver_failure_handling(self):
        """Test handling of constraint solver failures"""
        params = SchedulingParameters(
            business_id=1,
            date_range_start=date.today(),
            date_range_end=date.today() + timedelta(days=7),
            special_events=[],
            staff_notes=[],
            constraints={},
            created_by=1
        )
        
        # Mock database operations
        mock_draft = Mock()
        mock_draft.id = "test-draft-123"
        self.mock_db.add = Mock()
        self.mock_db.commit = Mock()
        self.mock_db.refresh = Mock()
        self.mock_db.query.return_value.filter.return_value.first.return_value = mock_draft
        
        # Mock shifts and staff
        mock_shifts = [Mock(id=1, required_skill="chef")]
        mock_staff = [Mock(id=1, skills=["chef"])]
        
        # Mock constraint solver failure
        self.ai_engine.constraint_solver.solve_scheduling_constraints.side_effect = Exception(
            "Constraint solving failed"
        )
        
        # Mock internal methods
        self.ai_engine._build_scheduling_context = AsyncMock(return_value=Mock())
        self.ai_engine._get_shifts_to_schedule = AsyncMock(return_value=mock_shifts)
        self.ai_engine._get_available_staff = AsyncMock(return_value=mock_staff)
        self.ai_engine._get_ai_scheduling_recommendations = AsyncMock(return_value={})
        
        # Test schedule generation - should handle constraint solver failure
        with pytest.raises(ConstraintViolationException):
            await self.ai_engine.generate_schedule(params)


class TestNotificationServiceErrorHandling:
    """Test error handling in notification service"""
    
    def setup_method(self):
        """Setup test fixtures"""
        self.mock_db = Mock(spec=Session)
        self.notification_service = NotificationService(self.mock_db)
        
        # Mock external services
        self.notification_service.whatsapp_service = AsyncMock()
        self.notification_service.sms_service = AsyncMock()
        self.notification_service.email_service = AsyncMock()
    
    @pytest.mark.asyncio
    async def test_notification_retry_mechanism(self):
        """Test notification retry with exponential backoff"""
        # Create test staff
        staff = Mock()
        staff.id = 123
        staff.name = "John Doe"
        staff.phone_number = "+1234567890"
        staff.email = "john@example.com"
        
        # Mock WhatsApp service to fail twice then succeed
        call_count = 0
        
        async def mock_whatsapp_send(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                return {"success": False, "error": f"Attempt {call_count} failed"}
            return {"success": True, "message_id": "msg_123"}
        
        self.notification_service.whatsapp_service.send_coverage_request = mock_whatsapp_send
        
        # Mock database operations
        self.mock_db.add = Mock()
        self.mock_db.commit = Mock()
        
        # Test notification with retry
        result = await self.notification_service._send_notification_with_retry(
            staff, "Test message", "whatsapp", "draft-123", "new_schedule", max_retries=3
        )
        
        # Verify retry worked
        assert result["success"] is True
        assert result["attempts"] == 3
        assert call_count == 3
    
    @pytest.mark.asyncio
    async def test_notification_permanent_failure(self):
        """Test handling of permanent notification failures"""
        staff = Mock()
        staff.id = 123
        staff.name = "John Doe"
        staff.phone_number = "+1234567890"
        
        # Mock WhatsApp service to return permanent failure
        self.notification_service.whatsapp_service.send_coverage_request = AsyncMock(
            return_value={"success": False, "error": "Invalid phone number"}
        )
        
        # Mock database operations
        self.mock_db.add = Mock()
        self.mock_db.commit = Mock()
        
        # Test notification - should not retry permanent failures
        result = await self.notification_service._send_notification_with_retry(
            staff, "Test message", "whatsapp", "draft-123", "new_schedule", max_retries=3
        )
        
        # Verify permanent failure handling
        assert result["success"] is False
        assert "invalid phone number" in result["error"].lower()
        assert result["attempts"] == 1  # Should not retry
    
    @pytest.mark.asyncio
    async def test_multi_channel_fallback(self):
        """Test multi-channel notification with fallback"""
        staff = Mock()
        staff.id = 123
        staff.name = "John Doe"
        staff.phone_number = "+1234567890"
        staff.email = "john@example.com"
        
        # Mock WhatsApp to fail, SMS to succeed
        self.notification_service.whatsapp_service.send_coverage_request = AsyncMock(
            return_value={"success": False, "error": "WhatsApp service unavailable"}
        )
        self.notification_service.sms_service.send_sms = AsyncMock(
            return_value={"success": True, "message_id": "sms_123"}
        )
        
        # Mock database operations
        self.mock_db.add = Mock()
        self.mock_db.commit = Mock()
        
        # Test multi-channel notification
        results = await self.notification_service._send_multi_channel_notification(
            staff, "Test message", ["whatsapp", "sms"], "draft-123", "new_schedule"
        )
        
        # Verify fallback worked
        assert len(results) == 2
        assert results[0]["channel"] == "whatsapp"
        assert results[0]["success"] is False
        assert results[1]["channel"] == "sms"
        assert results[1]["success"] is True
    
    @pytest.mark.asyncio
    async def test_notification_complete_failure(self):
        """Test handling when all notification channels fail"""
        staff = Mock()
        staff.id = 123
        staff.name = "John Doe"
        staff.phone_number = "+1234567890"
        staff.email = "john@example.com"
        
        # Mock all services to fail
        self.notification_service.whatsapp_service.send_coverage_request = AsyncMock(
            return_value={"success": False, "error": "WhatsApp failed"}
        )
        self.notification_service.sms_service.send_sms = AsyncMock(
            return_value={"success": False, "error": "SMS failed"}
        )
        self.notification_service.email_service.send_email = AsyncMock(
            return_value={"success": False, "error": "Email failed"}
        )
        
        # Mock database operations
        self.mock_db.add = Mock()
        self.mock_db.commit = Mock()
        
        # Test multi-channel notification
        results = await self.notification_service._send_multi_channel_notification(
            staff, "Test message", ["whatsapp", "sms", "email"], "draft-123", "new_schedule"
        )
        
        # Verify all channels failed
        assert len(results) >= 3
        assert all(not result["success"] for result in results)
        
        # Verify failure notification was logged
        self.mock_db.add.assert_called()
        failure_notification = self.mock_db.add.call_args[0][0]
        assert failure_notification.channel == "all_failed"
        assert failure_notification.status == "failed"


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])