import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
import json
from datetime import datetime, date
from typing import Dict, List

from services.notification_service import NotificationService
from services.smart_communication import SmartCommunicationService
from models import Staff, ScheduleDraft, ScheduleNotification
from schemas import NotificationSettings, ScheduleChange


class TestWhatsAppIntegration:
    """Test WhatsApp Business API integration"""
    
    @pytest.fixture
    def notification_service(self):
        return NotificationService()
    
    @pytest.fixture
    def sample_staff(self):
        return Staff(
            id=1,
            name="John Doe",
            phone="+1234567890",
            preferred_notification="whatsapp",
            business_id=1
        )
    
    @pytest.fixture
    def sample_schedule_changes(self):
        return [
            ScheduleChange(
                shift_id=1,
                change_type="assignment",
                old_value=None,
                new_value="John Doe",
                shift_date=date(2024, 1, 15),
                shift_time="08:00-16:00"
            )
        ]

    @patch('services.notification_service.requests.post')
    async def test_whatsapp_message_delivery_success(self, mock_post, notification_service, sample_staff, sample_schedule_changes):
        """Test successful WhatsApp message delivery"""
        # Mock successful WhatsApp API response
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            "messages": [{
                "id": "wamid.123456789",
                "message_status": "accepted"
            }]
        }
        
        result = await notification_service.send_whatsapp_notification(
            staff_member=sample_staff,
            message="Your schedule for Jan 15: 08:00-16:00 Morning Shift",
            schedule_changes=sample_schedule_changes
        )
        
        assert result.success is True
        assert result.external_id == "wamid.123456789"
        assert result.channel == "whatsapp"
        
        # Verify API call was made with correct parameters
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[0][0].endswith('/messages')
        assert json.loads(call_args[1]['data'])['to'] == "+1234567890"

    @patch('services.notification_service.requests.post')
    async def test_whatsapp_message_delivery_failure(self, mock_post, notification_service, sample_staff, sample_schedule_changes):
        """Test WhatsApp message delivery failure handling"""
        # Mock failed WhatsApp API response
        mock_post.return_value.status_code = 400
        mock_post.return_value.json.return_value = {
            "error": {
                "code": 1006,
                "title": "Resource not found",
                "details": "Phone number not registered"
            }
        }
        
        result = await notification_service.send_whatsapp_notification(
            staff_member=sample_staff,
            message="Your schedule for Jan 15: 08:00-16:00 Morning Shift",
            schedule_changes=sample_schedule_changes
        )
        
        assert result.success is False
        assert result.error_code == "1006"
        assert "not registered" in result.error_message
        assert result.channel == "whatsapp"

    @patch('services.notification_service.requests.post')
    async def test_whatsapp_rate_limiting(self, mock_post, notification_service):
        """Test WhatsApp API rate limiting handling"""
        # Mock rate limit response
        mock_post.return_value.status_code = 429
        mock_post.return_value.headers = {'Retry-After': '60'}
        mock_post.return_value.json.return_value = {
            "error": {
                "code": 80007,
                "title": "Rate limit hit"
            }
        }
        
        staff_list = [
            Staff(id=i, name=f"Staff {i}", phone=f"+123456789{i}", preferred_notification="whatsapp", business_id=1)
            for i in range(10)
        ]
        
        results = await notification_service.send_bulk_whatsapp_notifications(
            staff_list=staff_list,
            message="Schedule update",
            schedule_changes=[]
        )
        
        # Should handle rate limiting gracefully
        assert len(results) == 10
        failed_results = [r for r in results if not r.success]
        assert len(failed_results) > 0
        assert any("rate limit" in r.error_message.lower() for r in failed_results)


class TestSMSIntegration:
    """Test SMS provider integration"""
    
    @pytest.fixture
    def notification_service(self):
        return NotificationService()
    
    @pytest.fixture
    def sample_staff(self):
        return Staff(
            id=1,
            name="Jane Smith",
            phone="+1987654321",
            preferred_notification="sms",
            business_id=1
        )

    @patch('services.notification_service.twilio_client.messages.create')
    async def test_sms_delivery_success(self, mock_create, notification_service, sample_staff):
        """Test successful SMS delivery via Twilio"""
        # Mock successful Twilio response
        mock_message = Mock()
        mock_message.sid = "SM123456789"
        mock_message.status = "queued"
        mock_create.return_value = mock_message
        
        result = await notification_service.send_sms_notification(
            staff_member=sample_staff,
            message="Schedule update: You're assigned to Morning Shift on Jan 15, 08:00-16:00"
        )
        
        assert result.success is True
        assert result.external_id == "SM123456789"
        assert result.channel == "sms"
        
        mock_create.assert_called_once_with(
            body="Schedule update: You're assigned to Morning Shift on Jan 15, 08:00-16:00",
            from_=notification_service.twilio_phone_number,
            to="+1987654321"
        )

    @patch('services.notification_service.twilio_client.messages.create')
    async def test_sms_delivery_failure(self, mock_create, notification_service, sample_staff):
        """Test SMS delivery failure handling"""
        from twilio.base.exceptions import TwilioRestException
        
        # Mock Twilio exception
        mock_create.side_effect = TwilioRestException(
            status=400,
            uri="/Messages",
            msg="Invalid phone number"
        )
        
        result = await notification_service.send_sms_notification(
            staff_member=sample_staff,
            message="Schedule update"
        )
        
        assert result.success is False
        assert "Invalid phone number" in result.error_message
        assert result.channel == "sms"

    @patch('services.notification_service.twilio_client.messages.create')
    async def test_sms_character_limit_handling(self, mock_create, notification_service, sample_staff):
        """Test SMS message splitting for long messages"""
        mock_message = Mock()
        mock_message.sid = "SM123456789"
        mock_message.status = "queued"
        mock_create.return_value = mock_message
        
        # Create a very long message
        long_message = "Schedule update: " + "A" * 500  # Exceeds SMS limit
        
        result = await notification_service.send_sms_notification(
            staff_member=sample_staff,
            message=long_message
        )
        
        assert result.success is True
        # Should have split into multiple messages
        assert mock_create.call_count >= 2


class TestEmailIntegration:
    """Test email service integration"""
    
    @pytest.fixture
    def notification_service(self):
        return NotificationService()
    
    @pytest.fixture
    def sample_staff(self):
        return Staff(
            id=1,
            name="Bob Johnson",
            email="bob@example.com",
            preferred_notification="email",
            business_id=1
        )

    @patch('services.notification_service.smtp_client.send_message')
    async def test_email_delivery_success(self, mock_send, notification_service, sample_staff):
        """Test successful email delivery"""
        mock_send.return_value = {"MessageId": "email-123456"}
        
        result = await notification_service.send_email_notification(
            staff_member=sample_staff,
            subject="Schedule Update",
            message="Your schedule has been updated",
            html_content="<h1>Schedule Update</h1><p>Your schedule has been updated</p>"
        )
        
        assert result.success is True
        assert result.external_id == "email-123456"
        assert result.channel == "email"
        
        mock_send.assert_called_once()

    @patch('services.notification_service.smtp_client.send_message')
    async def test_email_delivery_with_attachments(self, mock_send, notification_service, sample_staff):
        """Test email delivery with schedule PDF attachment"""
        mock_send.return_value = {"MessageId": "email-123456"}
        
        # Mock PDF generation
        with patch('services.notification_service.generate_schedule_pdf') as mock_pdf:
            mock_pdf.return_value = b"fake_pdf_content"
            
            result = await notification_service.send_email_notification(
                staff_member=sample_staff,
                subject="Weekly Schedule",
                message="Please find your schedule attached",
                include_schedule_pdf=True,
                schedule_data={"shifts": []}
            )
            
            assert result.success is True
            mock_pdf.assert_called_once()

    @patch('services.notification_service.smtp_client.send_message')
    async def test_email_delivery_failure(self, mock_send, notification_service, sample_staff):
        """Test email delivery failure handling"""
        from smtplib import SMTPException
        
        mock_send.side_effect = SMTPException("SMTP server error")
        
        result = await notification_service.send_email_notification(
            staff_member=sample_staff,
            subject="Schedule Update",
            message="Your schedule has been updated"
        )
        
        assert result.success is False
        assert "SMTP server error" in result.error_message
        assert result.channel == "email"


class TestMultiChannelNotificationIntegration:
    """Test multi-channel notification coordination"""
    
    @pytest.fixture
    def notification_service(self):
        return NotificationService()
    
    @pytest.fixture
    def mixed_staff_list(self):
        return [
            Staff(id=1, name="WhatsApp User", phone="+1111111111", preferred_notification="whatsapp", business_id=1),
            Staff(id=2, name="SMS User", phone="+2222222222", preferred_notification="sms", business_id=1),
            Staff(id=3, name="Email User", email="email@example.com", preferred_notification="email", business_id=1),
            Staff(id=4, name="Multi User", phone="+3333333333", email="multi@example.com", preferred_notification="all", business_id=1)
        ]

    @patch('services.notification_service.send_whatsapp_notification')
    @patch('services.notification_service.send_sms_notification')
    @patch('services.notification_service.send_email_notification')
    async def test_multi_channel_notification_delivery(self, mock_email, mock_sms, mock_whatsapp, notification_service, mixed_staff_list):
        """Test coordinated multi-channel notification delivery"""
        # Mock successful responses for all channels
        mock_whatsapp.return_value = Mock(success=True, channel="whatsapp")
        mock_sms.return_value = Mock(success=True, channel="sms")
        mock_email.return_value = Mock(success=True, channel="email")
        
        schedule_draft = ScheduleDraft(
            id="draft-123",
            business_id=1,
            date_range_start=date(2024, 1, 15),
            date_range_end=date(2024, 1, 21)
        )
        
        notification_settings = NotificationSettings(
            notify_all_staff=True,
            channels=["whatsapp", "sms", "email"],
            include_schedule_summary=True
        )
        
        results = await notification_service.send_schedule_notifications(
            schedule=schedule_draft,
            staff_list=mixed_staff_list,
            settings=notification_settings
        )
        
        assert len(results) == 6  # 4 staff members, some with multiple channels
        successful_notifications = [r for r in results if r.success]
        assert len(successful_notifications) == 6
        
        # Verify each channel was called appropriately
        assert mock_whatsapp.call_count >= 1
        assert mock_sms.call_count >= 1
        assert mock_email.call_count >= 1

    @patch('services.notification_service.send_whatsapp_notification')
    @patch('services.notification_service.send_sms_notification')
    @patch('services.notification_service.send_email_notification')
    async def test_fallback_notification_channels(self, mock_email, mock_sms, mock_whatsapp, notification_service, mixed_staff_list):
        """Test fallback to alternative channels when primary fails"""
        # Mock WhatsApp failure, SMS success
        mock_whatsapp.return_value = Mock(success=False, error_message="WhatsApp failed")
        mock_sms.return_value = Mock(success=True, channel="sms")
        mock_email.return_value = Mock(success=True, channel="email")
        
        staff_with_fallback = Staff(
            id=5,
            name="Fallback User",
            phone="+4444444444",
            email="fallback@example.com",
            preferred_notification="whatsapp",
            fallback_notification="sms",
            business_id=1
        )
        
        result = await notification_service.send_notification_with_fallback(
            staff_member=staff_with_fallback,
            message="Schedule update",
            max_retries=2
        )
        
        assert result.success is True
        assert result.channel == "sms"  # Should fallback to SMS
        
        # Should have tried WhatsApp first, then SMS
        mock_whatsapp.assert_called_once()
        mock_sms.assert_called_once()


class TestExternalAPIResilience:
    """Test resilience and error handling for external API failures"""
    
    @pytest.fixture
    def notification_service(self):
        return NotificationService()

    async def test_network_timeout_handling(self, notification_service):
        """Test handling of network timeouts"""
        with patch('services.notification_service.requests.post') as mock_post:
            mock_post.side_effect = asyncio.TimeoutError("Request timeout")
            
            staff = Staff(id=1, name="Test", phone="+1111111111", preferred_notification="whatsapp", business_id=1)
            
            result = await notification_service.send_whatsapp_notification(
                staff_member=staff,
                message="Test message",
                schedule_changes=[]
            )
            
            assert result.success is False
            assert "timeout" in result.error_message.lower()

    async def test_api_rate_limit_backoff(self, notification_service):
        """Test exponential backoff for rate limiting"""
        with patch('services.notification_service.requests.post') as mock_post:
            # First call: rate limited
            # Second call: success
            mock_post.side_effect = [
                Mock(status_code=429, headers={'Retry-After': '1'}),
                Mock(status_code=200, json=lambda: {"messages": [{"id": "success"}]})
            ]
            
            staff = Staff(id=1, name="Test", phone="+1111111111", preferred_notification="whatsapp", business_id=1)
            
            start_time = datetime.now()
            result = await notification_service.send_whatsapp_notification(
                staff_member=staff,
                message="Test message",
                schedule_changes=[],
                enable_retry=True
            )
            end_time = datetime.now()
            
            assert result.success is True
            # Should have waited at least 1 second for retry
            assert (end_time - start_time).total_seconds() >= 1
            assert mock_post.call_count == 2

    async def test_circuit_breaker_pattern(self, notification_service):
        """Test circuit breaker for repeated failures"""
        with patch('services.notification_service.requests.post') as mock_post:
            # Mock repeated failures
            mock_post.side_effect = Exception("Service unavailable")
            
            staff_list = [
                Staff(id=i, name=f"Staff {i}", phone=f"+111111111{i}", preferred_notification="whatsapp", business_id=1)
                for i in range(10)
            ]
            
            results = await notification_service.send_bulk_whatsapp_notifications(
                staff_list=staff_list,
                message="Test message",
                schedule_changes=[],
                enable_circuit_breaker=True
            )
            
            # Circuit breaker should kick in after a few failures
            failed_results = [r for r in results if not r.success]
            circuit_breaker_results = [r for r in failed_results if "circuit breaker" in r.error_message.lower()]
            
            assert len(circuit_breaker_results) > 0
            # Should not have attempted all 10 calls due to circuit breaker
            assert mock_post.call_count < 10


@pytest.mark.integration
class TestEndToEndNotificationFlow:
    """End-to-end integration tests for complete notification flow"""
    
    async def test_complete_schedule_publication_flow(self):
        """Test complete flow from schedule generation to notification delivery"""
        # This would require actual external service credentials for full integration
        # For now, we'll test with mocked services but realistic data flow
        
        notification_service = NotificationService()
        
        # Mock all external services
        with patch.multiple(
            notification_service,
            send_whatsapp_notification=AsyncMock(return_value=Mock(success=True, external_id="wa-123")),
            send_sms_notification=AsyncMock(return_value=Mock(success=True, external_id="sms-123")),
            send_email_notification=AsyncMock(return_value=Mock(success=True, external_id="email-123"))
        ):
            
            staff_list = [
                Staff(id=1, name="Manager", phone="+1111111111", email="manager@restaurant.com", preferred_notification="all", business_id=1),
                Staff(id=2, name="Server", phone="+2222222222", preferred_notification="whatsapp", business_id=1),
                Staff(id=3, name="Cook", email="cook@restaurant.com", preferred_notification="email", business_id=1)
            ]
            
            schedule_draft = ScheduleDraft(
                id="draft-123",
                business_id=1,
                date_range_start=date(2024, 1, 15),
                date_range_end=date(2024, 1, 21),
                status="published"
            )
            
            notification_settings = NotificationSettings(
                notify_all_staff=True,
                channels=["whatsapp", "sms", "email"],
                include_schedule_summary=True,
                include_change_summary=True
            )
            
            results = await notification_service.send_schedule_notifications(
                schedule=schedule_draft,
                staff_list=staff_list,
                settings=notification_settings
            )
            
            # Verify all notifications were attempted
            assert len(results) >= 3
            successful_notifications = [r for r in results if r.success]
            assert len(successful_notifications) >= 3
            
            # Verify notification records were created
            notification_records = await notification_service.get_notification_history(
                draft_id="draft-123"
            )
            assert len(notification_records) >= 3