import os
import openai
from datetime import datetime, date
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        self.client = openai.AsyncOpenAI(
            api_key=os.getenv("OPENAI_API_KEY")
        )
        self.model = "gpt-4-turbo"  # Using GPT-4 Turbo for cost efficiency
        
        if not os.getenv("OPENAI_API_KEY"):
            logger.warning("OpenAI API key not configured. AI features will be simulated.")
            self.enabled = False
        else:
            self.enabled = True
    
    async def generate_coverage_message(
        self,
        business_name: str,
        shift_date: datetime,
        shift_start: str,
        shift_end: str,
        required_skill: str,
        urgency: str = "normal",
        custom_message: str = None
    ) -> str:
        """Generate intelligent coverage request message"""
        
        if not self.enabled:
            # Fallback message when AI is not available
            return self._generate_fallback_message(
                business_name, shift_date, shift_start, shift_end, required_skill, urgency
            )
        
        # Format date for human readability
        formatted_date = shift_date.strftime("%A, %B %d")
        
        # Create context-aware prompt
        prompt = f"""
        Generate a professional but friendly WhatsApp message for a restaurant staff coverage request.
        
        Context:
        - Business: {business_name}
        - Date: {formatted_date}
        - Time: {shift_start} - {shift_end}
        - Role needed: {required_skill}
        - Urgency: {urgency}
        - Custom message: {custom_message or "None"}
        
        Requirements:
        - Keep it under 160 characters for mobile readability
        - Sound urgent but not panicked
        - Be specific about time and role
        - Include the business name
        - Professional but friendly tone
        - End with clear call to action
        
        Do not include response instructions (YES/NO) as those will be added separately.
        """
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system", 
                        "content": "You are an expert at writing concise, professional restaurant staff communications. Focus on clarity and urgency while maintaining a friendly tone."
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=100,
                temperature=0.7
            )
            
            ai_message = response.choices[0].message.content.strip()
            
            # Add custom message if provided
            if custom_message:
                ai_message += f"\n\nNote: {custom_message}"
            
            return ai_message
            
        except Exception as e:
            logger.error(f"AI message generation failed: {str(e)}")
            return self._generate_fallback_message(
                business_name, shift_date, shift_start, shift_end, required_skill, urgency
            )
    
    def _generate_fallback_message(
        self,
        business_name: str,
        shift_date: datetime,
        shift_start: str,
        shift_end: str,
        required_skill: str,
        urgency: str
    ) -> str:
        """Generate fallback message when AI is unavailable"""
        
        formatted_date = shift_date.strftime("%A, %B %d")
        
        urgency_prefix = {
            "low": "Hi there!",
            "normal": "Hi!",
            "high": "Urgent:",
            "critical": "URGENT:"
        }.get(urgency, "Hi!")
        
        skill_display = {
            "kitchen": "kitchen staff",
            "bar": "bartender",
            "front_of_house": "server",
            "management": "supervisor"
        }.get(required_skill, required_skill)
        
        return f"{urgency_prefix} {business_name} needs {skill_display} for {formatted_date}, {shift_start}-{shift_end}. Can you help?"
    
    async def analyze_staff_patterns(
        self, 
        staff_responses: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze staff response patterns to improve future requests"""
        
        if not self.enabled or not staff_responses:
            return {"insights": "AI analysis not available"}
        
        # Prepare data for analysis
        response_data = []
        for response in staff_responses:
            response_data.append({
                "staff_id": response.get("staff_id"),
                "response": response.get("response"),
                "response_time": response.get("response_time_minutes"),
                "day_of_week": response.get("day_of_week"),
                "time_of_day": response.get("time_of_day")
            })
        
        prompt = f"""
        Analyze these staff response patterns and provide actionable insights:
        
        Data: {response_data}
        
        Provide insights on:
        1. Which staff are most reliable for emergency coverage
        2. Best times to send coverage requests for quick responses
        3. Patterns in acceptance/decline rates
        4. Recommendations for improving response rates
        
        Keep response concise and actionable for restaurant managers.
        """
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a restaurant operations analyst. Provide practical, actionable insights based on staff response data."
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
                temperature=0.3
            )
            
            return {
                "insights": response.choices[0].message.content.strip(),
                "analyzed_responses": len(staff_responses),
                "generated_at": datetime.now()
            }
            
        except Exception as e:
            logger.error(f"AI pattern analysis failed: {str(e)}")
            return {
                "insights": "Pattern analysis temporarily unavailable",
                "error": str(e)
            }
    
    async def suggest_optimal_timing(
        self,
        business_type: str,
        shift_date: datetime,
        required_skill: str,
        historical_data: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Suggest optimal timing for sending coverage requests"""
        
        if not self.enabled:
            return self._get_default_timing_suggestions(business_type, shift_date)
        
        day_of_week = shift_date.strftime("%A")
        
        prompt = f"""
        Suggest optimal timing for sending emergency staff coverage requests:
        
        Context:
        - Business type: {business_type}
        - Shift date: {day_of_week}
        - Role needed: {required_skill}
        - Historical response data: {historical_data or "None available"}
        
        Consider:
        - When staff are most likely to check messages
        - Response time patterns for different roles
        - Day of week variations
        - Urgency vs response quality trade-offs
        
        Provide specific time recommendations and reasoning.
        """
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert in restaurant staffing and communication timing optimization."
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=200,
                temperature=0.3
            )
            
            return {
                "recommendations": response.choices[0].message.content.strip(),
                "generated_at": datetime.now()
            }
            
        except Exception as e:
            logger.error(f"AI timing suggestion failed: {str(e)}")
            return self._get_default_timing_suggestions(business_type, shift_date)
    
    def _get_default_timing_suggestions(
        self, 
        business_type: str, 
        shift_date: datetime
    ) -> Dict[str, Any]:
        """Default timing suggestions when AI is unavailable"""
        
        day_of_week = shift_date.strftime("%A")
        
        # Basic timing rules based on restaurant industry knowledge
        if day_of_week in ["Saturday", "Sunday"]:
            optimal_time = "10:00 AM - Staff check phones before weekend shifts"
        elif day_of_week in ["Monday", "Tuesday"]:
            optimal_time = "2:00 PM - Quieter days, staff more available"
        else:
            optimal_time = "11:00 AM - Before lunch prep, after morning routine"
        
        return {
            "recommendations": f"Best time to send: {optimal_time}",
            "reasoning": "Based on general restaurant industry patterns",
            "generated_at": datetime.now()
        }
    
    async def optimize_message_delivery(self, message_content: str, target_staff: List[Dict], 
                                      urgency: str) -> Dict:
        """Determine optimal delivery strategy for messages"""
        if not self.enabled:
            return {
                "primary_channel": "whatsapp",
                "backup_channels": ["sms"],
                "timing": "immediate",
                "follow_up_minutes": 30,
                "personalization": False
            }
        
        prompt = f"""
        Optimize message delivery for restaurant staff communication:
        
        Message: "{message_content}"
        Target staff count: {len(target_staff)}
        Urgency: {urgency}
        
        Recommend:
        1. Best delivery channels (whatsapp, sms, email, push)
        2. Optimal timing
        3. Follow-up strategy
        
        Return JSON format:
        {{
            "primary_channel": "whatsapp",
            "backup_channels": ["sms", "push"],
            "timing": "immediate",
            "follow_up_minutes": 15,
            "personalization": true
        }}
        """
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert in restaurant staff communication optimization."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
                temperature=0.3
            )
            
            import json
            return json.loads(response.choices[0].message.content)
        except:
            return {
                "primary_channel": "whatsapp",
                "backup_channels": ["sms"],
                "timing": "immediate",
                "follow_up_minutes": 30,
                "personalization": False
            }
    
    async def generate_training_content(self, skill: str, level: str, duration_minutes: int) -> Dict:
        """Generate training module content"""
        if not self.enabled:
            return {
                "objectives": [f"Master {skill} fundamentals"],
                "topics": [f"{skill} basics", "Best practices", "Common mistakes"],
                "quiz": [{"question": f"What is the key principle of {skill}?", "options": ["A", "B", "C"], "correct": 0}],
                "exercises": [f"Practice {skill} scenario"]
            }
        
        prompt = f"""
        Create training content for restaurant staff:
        
        Skill: {skill}
        Level: {level}
        Duration: {duration_minutes} minutes
        
        Generate:
        1. Learning objectives
        2. Key topics to cover
        3. Quiz questions (5 questions)
        4. Practical exercises
        
        Return JSON format with structured content.
        """
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert restaurant training developer."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=800,
                temperature=0.7
            )
            
            import json
            return json.loads(response.choices[0].message.content)
        except:
            return {
                "objectives": [f"Master {skill} fundamentals"],
                "topics": [f"{skill} basics", "Best practices", "Common mistakes"],
                "quiz": [{"question": f"What is the key principle of {skill}?", "options": ["A", "B", "C"], "correct": 0}],
                "exercises": [f"Practice {skill} scenario"]
            }
    
    async def analyze_inventory_needs(self, current_stock: Dict, usage_history: Dict, 
                                   upcoming_events: List[Dict]) -> Dict:
        """Analyze inventory needs and generate recommendations"""
        if not self.enabled:
            return {
                "reorder_items": [],
                "expiry_risks": [],
                "cost_savings": [],
                "confidence": 0.5
            }
        
        prompt = f"""
        Analyze restaurant inventory needs:
        
        Current stock: {current_stock}
        Usage history (30 days): {usage_history}
        Upcoming events: {upcoming_events}
        
        Predict:
        1. Items likely to run out in next 7 days
        2. Optimal reorder quantities
        3. Items at risk of expiration
        4. Cost-saving opportunities
        
        Return JSON format with specific recommendations.
        """
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert restaurant inventory analyst."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=600,
                temperature=0.3
            )
            
            import json
            return json.loads(response.choices[0].message.content)
        except:
            return {
                "reorder_items": [],
                "expiry_risks": [],
                "cost_savings": [],
                "confidence": 0.5
            }
    
    async def generate_emergency_response(self, emergency_type: str, details: Dict, 
                                        available_resources: Dict) -> Dict:
        """Generate emergency response plan"""
        if not self.enabled:
            return {
                "immediate_actions": ["Assess situation", "Ensure safety"],
                "short_term_actions": ["Contact manager", "Document incident"],
                "notify_staff": [],
                "external_contacts": [],
                "follow_up": ["Review procedures"]
            }
        
        prompt = f"""
        Generate emergency response plan for restaurant:
        
        Emergency type: {emergency_type}
        Details: {details}
        Available resources: {available_resources}
        
        Create immediate action plan with:
        1. Immediate actions (first 5 minutes)
        2. Short-term actions (next 30 minutes)
        3. Staff to notify
        4. External contacts needed
        5. Follow-up tasks
        
        Return structured JSON response.
        """
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert restaurant emergency response coordinator."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=600,
                temperature=0.3
            )
            
            import json
            return json.loads(response.choices[0].message.content)
        except:
            return {
                "immediate_actions": ["Assess situation", "Ensure safety"],
                "short_term_actions": ["Contact manager", "Document incident"],
                "notify_staff": [],
                "external_contacts": [],
                "follow_up": ["Review procedures"]
            }
    
    async def analyze_customer_feedback(self, reviews: List[Dict]) -> Dict:
        """Analyze customer reviews and feedback"""
        if not self.enabled:
            return {
                "sentiment_trend": "neutral",
                "positive_themes": ["good food"],
                "complaints": ["slow service"],
                "staff_insights": {},
                "recommendations": ["improve service speed"]
            }
        
        prompt = f"""
        Analyze customer reviews for restaurant insights:
        
        Reviews: {reviews[:10]}  # Limit for token efficiency
        
        Provide:
        1. Overall sentiment trend
        2. Common positive themes
        3. Common complaints
        4. Staff performance insights
        5. Actionable recommendations
        
        Return JSON format with analysis.
        """
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert restaurant customer experience analyst."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=600,
                temperature=0.3
            )
            
            import json
            return json.loads(response.choices[0].message.content)
        except:
            return {
                "sentiment_trend": "neutral",
                "positive_themes": ["good food"],
                "complaints": ["slow service"],
                "staff_insights": {},
                "recommendations": ["improve service speed"]
            }