import os
import json
import logging
import asyncio
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_

from models import (
    ScheduleNotification, ScheduleDraft, Staff, Shift, ShiftAssignment, 
    DraftShiftAssignment, Business
)
from services.messaging import WhatsAppService, SMSService
from services.smart_communication import EmailService
from services.error_handler import error_handler, ErrorContext
from exceptions import NotificationException, ExternalAPIException

logger = logging.getLogger(__name__)


class NotificationService:
    """Multi-channel notification service for schedule management"""
    
    def __init__(self, db: Session):
        self.db = db
        self.whatsapp_service = WhatsAppService()
        self.sms_service = SMSService()
        self.email_service = EmailService()
    
    async def send_schedule_notifications(
        self,
        draft_id: str,
        notification_settings: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Send schedule notifications to all affected staff members
        
        Args:
            draft_id: Schedule draft ID
            notification_settings: Notification preferences and channels
            
        Returns:
            Dictionary with notification results and statistics
        """
        try:
            # Get draft and validate
            draft = self.db.query(ScheduleDraft).filter(
                ScheduleDraft.id == draft_id
            ).first()
            
            if not draft:
                raise ValueError(f"Schedule draft {draft_id} not found")
            
            # Get all staff assignments for this draft
            assignments = self.db.query(DraftShiftAssignment).filter(
                DraftShiftAssignment.draft_id == draft_id
            ).all()
            
            if not assignments:
                logger.warning(f"No assignments found for draft {draft_id}")
                return {
                    "success": True,
                    "notifications_sent": 0,
                    "failed_notifications": 0,
                    "message": "No staff assignments to notify"
                }
            
            # Group assignments by staff member
            staff_assignments = self._group_assignments_by_staff(assignments)
            
            # Generate personalized messages for each staff member
            notification_results = []
            successful_notifications = 0
            failed_notifications = 0
            
            for staff_id, staff_shifts in staff_assignments.items():
                try:
                    # Get staff details
                    staff = self.db.query(Staff).filter(Staff.id == staff_id).first()
                    if not staff:
                        logger.error(f"Staff member {staff_id} not found")
                        failed_notifications += 1
                        continue
                    
                    # Generate personalized message
                    message_content = await self._generate_schedule_message(
                        staff, staff_shifts, draft, notification_settings
                    )
                    
                    # Send notifications through preferred channels
                    channels = notification_settings.get("channels", ["whatsapp", "sms", "email"])
                    channel_results = await self._send_multi_channel_notification(
                        staff, message_content, channels, draft_id, "new_schedule"
                    )
                    
                    # Track results
                    if any(result["success"] for result in channel_results):
                        successful_notifications += 1
                    else:
                        failed_notifications += 1
                    
                    notification_results.append({
                        "staff_id": staff_id,
                        "staff_name": staff.name,
                        "channels": channel_results
                    })
                    
                except Exception as e:
                    logger.error(f"Failed to notify staff {staff_id}: {str(e)}")
                    failed_notifications += 1
            
            return {
                "success": True,
                "notifications_sent": successful_notifications,
                "failed_notifications": failed_notifications,
                "total_staff": len(staff_assignments),
                "results": notification_results,
                "message": f"Notifications sent to {successful_notifications} staff members"
            }
            
        except Exception as e:
            logger.error(f"Schedule notification failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "notifications_sent": 0,
                "failed_notifications": 0
            }
    
    async def send_schedule_change_notifications(
        self,
        draft_id: str,
        changes: List[Dict[str, Any]],
        notification_settings: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Send notifications about schedule changes to affected staff
        
        Args:
            draft_id: Schedule draft ID
            changes: List of schedule changes made
            notification_settings: Notification preferences
            
        Returns:
            Dictionary with notification results
        """
        try:
            # Get affected staff from changes
            affected_staff_ids = set()
            for change in changes:
                if change.get("staff_id"):
                    affected_staff_ids.add(change["staff_id"])
                # Also check for previous assignments that were removed
                if change.get("previous_staff_id"):
                    affected_staff_ids.add(change["previous_staff_id"])
            
            if not affected_staff_ids:
                return {
                    "success": True,
                    "notifications_sent": 0,
                    "message": "No staff affected by changes"
                }
            
            # Generate change summaries for each affected staff member
            notification_results = []
            successful_notifications = 0
            failed_notifications = 0
            
            for staff_id in affected_staff_ids:
                try:
                    staff = self.db.query(Staff).filter(Staff.id == staff_id).first()
                    if not staff:
                        continue
                    
                    # Generate change summary for this staff member
                    change_summary = await self._generate_change_summary(
                        staff_id, changes, draft_id
                    )
                    
                    if not change_summary["has_changes"]:
                        continue
                    
                    # Send change notification
                    channels = notification_settings.get("channels", ["whatsapp", "sms"])
                    channel_results = await self._send_multi_channel_notification(
                        staff, change_summary["message"], channels, draft_id, "schedule_change"
                    )
                    
                    if any(result["success"] for result in channel_results):
                        successful_notifications += 1
                    else:
                        failed_notifications += 1
                    
                    notification_results.append({
                        "staff_id": staff_id,
                        "staff_name": staff.name,
                        "changes": change_summary["changes"],
                        "channels": channel_results
                    })
                    
                except Exception as e:
                    logger.error(f"Failed to notify staff {staff_id} about changes: {str(e)}")
                    failed_notifications += 1
            
            return {
                "success": True,
                "notifications_sent": successful_notifications,
                "failed_notifications": failed_notifications,
                "results": notification_results
            }
            
        except Exception as e:
            logger.error(f"Change notification failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "notifications_sent": 0,
                "failed_notifications": 0
            }
    
    def _group_assignments_by_staff(
        self, 
        assignments: List[DraftShiftAssignment]
    ) -> Dict[int, List[DraftShiftAssignment]]:
        """Group shift assignments by staff member"""
        staff_assignments = {}
        for assignment in assignments:
            if assignment.staff_id not in staff_assignments:
                staff_assignments[assignment.staff_id] = []
            staff_assignments[assignment.staff_id].append(assignment)
        return staff_assignments
    
    async def _generate_schedule_message(
        self,
        staff: Staff,
        assignments: List[DraftShiftAssignment],
        draft: ScheduleDraft,
        settings: Dict[str, Any]
    ) -> str:
        """Generate personalized schedule message for staff member"""
        
        # Get business info
        business = self.db.query(Business).filter(
            Business.id == draft.business_id
        ).first()
        business_name = business.name if business else "Restaurant"
        
        # Format date range
        date_range = f"{draft.date_range_start.strftime('%B %d')} - {draft.date_range_end.strftime('%B %d, %Y')}"
        
        # Custom message from manager
        custom_message = settings.get("custom_message", "")
        
        # Build shift details
        shift_details = []
        total_hours = 0
        
        for assignment in assignments:
            shift = self.db.query(Shift).filter(Shift.id == assignment.shift_id).first()
            if shift:
                shift_date = shift.date.strftime('%A, %B %d')
                shift_time = f"{shift.start_time} - {shift.end_time}"
                shift_role = shift.required_skill.replace('_', ' ').title()
                
                shift_details.append(f"• {shift_date}: {shift_time} ({shift_role})")
                
                # Calculate hours (simple approximation)
                try:
                    start_hour = int(shift.start_time.split(':')[0])
                    end_hour = int(shift.end_time.split(':')[0])
                    if end_hour < start_hour:  # Next day
                        end_hour += 24
                    total_hours += (end_hour - start_hour)
                except:
                    pass
        
        # Build message
        message_parts = [
            f"Hi {staff.name}! 👋",
            "",
            f"Your schedule for {date_range} is ready:",
            "",
            *shift_details,
            "",
            f"Total hours: ~{total_hours} hours" if total_hours > 0 else "",
        ]
        
        if custom_message:
            message_parts.extend(["", f"Manager's note: {custom_message}"])
        
        message_parts.extend([
            "",
            f"Thanks for being part of the {business_name} team! 🙌",
            "",
            "Questions? Reply to this message or contact your manager."
        ])
        
        return "\n".join(filter(None, message_parts)) 
   
    async def _generate_change_summary(
        self,
        staff_id: int,
        changes: List[Dict[str, Any]],
        draft_id: str
    ) -> Dict[str, Any]:
        """Generate change summary for specific staff member"""
        
        staff_changes = []
        has_changes = False
        
        for change in changes:
            if change.get("staff_id") == staff_id or change.get("previous_staff_id") == staff_id:
                shift = self.db.query(Shift).filter(Shift.id == change["shift_id"]).first()
                if not shift:
                    continue
                
                shift_date = shift.date.strftime('%A, %B %d')
                shift_time = f"{shift.start_time} - {shift.end_time}"
                shift_role = shift.required_skill.replace('_', ' ').title()
                
                if change["action"] == "assign" and change.get("staff_id") == staff_id:
                    staff_changes.append(f"✅ Added: {shift_date} {shift_time} ({shift_role})")
                    has_changes = True
                elif change["action"] == "unassign" and change.get("previous_staff_id") == staff_id:
                    staff_changes.append(f"❌ Removed: {shift_date} {shift_time} ({shift_role})")
                    has_changes = True
                elif change["action"] == "modify" and change.get("staff_id") == staff_id:
                    staff_changes.append(f"📝 Modified: {shift_date} {shift_time} ({shift_role})")
                    has_changes = True
        
        if not has_changes:
            return {"has_changes": False, "changes": [], "message": ""}
        
        # Get staff info
        staff = self.db.query(Staff).filter(Staff.id == staff_id).first()
        staff_name = staff.name if staff else "Team Member"
        
        # Build change message
        message_parts = [
            f"Hi {staff_name}! 📅",
            "",
            "Your schedule has been updated:",
            "",
            *staff_changes,
            "",
            "Please check your updated schedule and let us know if you have any questions.",
            "",
            "Thanks! 🙌"
        ]
        
        return {
            "has_changes": True,
            "changes": staff_changes,
            "message": "\n".join(message_parts)
        }
    
    async def _send_multi_channel_notification(
        self,
        staff: Staff,
        message_content: str,
        channels: List[str],
        draft_id: str,
        notification_type: str
    ) -> List[Dict[str, Any]]:
        """Send notification through multiple channels with comprehensive error handling and fallback"""
        
        error_context = ErrorContext(
            operation="send_multi_channel_notification",
            additional_data={
                "staff_id": staff.id,
                "staff_name": staff.name,
                "channels": channels,
                "notification_type": notification_type
            }
        )
        
        results = []
        notification_sent = False
        
        # Try each channel in order of preference with retry logic
        for channel in channels:
            try:
                result = await self._send_notification_with_retry(
                    staff, message_content, channel, draft_id, notification_type
                )
                results.append({"channel": channel, **result})
                
                if result["success"]:
                    notification_sent = True
                    break  # Stop after first successful delivery
                
            except NotificationException as e:
                # Handle known notification errors
                logger.warning(f"Notification error for {channel} to {staff.name}: {str(e)}")
                
                error_result = await error_handler.handle_error(e, error_context, enable_fallback=True)
                
                results.append({
                    "channel": channel,
                    "success": False,
                    "error": str(e),
                    "error_id": error_result.get("error_id"),
                    "recovery_attempted": error_result.get("recovery", {}).get("strategy")
                })
                
            except Exception as e:
                # Handle unexpected errors
                logger.error(f"Unexpected error sending {channel} notification to {staff.name}: {str(e)}")
                
                # Convert to notification exception for consistent handling
                notification_error = NotificationException(
                    message=f"Unexpected error: {str(e)}",
                    channel=channel,
                    staff_id=staff.id,
                    details={"original_error": type(e).__name__}
                )
                
                error_result = await error_handler.handle_error(notification_error, error_context, enable_fallback=True)
                
                results.append({
                    "channel": channel,
                    "success": False,
                    "error": str(e),
                    "error_id": error_result.get("error_id")
                })
        
        # If no channels worked, try SMS as final fallback with error handling
        if not notification_sent and "sms" not in channels and staff.phone_number:
            try:
                logger.info(f"Attempting SMS fallback for {staff.name}")
                result = await self._send_notification_with_retry(
                    staff, message_content, "sms", draft_id, notification_type
                )
                results.append({"channel": "sms_fallback", **result})
                
                if result["success"]:
                    notification_sent = True
                    
            except Exception as e:
                logger.error(f"SMS fallback failed for {staff.name}: {str(e)}")
                results.append({
                    "channel": "sms_fallback",
                    "success": False,
                    "error": str(e)
                })
        
        # If still no success, log the complete failure
        if not notification_sent:
            logger.error(f"All notification channels failed for staff {staff.name} (ID: {staff.id})")
            
            # Create a comprehensive notification failure record
            failure_notification = ScheduleNotification(
                draft_id=draft_id,
                staff_id=staff.id,
                notification_type=notification_type,
                channel="all_failed",
                content=message_content,
                status="failed",
                sent_at=None
            )
            self.db.add(failure_notification)
            self.db.commit()
        
        return results
    
    async def _send_notification_with_retry(
        self,
        staff: Staff,
        message_content: str,
        channel: str,
        draft_id: str,
        notification_type: str,
        max_retries: int = 3,
        notification_settings: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Send notification with retry mechanism and exponential backoff"""
        
        # Use settings from notification_settings if provided
        if notification_settings:
            max_retries = notification_settings.get("max_retry_attempts", max_retries)
            if not notification_settings.get("retry_failed_notifications", True):
                max_retries = 1
        
        last_error = None
        notification_record = None
        
        # Create initial notification record
        try:
            notification_record = ScheduleNotification(
                draft_id=draft_id,
                staff_id=staff.id,
                notification_type=notification_type,
                channel=channel,
                content=message_content,
                status="pending"
            )
            self.db.add(notification_record)
            self.db.commit()
        except Exception as e:
            logger.error(f"Failed to create notification record: {str(e)}")
        
        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    # Exponential backoff: 1s, 2s, 4s
                    delay = min(2 ** attempt, 8)
                    logger.info(f"Retrying {channel} notification for {staff.name} in {delay}s (attempt {attempt + 1}/{max_retries})")
                    await asyncio.sleep(delay)
                
                # Send notification based on channel
                if channel == "whatsapp" and staff.phone_number:
                    result = await self._send_whatsapp_notification(
                        staff, message_content, draft_id, notification_type
                    )
                elif channel == "sms" and staff.phone_number:
                    result = await self._send_sms_notification(
                        staff, message_content, draft_id, notification_type
                    )
                elif channel == "email" and staff.email:
                    result = await self._send_email_notification(
                        staff, message_content, draft_id, notification_type
                    )
                else:
                    return {
                        "success": False,
                        "error": f"Invalid channel or missing contact info: {channel}",
                        "attempts": attempt + 1
                    }
                
                # If successful, update notification record and return
                if result["success"]:
                    if notification_record:
                        notification_record.status = "sent"
                        notification_record.sent_at = datetime.now()
                        notification_record.external_id = result.get("message_id")
                        self.db.commit()
                    
                    result["attempts"] = attempt + 1
                    result["notification_id"] = notification_record.id if notification_record else None
                    return result
                
                # Store the error for potential retry
                last_error = result.get("error", "Unknown error")
                
                # Update notification record with retry status
                if notification_record:
                    notification_record.status = "retrying" if attempt < max_retries - 1 else "failed"
                    notification_record.retry_count = attempt + 1
                    notification_record.error_message = result.get("error", "Unknown error")
                    self.db.commit()
                
                # Check if this is a permanent failure (don't retry)
                if self._is_permanent_failure(result.get("error", "")):
                    logger.warning(f"Permanent failure detected for {channel} to {staff.name}: {last_error}")
                    if notification_record:
                        notification_record.status = "failed"
                        self.db.commit()
                    
                    # Return immediately for permanent failures
                    return {
                        "success": False,
                        "error": last_error,
                        "attempts": attempt + 1,
                        "permanent_failure": True,
                        "notification_id": notification_record.id if notification_record else None
                    }
                
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Attempt {attempt + 1} failed for {channel} to {staff.name}: {str(e)}")
                
                # Update notification record with error
                if notification_record:
                    notification_record.status = "retrying" if attempt < max_retries - 1 else "failed"
                    notification_record.retry_count = attempt + 1
                    notification_record.error_message = str(e)
                    self.db.commit()
        
        # All retries failed - final update to notification record
        if notification_record:
            notification_record.status = "failed"
            self.db.commit()
        
        return {
            "success": False,
            "error": last_error,
            "attempts": max_retries,
            "retry_exhausted": True,
            "notification_id": notification_record.id if notification_record else None
        }
    
    def _is_permanent_failure(self, error_message: str) -> bool:
        """Determine if an error represents a permanent failure that shouldn't be retried"""
        permanent_error_indicators = [
            "invalid phone number",
            "invalid email address",
            "blocked",
            "unsubscribed",
            "invalid recipient",
            "authentication failed",
            "unauthorized",
            "failed to send whatsapp notification: invalid phone number",
            "failed to send sms notification: invalid phone number",
            "failed to send email notification: invalid email address"
        ]
        
        error_lower = error_message.lower()
        return any(indicator in error_lower for indicator in permanent_error_indicators)
    
    async def _send_whatsapp_notification_safe(
        self,
        staff: Staff,
        message_content: str,
        draft_id: str,
        notification_type: str
    ) -> Dict[str, Any]:
        """Send WhatsApp notification with comprehensive error handling"""
        
        try:
            # Validate phone number
            if not staff.phone_number:
                raise NotificationException(
                    message="Staff member has no phone number",
                    channel="whatsapp",
                    staff_id=staff.id
                )
            
            # Send via WhatsApp service
            result = await self.whatsapp_service.send_coverage_request(
                phone_number=staff.phone_number,
                staff_name=staff.name,
                message=message_content,
                request_id=0  # Not used for schedule notifications
            )
            
            # Log notification to database
            notification = ScheduleNotification(
                draft_id=draft_id,
                staff_id=staff.id,
                notification_type=notification_type,
                channel="whatsapp",
                content=message_content,
                status="sent" if result["success"] else "failed",
                sent_at=datetime.now() if result["success"] else None,
                external_id=result.get("message_id")
            )
            self.db.add(notification)
            self.db.commit()
            
            if not result["success"]:
                raise NotificationException(
                    message=result.get("error", "WhatsApp delivery failed"),
                    channel="whatsapp",
                    staff_id=staff.id,
                    details={"external_error": result.get("error")}
                )
            
            return {
                "success": True,
                "message_id": result.get("message_id"),
                "channel": "whatsapp"
            }
            
        except NotificationException:
            raise  # Re-raise notification exceptions
        except Exception as e:
            logger.error(f"WhatsApp notification failed: {str(e)}")
            raise NotificationException(
                message=f"WhatsApp service error: {str(e)}",
                channel="whatsapp",
                staff_id=staff.id,
                details={"original_error": type(e).__name__}
            )
    
    async def _send_whatsapp_notification(
        self,
        staff: Staff,
        message_content: str,
        draft_id: str,
        notification_type: str
    ) -> Dict[str, Any]:
        """Send WhatsApp notification and log to database (legacy method)"""
        
        try:
            return await self._send_whatsapp_notification_safe(
                staff, message_content, draft_id, notification_type
            )
        except NotificationException as e:
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"WhatsApp notification failed: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def _send_sms_notification_safe(
        self,
        staff: Staff,
        message_content: str,
        draft_id: str,
        notification_type: str
    ) -> Dict[str, Any]:
        """Send SMS notification with comprehensive error handling"""
        
        try:
            # Validate phone number
            if not staff.phone_number:
                raise NotificationException(
                    message="Staff member has no phone number",
                    channel="sms",
                    staff_id=staff.id
                )
            
            # Send via SMS service
            result = await self.sms_service.send_sms(
                phone_number=staff.phone_number,
                message=message_content
            )
            
            # Log notification to database
            notification = ScheduleNotification(
                draft_id=draft_id,
                staff_id=staff.id,
                notification_type=notification_type,
                channel="sms",
                content=message_content,
                status="sent" if result["success"] else "failed",
                sent_at=datetime.now() if result["success"] else None,
                external_id=result.get("message_id")
            )
            self.db.add(notification)
            self.db.commit()
            
            if not result["success"]:
                raise NotificationException(
                    message=result.get("error", "SMS delivery failed"),
                    channel="sms",
                    staff_id=staff.id,
                    details={"external_error": result.get("error")}
                )
            
            return {
                "success": True,
                "message_id": result.get("message_id"),
                "channel": "sms"
            }
            
        except NotificationException:
            raise  # Re-raise notification exceptions
        except Exception as e:
            logger.error(f"SMS notification failed: {str(e)}")
            raise NotificationException(
                message=f"SMS service error: {str(e)}",
                channel="sms",
                staff_id=staff.id,
                details={"original_error": type(e).__name__}
            )
    
    async def _send_sms_notification(
        self,
        staff: Staff,
        message_content: str,
        draft_id: str,
        notification_type: str
    ) -> Dict[str, Any]:
        """Send SMS notification and log to database (legacy method)"""
        
        try:
            return await self._send_sms_notification_safe(
                staff, message_content, draft_id, notification_type
            )
        except NotificationException as e:
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"SMS notification failed: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def _send_email_notification_safe(
        self,
        staff: Staff,
        message_content: str,
        draft_id: str,
        notification_type: str
    ) -> Dict[str, Any]:
        """Send email notification with comprehensive error handling"""
        
        try:
            # Validate email address
            if not staff.email:
                raise NotificationException(
                    message="Staff member has no email address",
                    channel="email",
                    staff_id=staff.id
                )
            
            # Get business info for email subject
            draft = self.db.query(ScheduleDraft).filter(
                ScheduleDraft.id == draft_id
            ).first()
            
            business = self.db.query(Business).filter(
                Business.id == draft.business_id
            ).first() if draft else None
            
            business_name = business.name if business else "Restaurant"
            
            # Determine email subject
            if notification_type == "new_schedule":
                subject = f"Your Schedule - {business_name}"
            else:
                subject = f"Schedule Update - {business_name}"
            
            # Send via email service
            result = await self.email_service.send_email(
                to_email=staff.email,
                subject=subject,
                content=message_content,
                staff_name=staff.name
            )
            
            # Log notification to database
            notification = ScheduleNotification(
                draft_id=draft_id,
                staff_id=staff.id,
                notification_type=notification_type,
                channel="email",
                content=message_content,
                status="sent" if result["success"] else "failed",
                sent_at=datetime.now() if result["success"] else None,
                external_id=result.get("message_id")
            )
            self.db.add(notification)
            self.db.commit()
            
            if not result["success"]:
                raise NotificationException(
                    message=result.get("error", "Email delivery failed"),
                    channel="email",
                    staff_id=staff.id,
                    details={"external_error": result.get("error")}
                )
            
            return {
                "success": True,
                "message_id": result.get("message_id"),
                "channel": "email"
            }
            
        except NotificationException:
            raise  # Re-raise notification exceptions
        except Exception as e:
            logger.error(f"Email notification failed: {str(e)}")
            raise NotificationException(
                message=f"Email service error: {str(e)}",
                channel="email",
                staff_id=staff.id,
                details={"original_error": type(e).__name__}
            )
    
    async def _send_email_notification(
        self,
        staff: Staff,
        message_content: str,
        draft_id: str,
        notification_type: str
    ) -> Dict[str, Any]:
        """Send email notification and log to database (legacy method)"""
        
        try:
            return await self._send_email_notification_safe(
                staff, message_content, draft_id, notification_type
            )
        except NotificationException as e:
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Email notification failed: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_notification_status(
        self,
        draft_id: str
    ) -> Dict[str, Any]:
        """Get notification delivery status for a schedule draft"""
        
        try:
            notifications = self.db.query(ScheduleNotification).filter(
                ScheduleNotification.draft_id == draft_id
            ).all()
            
            if not notifications:
                return {
                    "success": True,
                    "notifications": [],
                    "summary": {},
                    "total_notifications": 0,
                    "success_rate": 0.0
                }
            
            # Build notification status list
            notification_statuses = []
            status_counts = {}
            
            for notification in notifications:
                # Get staff name
                staff = self.db.query(Staff).filter(Staff.id == notification.staff_id).first()
                staff_name = staff.name if staff else f"Staff {notification.staff_id}"
                
                status_info = {
                    "id": notification.id,
                    "draft_id": notification.draft_id,
                    "staff_id": notification.staff_id,
                    "staff_name": staff_name,
                    "notification_type": notification.notification_type,
                    "channel": notification.channel,
                    "status": notification.status,
                    "sent_at": notification.sent_at,
                    "delivered_at": notification.delivered_at,
                    "retry_count": getattr(notification, 'retry_count', 0),
                    "error_message": getattr(notification, 'error_message', None),
                    "external_id": notification.external_id
                }
                
                notification_statuses.append(status_info)
                
                # Count statuses
                status = notification.status
                status_counts[status] = status_counts.get(status, 0) + 1
            
            # Calculate success rate
            successful = status_counts.get("sent", 0) + status_counts.get("delivered", 0)
            total = len(notifications)
            success_rate = (successful / total * 100) if total > 0 else 0
            
            return {
                "success": True,
                "notifications": notification_statuses,
                "summary": status_counts,
                "total_notifications": total,
                "success_rate": round(success_rate, 2)
            }
            
        except Exception as e:
            logger.error(f"Failed to get notification status: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "notifications": [],
                "summary": {},
                "total_notifications": 0,
                "success_rate": 0.0
            }
    
    async def retry_failed_notifications(
        self,
        draft_id: str,
        notification_ids: List[int] = None
    ) -> Dict[str, Any]:
        """Retry failed notifications for a schedule draft"""
        
        try:
            # Build query for failed notifications
            query = self.db.query(ScheduleNotification).filter(
                and_(
                    ScheduleNotification.draft_id == draft_id,
                    ScheduleNotification.status.in_(["failed", "retrying"])
                )
            )
            
            # Filter by specific notification IDs if provided
            if notification_ids:
                query = query.filter(ScheduleNotification.id.in_(notification_ids))
            
            failed_notifications = query.all()
            
            if not failed_notifications:
                return {
                    "success": True,
                    "message": "No failed notifications to retry",
                    "retried_count": 0,
                    "successful_retries": 0,
                    "failed_retries": 0
                }
            
            retried_count = 0
            successful_retries = 0
            failed_retries = 0
            
            for notification in failed_notifications:
                try:
                    # Get staff details
                    staff = self.db.query(Staff).filter(Staff.id == notification.staff_id).first()
                    if not staff:
                        logger.error(f"Staff {notification.staff_id} not found for notification retry")
                        failed_retries += 1
                        continue
                    
                    # Reset notification status for retry
                    notification.status = "pending"
                    notification.retry_count = getattr(notification, 'retry_count', 0)
                    notification.error_message = None
                    self.db.commit()
                    
                    # Attempt to resend
                    result = await self._send_notification_with_retry(
                        staff=staff,
                        message_content=notification.content,
                        channel=notification.channel,
                        draft_id=notification.draft_id,
                        notification_type=notification.notification_type,
                        max_retries=2  # Fewer retries for manual retry
                    )
                    
                    retried_count += 1
                    
                    if result["success"]:
                        successful_retries += 1
                        # Update original notification record
                        notification.status = "sent"
                        notification.sent_at = datetime.now()
                        notification.external_id = result.get("message_id")
                        self.db.commit()
                        logger.info(f"Successfully retried notification {notification.id} for staff {staff.name}")
                    else:
                        failed_retries += 1
                        # Update original notification record with failure
                        notification.status = "failed"
                        notification.error_message = result.get("error")
                        notification.retry_count = getattr(notification, 'retry_count', 0) + 1
                        self.db.commit()
                        logger.warning(f"Retry failed for notification {notification.id}: {result.get('error')}")
                    
                except Exception as e:
                    logger.error(f"Error retrying notification {notification.id}: {str(e)}")
                    failed_retries += 1
            
            return {
                "success": True,
                "message": f"Retried {retried_count} notifications",
                "retried_count": retried_count,
                "successful_retries": successful_retries,
                "failed_retries": failed_retries
            }
            
        except Exception as e:
            logger.error(f"Failed to retry notifications: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "retried_count": 0,
                "successful_retries": 0,
                "failed_retries": 0
            }
    
    async def update_delivery_status(
        self,
        external_id: str,
        status: str,
        delivered_at: datetime = None
    ) -> bool:
        """Update notification delivery status from external service webhook"""
        
        try:
            notification = self.db.query(ScheduleNotification).filter(
                ScheduleNotification.external_id == external_id
            ).first()
            
            if not notification:
                logger.warning(f"Notification with external_id {external_id} not found")
                return False
            
            # Update status
            if status in ["delivered", "read", "failed"]:
                notification.status = status
                if delivered_at:
                    notification.delivered_at = delivered_at
                elif status == "delivered":
                    notification.delivered_at = datetime.now()
                
                self.db.commit()
                logger.info(f"Updated notification {notification.id} status to {status}")
                return True
            else:
                logger.warning(f"Invalid status update: {status}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to update delivery status: {str(e)}")
            return False
    

            
        except Exception as e:
            logger.error(f"Failed to get notification status: {str(e)}")
            return {
                "draft_id": draft_id,
                "error": str(e),
                "total_notifications": 0
            }
    



class ScheduleChangeDetector:
    """Utility class to detect and summarize schedule changes"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def detect_changes(
        self,
        original_assignments: List[DraftShiftAssignment],
        updated_assignments: List[DraftShiftAssignment]
    ) -> List[Dict[str, Any]]:
        """Detect changes between two sets of assignments"""
        
        changes = []
        
        # Create lookup dictionaries
        original_by_shift = {a.shift_id: a for a in original_assignments}
        updated_by_shift = {a.shift_id: a for a in updated_assignments}
        
        # Find all shift IDs
        all_shift_ids = set(original_by_shift.keys()) | set(updated_by_shift.keys())
        
        for shift_id in all_shift_ids:
            original = original_by_shift.get(shift_id)
            updated = updated_by_shift.get(shift_id)
            
            if original and not updated:
                # Assignment removed
                changes.append({
                    "shift_id": shift_id,
                    "action": "unassign",
                    "previous_staff_id": original.staff_id,
                    "staff_id": None
                })
            
            elif not original and updated:
                # New assignment
                changes.append({
                    "shift_id": shift_id,
                    "action": "assign",
                    "previous_staff_id": None,
                    "staff_id": updated.staff_id
                })
            
            elif original and updated and original.staff_id != updated.staff_id:
                # Staff changed
                changes.append({
                    "shift_id": shift_id,
                    "action": "reassign",
                    "previous_staff_id": original.staff_id,
                    "staff_id": updated.staff_id
                })
        
        return changes