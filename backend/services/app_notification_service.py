import os
import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from sqlalchemy.orm import Session
from models import Staff, Shift, ShiftAssignment, SickLeaveRequest, EmergencyRequest, MessageLog
from services.ai import AIService

logger = logging.getLogger(__name__)

class AppNotificationService:
    """
    In-app notification service for sick leave alerts and replacement requests
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.ai_service = AIService()
    
    async def handle_sick_leave_notification(
        self,
        sick_leave_request: SickLeaveRequest,
        shift: Shift,
        sick_staff: Staff
    ) -> Dict[str, Any]:
        """
        Handle sick leave notification with AI-powered replacement finding
        """
        logger.info(f"Processing sick leave notification for staff {sick_staff.name} on shift {shift.id}")
        
        # Find qualified replacement staff based on skills
        qualified_staff = await self._find_qualified_replacement_staff(
            shift, sick_staff.id, sick_leave_request.business_id
        )
        
        # Generate AI-powered replacement message
        ai_message = await self._generate_replacement_message(
            sick_staff, shift, sick_leave_request.reason, sick_leave_request.message
        )
        
        # Create in-app notifications for qualified staff
        notifications_created = []
        for staff_member in qualified_staff:
            notification = await self._create_staff_notification(
                staff_member,
                shift,
                ai_message,
                sick_leave_request.id,
                priority="high"
            )
            notifications_created.append(notification)
        
        # Create summary notification for managers
        manager_notification = await self._create_manager_notification(
            sick_leave_request.business_id,
            sick_staff,
            shift,
            len(qualified_staff),
            sick_leave_request.reason
        )
        
        return {
            "sick_leave_id": sick_leave_request.id,
            "qualified_staff_found": len(qualified_staff),
            "notifications_sent": len(notifications_created),
            "manager_notified": bool(manager_notification),
            "ai_message_generated": bool(ai_message),
            "qualified_staff_details": [
                {
                    "staff_id": staff.id,
                    "name": staff.name,
                    "skills": staff.skills,
                    "reliability_score": staff.reliability_score,
                    "phone_number": staff.phone_number
                }
                for staff in qualified_staff
            ],
            "replacement_message": ai_message
        }
    
    async def _find_qualified_replacement_staff(
        self,
        shift: Shift,
        sick_staff_id: int,
        business_id: int
    ) -> List[Staff]:
        """
        Find staff members qualified to replace the sick staff member
        """
        # Get all active staff with the required skill
        qualified_staff = self.db.query(Staff).filter(
            Staff.business_id == business_id,
            Staff.is_active == True,
            Staff.id != sick_staff_id,  # Exclude the sick staff member
            Staff.skills.contains([shift.required_skill])
        ).all()
        
        # Filter out staff already assigned to shifts at the same time
        available_staff = []
        for staff in qualified_staff:
            if await self._is_staff_available(staff.id, shift.date, shift.start_time, shift.end_time):
                available_staff.append(staff)
        
        # Sort by reliability score (highest first)
        available_staff.sort(key=lambda s: s.reliability_score, reverse=True)
        
        logger.info(f"Found {len(available_staff)} qualified replacement staff for {shift.required_skill} skill")
        return available_staff
    
    async def _is_staff_available(
        self,
        staff_id: int,
        shift_date: datetime,
        start_time: str,
        end_time: str
    ) -> bool:
        """
        Check if staff member is available for the shift time
        """
        # Check for overlapping shift assignments
        overlapping_assignments = self.db.query(ShiftAssignment).join(Shift).filter(
            ShiftAssignment.staff_id == staff_id,
            Shift.date == shift_date.date(),
            ShiftAssignment.status.in_(["assigned", "confirmed"]),
            # Check for time overlap
            Shift.start_time < end_time,
            Shift.end_time > start_time
        ).first()
        
        return overlapping_assignments is None
    
    async def _generate_replacement_message(
        self,
        sick_staff: Staff,
        shift: Shift,
        reason: str,
        custom_message: Optional[str] = None
    ) -> str:
        """
        Generate AI-powered replacement request message
        """
        try:
            ai_message = await self.ai_service.generate_coverage_message(
                business_name="LocalOps Restaurant",
                shift_date=shift.date,
                shift_start=shift.start_time,
                shift_end=shift.end_time,
                required_skill=shift.required_skill,
                urgency="high",
                custom_message=f"{sick_staff.name} called in {reason}. {custom_message or ''}"
            )
            return ai_message
        except Exception as e:
            logger.error(f"AI message generation failed: {str(e)}")
            # Fallback message
            return f"URGENT: {sick_staff.name} called in {reason} for {shift.title} on {shift.date.strftime('%A, %B %d')} from {shift.start_time} to {shift.end_time}. Can you cover this {shift.required_skill} shift? Please respond ASAP."
    
    async def _create_staff_notification(
        self,
        staff: Staff,
        shift: Shift,
        message: str,
        sick_leave_id: int,
        priority: str = "normal"
    ) -> Dict[str, Any]:
        """
        Create in-app notification for staff member
        """
        # Log the notification in the database
        message_log = MessageLog(
            business_id=shift.business_id,
            staff_id=staff.id,
            message_type="sick_leave_replacement",
            platform="app_notification",
            phone_number=staff.phone_number,
            message_content=message,
            status="sent",
            priority=priority,
            metadata={
                "sick_leave_id": sick_leave_id,
                "shift_id": shift.id,
                "required_skill": shift.required_skill,
                "shift_date": shift.date.isoformat(),
                "shift_time": f"{shift.start_time}-{shift.end_time}"
            }
        )
        
        self.db.add(message_log)
        self.db.commit()
        self.db.refresh(message_log)
        
        return {
            "notification_id": message_log.id,
            "staff_id": staff.id,
            "staff_name": staff.name,
            "message": message,
            "priority": priority,
            "created_at": message_log.created_at,
            "metadata": message_log.metadata
        }
    
    async def _create_manager_notification(
        self,
        business_id: int,
        sick_staff: Staff,
        shift: Shift,
        qualified_staff_count: int,
        reason: str
    ) -> Optional[Dict[str, Any]]:
        """
        Create notification for managers about the sick leave situation
        """
        # Find managers (staff with management skills or roles)
        managers = self.db.query(Staff).filter(
            Staff.business_id == business_id,
            Staff.is_active == True,
            Staff.skills.contains(["management"])
        ).all()
        
        if not managers:
            # Fallback to staff with management roles
            managers = self.db.query(Staff).filter(
                Staff.business_id == business_id,
                Staff.is_active == True,
                Staff.role.in_(["manager", "assistant_manager", "head_chef"])
            ).all()
        
        if not managers:
            logger.warning(f"No managers found for business {business_id}")
            return None
        
        manager_message = f"STAFF ALERT: {sick_staff.name} called in {reason} for {shift.title} on {shift.date.strftime('%A, %B %d')} ({shift.start_time}-{shift.end_time}). {qualified_staff_count} qualified replacement staff have been notified. Please monitor responses and take action if needed."
        
        # Create notification for the first manager (or all managers)
        manager = managers[0]  # For now, notify the first manager
        
        message_log = MessageLog(
            business_id=business_id,
            staff_id=manager.id,
            message_type="sick_leave_manager_alert",
            platform="app_notification",
            phone_number=manager.phone_number,
            message_content=manager_message,
            status="sent",
            priority="high",
            metadata={
                "sick_staff_id": sick_staff.id,
                "shift_id": shift.id,
                "qualified_staff_count": qualified_staff_count,
                "reason": reason
            }
        )
        
        self.db.add(message_log)
        self.db.commit()
        self.db.refresh(message_log)
        
        return {
            "notification_id": message_log.id,
            "manager_id": manager.id,
            "manager_name": manager.name,
            "message": manager_message,
            "qualified_staff_count": qualified_staff_count
        }
    
    async def get_staff_notifications(
        self,
        staff_id: int,
        unread_only: bool = False,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Get notifications for a specific staff member
        """
        query = self.db.query(MessageLog).filter(
            MessageLog.staff_id == staff_id,
            MessageLog.platform == "app_notification"
        )
        
        if unread_only:
            query = query.filter(MessageLog.read_at.is_(None))
        
        notifications = query.order_by(MessageLog.created_at.desc()).limit(limit).all()
        
        return [
            {
                "id": notif.id,
                "message": notif.message_content,
                "priority": notif.priority,
                "created_at": notif.created_at,
                "read_at": notif.read_at,
                "metadata": notif.metadata
            }
            for notif in notifications
        ]
    
    async def mark_notification_read(self, notification_id: int, staff_id: int) -> bool:
        """
        Mark a notification as read
        """
        notification = self.db.query(MessageLog).filter(
            MessageLog.id == notification_id,
            MessageLog.staff_id == staff_id,
            MessageLog.platform == "app_notification"
        ).first()
        
        if notification:
            notification.read_at = datetime.now()
            self.db.commit()
            return True
        
        return False
    
    async def respond_to_replacement_request(
        self,
        notification_id: int,
        staff_id: int,
        response: str,  # "accept", "decline", "maybe"
        message: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Handle staff response to replacement request
        """
        notification = self.db.query(MessageLog).filter(
            MessageLog.id == notification_id,
            MessageLog.staff_id == staff_id,
            MessageLog.message_type == "sick_leave_replacement"
        ).first()
        
        if not notification:
            raise ValueError("Notification not found")
        
        # Update notification with response
        if not notification.metadata:
            notification.metadata = {}
        
        notification.metadata["response"] = response
        notification.metadata["response_message"] = message
        notification.metadata["response_at"] = datetime.now().isoformat()
        notification.read_at = datetime.now()
        
        self.db.commit()
        
        # If accepted, create shift assignment
        if response == "accept" and notification.metadata.get("shift_id"):
            shift_id = notification.metadata["shift_id"]
            
            # Create new shift assignment
            new_assignment = ShiftAssignment(
                shift_id=shift_id,
                staff_id=staff_id,
                status="assigned",
                assigned_at=datetime.now()
            )
            
            self.db.add(new_assignment)
            
            # Update the shift status
            shift = self.db.query(Shift).filter(Shift.id == shift_id).first()
            if shift:
                shift.status = "filled"
            
            # Update sick leave request
            sick_leave_id = notification.metadata.get("sick_leave_id")
            if sick_leave_id:
                sick_leave = self.db.query(SickLeaveRequest).filter(
                    SickLeaveRequest.id == sick_leave_id
                ).first()
                if sick_leave:
                    sick_leave.replacement_found = True
                    sick_leave.replacement_staff_id = staff_id
            
            self.db.commit()
            
            # Notify managers about the acceptance
            await self._notify_managers_of_replacement(
                notification.business_id,
                staff_id,
                shift_id,
                sick_leave_id
            )
        
        return {
            "notification_id": notification_id,
            "response": response,
            "message": message,
            "shift_assigned": response == "accept",
            "processed_at": datetime.now().isoformat()
        }
    
    async def _notify_managers_of_replacement(
        self,
        business_id: int,
        replacement_staff_id: int,
        shift_id: int,
        sick_leave_id: Optional[int] = None
    ):
        """
        Notify managers when someone accepts a replacement shift
        """
        replacement_staff = self.db.query(Staff).filter(Staff.id == replacement_staff_id).first()
        shift = self.db.query(Shift).filter(Shift.id == shift_id).first()
        
        if not replacement_staff or not shift:
            return
        
        managers = self.db.query(Staff).filter(
            Staff.business_id == business_id,
            Staff.is_active == True,
            Staff.skills.contains(["management"])
        ).all()
        
        if not managers:
            return
        
        manager_message = f"REPLACEMENT FOUND: {replacement_staff.name} has accepted the replacement shift for {shift.title} on {shift.date.strftime('%A, %B %d')} ({shift.start_time}-{shift.end_time}). The shift is now fully staffed."
        
        for manager in managers:
            message_log = MessageLog(
                business_id=business_id,
                staff_id=manager.id,
                message_type="replacement_accepted",
                platform="app_notification",
                phone_number=manager.phone_number,
                message_content=manager_message,
                status="sent",
                priority="normal",
                metadata={
                    "replacement_staff_id": replacement_staff_id,
                    "shift_id": shift_id,
                    "sick_leave_id": sick_leave_id
                }
            )
            
            self.db.add(message_log)
        
        self.db.commit() 