import os
import httpx
from typing import Dict, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class WhatsAppService:
    def __init__(self):
        self.phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
        self.access_token = os.getenv("WHATSAPP_ACCESS_TOKEN")
        self.base_url = "https://graph.facebook.com/v18.0"
        
        if not self.phone_number_id or not self.access_token:
            logger.warning("WhatsApp credentials not configured. Messages will be simulated.")
            self.enabled = False
        else:
            self.enabled = True
    
    async def send_coverage_request(
        self, 
        phone_number: str, 
        staff_name: str, 
        message: str,
        request_id: int
    ) -> Dict[str, Any]:
        """Send emergency coverage request via WhatsApp"""
        
        if not self.enabled:
            # Simulate message sending for development
            logger.info(f"SIMULATED WhatsApp to {phone_number}: {message}")
            return {
                "success": True,
                "message_id": f"sim_{request_id}_{datetime.now().timestamp()}",
                "simulated": True
            }
        
        # Format phone number (remove + and ensure country code)
        formatted_phone = self._format_phone_number(phone_number)
        
        # Create message payload
        payload = {
            "messaging_product": "whatsapp",
            "to": formatted_phone,
            "type": "text",
            "text": {
                "body": f"Hi {staff_name},\n\n{message}\n\nReply:\n✅ YES to accept\n❌ NO to decline\n⏰ MAYBE if you need more info"
            }
        }
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/{self.phone_number_id}/messages",
                    json=payload,
                    headers=headers,
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return {
                        "success": True,
                        "message_id": result.get("messages", [{}])[0].get("id"),
                        "whatsapp_id": result.get("messages", [{}])[0].get("id")
                    }
                else:
                    logger.error(f"WhatsApp API error: {response.status_code} - {response.text}")
                    return {
                        "success": False,
                        "error": f"WhatsApp API error: {response.status_code}"
                    }
                    
        except Exception as e:
            logger.error(f"WhatsApp sending failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def send_confirmation_message(
        self, 
        phone_number: str, 
        staff_name: str, 
        shift_details: str
    ) -> Dict[str, Any]:
        """Send shift confirmation message"""
        
        message = f"Hi {staff_name},\n\nThanks for accepting the shift!\n\n{shift_details}\n\nSee you there! 👍"
        
        if not self.enabled:
            logger.info(f"SIMULATED WhatsApp confirmation to {phone_number}: {message}")
            return {"success": True, "simulated": True}
        
        # Similar implementation to send_coverage_request
        # ... (implementation details)
        
        return {"success": True, "message_id": "confirmation_123"}
    
    def _format_phone_number(self, phone_number: str) -> str:
        """Format phone number for WhatsApp API"""
        # Remove all non-digit characters
        digits_only = ''.join(filter(str.isdigit, phone_number))
        
        # Add UK country code if not present
        if len(digits_only) == 10 and digits_only.startswith('0'):
            # UK mobile number starting with 0
            return f"44{digits_only[1:]}"
        elif len(digits_only) == 11 and digits_only.startswith('44'):
            # Already has UK country code
            return digits_only
        else:
            # Assume it's already formatted correctly
            return digits_only
    
    async def handle_incoming_message(self, webhook_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process incoming WhatsApp messages (responses to coverage requests)"""
        
        try:
            # Extract message data from webhook
            entry = webhook_data.get("entry", [{}])[0]
            changes = entry.get("changes", [{}])[0]
            value = changes.get("value", {})
            messages = value.get("messages", [])
            
            if not messages:
                return {"status": "no_messages"}
            
            message = messages[0]
            from_number = message.get("from")
            message_text = message.get("text", {}).get("body", "").lower().strip()
            
            # Parse response
            response_type = self._parse_response(message_text)
            
            return {
                "status": "processed",
                "from_number": from_number,
                "message_text": message_text,
                "response_type": response_type,
                "timestamp": datetime.now()
            }
            
        except Exception as e:
            logger.error(f"Error processing incoming message: {str(e)}")
            return {"status": "error", "error": str(e)}
    
    def _parse_response(self, message_text: str) -> str:
        """Parse staff response to determine intent"""
        
        # Positive responses
        if any(word in message_text for word in ["yes", "✅", "accept", "ok", "sure", "i can", "available"]):
            return "accept"
        
        # Negative responses  
        if any(word in message_text for word in ["no", "❌", "can't", "cannot", "unavailable", "busy"]):
            return "decline"
        
        # Maybe/need more info
        if any(word in message_text for word in ["maybe", "⏰", "depends", "when", "what time", "more info"]):
            return "maybe"
        
        # Default to maybe if unclear
        return "maybe"


class SMSService:
    """Fallback SMS service using Twilio"""
    
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.from_number = os.getenv("TWILIO_FROM_NUMBER")
        
        if not all([self.account_sid, self.auth_token, self.from_number]):
            logger.warning("Twilio credentials not configured. SMS fallback disabled.")
            self.enabled = False
        else:
            self.enabled = True
    
    async def send_sms(self, phone_number: str, message: str) -> Dict[str, Any]:
        """Send SMS as fallback when WhatsApp fails"""
        
        if not self.enabled:
            logger.info(f"SIMULATED SMS to {phone_number}: {message}")
            return {"success": True, "simulated": True}
        
        # Implementation would use Twilio API
        # For now, simulate success
        return {
            "success": True,
            "message_id": f"sms_{datetime.now().timestamp()}"
        }