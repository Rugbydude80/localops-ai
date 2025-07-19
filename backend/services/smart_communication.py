import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from sqlalchemy.orm import Session
from models import SmartMessage, MessageDelivery, Staff, Business
from services.ai import AIService
from services.messaging import WhatsAppService, SMSService
import json
import asyncio

class SmartCommunicationHub:
    def __init__(self, db: Session):
        self.db = db
        self.ai_service = AIService()
        self.whatsapp_service = WhatsAppService()
        self.sms_service = SMSService()
    
    async def send_smart_message(self, business_id: int, sender_id: int, 
                               message_data: Dict) -> Dict:
        """Send intelligent message with optimal delivery strategy"""
        
        # Create smart message record
        smart_message = SmartMessage(
            business_id=business_id,
            sender_id=sender_id,
            message_type=message_data.get("type", "announcement"),
            subject=message_data.get("subject"),
            content=message_data["content"],
            target_filters=message_data.get("filters", {}),
            priority=message_data.get("priority", "normal"),
            delivery_channels=message_data.get("channels", ["whatsapp", "sms"]),
            scheduled_for=message_data.get("scheduled_for")
        )
        
        self.db.add(smart_message)
        self.db.commit()
        
        # Get target staff based on filters
        target_staff = await self.get_filtered_staff(business_id, message_data.get("filters", {}))
        
        # Get AI optimization recommendations
        delivery_strategy = await self.ai_service.optimize_message_delivery(
            message_data["content"], 
            target_staff, 
            message_data.get("priority", "normal")
        )
        
        # Send messages using optimized strategy
        delivery_results = await self.execute_delivery_strategy(
            smart_message, target_staff, delivery_strategy
        )
        
        # Update message status
        smart_message.status = "sent"
        self.db.commit()
        
        return {
            "message_id": smart_message.id,
            "target_staff_count": len(target_staff),
            "delivery_strategy": delivery_strategy,
            "delivery_results": delivery_results,
            "estimated_delivery_time": delivery_strategy.get("follow_up_minutes", 30)
        }
    
    async def get_filtered_staff(self, business_id: int, filters: Dict) -> List[Dict]:
        """Get staff members based on filters"""
        
        query = self.db.query(Staff).filter(
            Staff.business_id == business_id,
            Staff.is_active == True
        )
        
        # Apply skill filters
        if filters.get("skills"):
            # This would need proper JSON querying in production
            query = query.filter(Staff.skills.isnot(None))
        
        # Apply availability filters
        if filters.get("availability") == "available":
            # Simplified - would check actual availability
            query = query.filter(Staff.reliability_score >= 7.0)
        
        # Apply role filters
        if filters.get("roles"):
            query = query.filter(Staff.role.in_(filters["roles"]))
        
        # Apply custom staff ID filters
        if filters.get("custom_staff_ids"):
            query = query.filter(Staff.id.in_(filters["custom_staff_ids"]))
        
        staff_members = query.all()
        
        return [
            {
                "id": staff.id,
                "name": staff.name,
                "phone_number": staff.phone_number,
                "email": staff.email,
                "role": staff.role,
                "skills": staff.skills or [],
                "reliability_score": staff.reliability_score
            }
            for staff in staff_members
        ]
    
    async def execute_delivery_strategy(self, message: SmartMessage, 
                                      target_staff: List[Dict], 
                                      strategy: Dict) -> List[Dict]:
        """Execute the optimized delivery strategy"""
        
        delivery_results = []
        primary_channel = strategy.get("primary_channel", "whatsapp")
        
        # Send to all target staff
        for staff_member in target_staff:
            delivery_record = MessageDelivery(
                message_id=message.id,
                staff_id=staff_member["id"],
                channel=primary_channel,
                status="pending"
            )
            self.db.add(delivery_record)
            
            # Attempt delivery
            try:
                if primary_channel == "whatsapp":
                    result = await self.whatsapp_service.send_coverage_request(
                        staff_member["phone_number"],
                        staff_member["name"],
                        message.content,
                        message.id
                    )
                elif primary_channel == "sms":
                    result = await self.sms_service.send_sms(
                        staff_member["phone_number"],
                        message.content
                    )
                elif primary_channel == "email":
                    # Email service would be implemented here
                    result = {"success": True, "message_id": f"email_{message.id}_{staff_member['id']}"}
                
                delivery_record.status = "sent"
                delivery_record.sent_at = datetime.now()
                delivery_record.external_id = result.get("message_id")
                
                delivery_results.append({
                    "staff_id": staff_member["id"],
                    "staff_name": staff_member["name"],
                    "channel": primary_channel,
                    "status": "sent",
                    "message_id": result.get("message_id")
                })
                
            except Exception as e:
                delivery_record.status = "failed"
                delivery_results.append({
                    "staff_id": staff_member["id"],
                    "staff_name": staff_member["name"],
                    "channel": primary_channel,
                    "status": "failed",
                    "error": str(e)
                })
        
        self.db.commit()
        
        # Schedule follow-up if needed
        if strategy.get("follow_up_minutes"):
            await self.schedule_follow_up(message, strategy["follow_up_minutes"])
        
        return delivery_results
    
    async def schedule_follow_up(self, message: SmartMessage, delay_minutes: int):
        """Schedule follow-up for unread messages"""
        
        # This would be implemented with a task queue like Celery
        # For now, we'll just log the intent
        follow_up_time = datetime.now() + timedelta(minutes=delay_minutes)
        
        print(f"Follow-up scheduled for message {message.id} at {follow_up_time}")
        
        # In production, this would:
        # 1. Check delivery status
        # 2. Send backup channel messages to unread recipients
        # 3. Escalate if critical priority
    
    async def track_message_responses(self, message_id: int) -> Dict:
        """Track responses and engagement for a message"""
        
        deliveries = self.db.query(MessageDelivery).filter(
            MessageDelivery.message_id == message_id
        ).all()
        
        stats = {
            "total_sent": len(deliveries),
            "delivered": len([d for d in deliveries if d.status == "delivered"]),
            "read": len([d for d in deliveries if d.read_at is not None]),
            "responded": len([d for d in deliveries if d.response is not None]),
            "failed": len([d for d in deliveries if d.status == "failed"])
        }
        
        # Calculate response rate
        stats["delivery_rate"] = (stats["delivered"] / stats["total_sent"]) * 100 if stats["total_sent"] > 0 else 0
        stats["read_rate"] = (stats["read"] / stats["delivered"]) * 100 if stats["delivered"] > 0 else 0
        stats["response_rate"] = (stats["responded"] / stats["read"]) * 100 if stats["read"] > 0 else 0
        
        return stats
    
    async def get_message_templates(self, business_id: int, message_type: str) -> List[Dict]:
        """Get pre-written message templates"""
        
        templates = {
            "shift_cover": [
                {
                    "name": "Urgent Shift Cover",
                    "content": "Hi {name}! We need urgent cover for {role} shift on {date} from {start_time} to {end_time}. Can you help us out?",
                    "variables": ["name", "role", "date", "start_time", "end_time"]
                },
                {
                    "name": "Last Minute Cover",
                    "content": "Last minute request - can you cover a {role} shift today {date} from {start_time}-{end_time}? Extra pay available!",
                    "variables": ["role", "date", "start_time", "end_time"]
                }
            ],
            "training": [
                {
                    "name": "Training Reminder",
                    "content": "Hi {name}! Reminder: You have {training_name} training scheduled for {date} at {time}. Please confirm attendance.",
                    "variables": ["name", "training_name", "date", "time"]
                },
                {
                    "name": "New Training Available",
                    "content": "New training module '{training_name}' is now available. Complete by {deadline} to maintain certification.",
                    "variables": ["training_name", "deadline"]
                }
            ],
            "announcement": [
                {
                    "name": "General Announcement",
                    "content": "Team update: {announcement_text}. Please acknowledge receipt.",
                    "variables": ["announcement_text"]
                },
                {
                    "name": "Schedule Change",
                    "content": "Schedule update: {change_details}. Check your updated roster and confirm availability.",
                    "variables": ["change_details"]
                }
            ]
        }
        
        return templates.get(message_type, [])
    
    async def create_message_from_template(self, template: Dict, variables: Dict) -> str:
        """Create message content from template and variables"""
        
        content = template["content"]
        
        for var_name, var_value in variables.items():
            placeholder = "{" + var_name + "}"
            content = content.replace(placeholder, str(var_value))
        
        return content
    
    async def get_communication_analytics(self, business_id: int, 
                                        days_back: int = 30) -> Dict:
        """Get communication analytics for the business"""
        
        start_date = datetime.now() - timedelta(days=days_back)
        
        messages = self.db.query(SmartMessage).filter(
            SmartMessage.business_id == business_id,
            SmartMessage.created_at >= start_date
        ).all()
        
        deliveries = self.db.query(MessageDelivery).join(SmartMessage).filter(
            SmartMessage.business_id == business_id,
            SmartMessage.created_at >= start_date
        ).all()
        
        analytics = {
            "total_messages": len(messages),
            "total_deliveries": len(deliveries),
            "message_types": {},
            "channel_performance": {},
            "response_times": [],
            "success_rates": {}
        }
        
        # Analyze message types
        for message in messages:
            msg_type = message.message_type
            if msg_type not in analytics["message_types"]:
                analytics["message_types"][msg_type] = 0
            analytics["message_types"][msg_type] += 1
        
        # Analyze channel performance
        for delivery in deliveries:
            channel = delivery.channel
            if channel not in analytics["channel_performance"]:
                analytics["channel_performance"][channel] = {
                    "sent": 0, "delivered": 0, "read": 0, "failed": 0
                }
            
            analytics["channel_performance"][channel]["sent"] += 1
            
            if delivery.status == "delivered":
                analytics["channel_performance"][channel]["delivered"] += 1
            elif delivery.status == "failed":
                analytics["channel_performance"][channel]["failed"] += 1
            
            if delivery.read_at:
                analytics["channel_performance"][channel]["read"] += 1
        
        # Calculate success rates
        for channel, stats in analytics["channel_performance"].items():
            if stats["sent"] > 0:
                analytics["success_rates"][channel] = {
                    "delivery_rate": (stats["delivered"] / stats["sent"]) * 100,
                    "read_rate": (stats["read"] / stats["delivered"]) * 100 if stats["delivered"] > 0 else 0
                }
        
        return analytics
    
    async def get_staff_communication_preferences(self, staff_id: int) -> Dict:
        """Get communication preferences for a staff member"""
        
        # Analyze past delivery performance for this staff member
        deliveries = self.db.query(MessageDelivery).filter(
            MessageDelivery.staff_id == staff_id
        ).order_by(MessageDelivery.sent_at.desc()).limit(50).all()
        
        channel_performance = {}
        
        for delivery in deliveries:
            channel = delivery.channel
            if channel not in channel_performance:
                channel_performance[channel] = {"total": 0, "read": 0, "avg_response_time": 0}
            
            channel_performance[channel]["total"] += 1
            
            if delivery.read_at:
                channel_performance[channel]["read"] += 1
                
                if delivery.sent_at and delivery.read_at:
                    response_time = (delivery.read_at - delivery.sent_at).total_seconds() / 60
                    channel_performance[channel]["avg_response_time"] += response_time
        
        # Calculate averages and preferences
        preferences = {}
        for channel, stats in channel_performance.items():
            if stats["total"] > 0:
                preferences[channel] = {
                    "read_rate": (stats["read"] / stats["total"]) * 100,
                    "avg_response_time_minutes": stats["avg_response_time"] / stats["read"] if stats["read"] > 0 else 0,
                    "total_messages": stats["total"]
                }
        
        # Determine preferred channel
        best_channel = max(preferences.keys(), 
                          key=lambda x: preferences[x]["read_rate"]) if preferences else "whatsapp"
        
        return {
            "preferred_channel": best_channel,
            "channel_performance": preferences,
            "recommendations": self.generate_communication_recommendations(preferences)
        }
    
    def generate_communication_recommendations(self, performance_data: Dict) -> List[str]:
        """Generate recommendations based on communication performance"""
        
        recommendations = []
        
        if not performance_data:
            recommendations.append("No communication history available - start with WhatsApp")
            return recommendations
        
        # Find best performing channel
        best_channel = max(performance_data.keys(), 
                          key=lambda x: performance_data[x]["read_rate"])
        
        recommendations.append(f"Use {best_channel} for best response rate ({performance_data[best_channel]['read_rate']:.1f}%)")
        
        # Check for slow response channels
        for channel, stats in performance_data.items():
            if stats["avg_response_time_minutes"] > 60:
                recommendations.append(f"Avoid {channel} for urgent messages (avg response: {stats['avg_response_time_minutes']:.0f} min)")
        
        return recommendations


class EmailService:
    """Email service for sending schedule notifications"""
    
    def __init__(self):
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_username = os.getenv("SMTP_USERNAME")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.from_email = os.getenv("FROM_EMAIL", self.smtp_username)
        
        if not all([self.smtp_username, self.smtp_password]):
            print("Email credentials not configured. Email notifications will be simulated.")
            self.enabled = False
        else:
            self.enabled = True
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        content: str,
        staff_name: str = "Team Member"
    ) -> Dict[str, Any]:
        """Send email notification"""
        
        if not self.enabled:
            print(f"SIMULATED Email to {to_email}: {subject}")
            return {
                "success": True,
                "message_id": f"sim_email_{datetime.now().timestamp()}",
                "simulated": True
            }
        
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.from_email
            msg['To'] = to_email
            msg['Subject'] = subject
            
            # Format content as HTML
            html_content = self._format_email_content(content, staff_name)
            msg.attach(MIMEText(html_content, 'html'))
            
            # Send email
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.smtp_username, self.smtp_password)
            
            text = msg.as_string()
            server.sendmail(self.from_email, to_email, text)
            server.quit()
            
            return {
                "success": True,
                "message_id": f"email_{datetime.now().timestamp()}"
            }
            
        except Exception as e:
            print(f"Email sending failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _format_email_content(self, content: str, staff_name: str) -> str:
        """Format plain text content as HTML email"""
        
        # Convert line breaks to HTML
        html_content = content.replace('\n', '<br>')
        
        # Basic HTML template
        html_template = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Schedule Notification</title>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }}
                .content {{ padding: 20px; }}
                .footer {{ background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Schedule Notification</h2>
                </div>
                <div class="content">
                    {html_content}
                </div>
                <div class="footer">
                    <p>This is an automated message. Please do not reply to this email.</p>
                    <p>If you have questions, contact your manager directly.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return html_template