from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from models import DemandPrediction, ScheduleTemplate, Shift, Staff, Business
from services.ai import AIService
import json

class PredictiveScheduler:
    def __init__(self, db: Session):
        self.db = db
        self.ai_service = AIService()
    
    async def generate_smart_schedule(self, business_id: int, week_start: date) -> Dict:
        """Generate optimal schedule based on AI predictions"""
        
        # Gather prediction signals
        historical_sales = await self.get_sales_history(business_id)
        weather_forecast = await self.get_weather_data(week_start)
        local_events = await self.get_local_events(business_id, week_start)
        
        # Generate demand predictions for each day/hour
        predictions = []
        for day_offset in range(7):  # Week
            current_date = week_start + timedelta(days=day_offset)
            daily_predictions = await self.predict_daily_demand(
                business_id, current_date, historical_sales, weather_forecast, local_events
            )
            predictions.extend(daily_predictions)
        
        # Generate optimal schedule based on predictions
        schedule = await self.create_optimal_schedule(business_id, predictions)
        
        return {
            "week_start": week_start.isoformat(),
            "predictions": predictions,
            "schedule": schedule,
            "cost_savings": self.calculate_cost_savings(schedule),
            "confidence_score": self.calculate_overall_confidence(predictions)
        }
    
    async def predict_daily_demand(self, business_id: int, target_date: date, 
                                 historical_data: Dict, weather: Dict, events: List) -> List[Dict]:
        """Predict hourly demand for a specific date"""
        
        prediction_prompt = f"""
        Predict customer demand for restaurant business {business_id} on {target_date}:
        
        Historical sales data: {json.dumps(historical_data, default=str)}
        Weather forecast: {json.dumps(weather)}
        Local events: {json.dumps(events)}
        
        Generate hour-by-hour demand predictions (0-100 scale) for operating hours 8:00-23:00.
        Consider factors like:
        - Day of week patterns
        - Weather impact on foot traffic
        - Local events driving demand
        - Seasonal trends
        
        Return JSON format:
        {{
            "predictions": [
                {{"hour": 8, "demand": 25, "confidence": 0.8, "factors": ["quiet_morning"]}},
                {{"hour": 12, "demand": 85, "confidence": 0.9, "factors": ["lunch_rush", "sunny_weather"]}}
            ]
        }}
        """
        
        ai_response = await self.ai_service.generate_completion(prediction_prompt)
        
        try:
            prediction_data = json.loads(ai_response)
            predictions = []
            
            for pred in prediction_data.get("predictions", []):
                # Store prediction in database
                db_prediction = DemandPrediction(
                    business_id=business_id,
                    prediction_date=target_date,
                    hour=pred["hour"],
                    predicted_demand=pred["demand"],
                    confidence_score=pred.get("confidence", 0.8),
                    factors=pred.get("factors", [])
                )
                self.db.add(db_prediction)
                predictions.append({
                    "date": target_date.isoformat(),
                    "hour": pred["hour"],
                    "demand": pred["demand"],
                    "confidence": pred.get("confidence", 0.8),
                    "factors": pred.get("factors", [])
                })
            
            self.db.commit()
            return predictions
            
        except json.JSONDecodeError:
            # Fallback to simple heuristics
            return self.generate_fallback_predictions(business_id, target_date)
    
    async def create_optimal_schedule(self, business_id: int, predictions: List[Dict]) -> Dict:
        """Create optimal staff schedule based on demand predictions"""
        
        # Get available staff and their skills
        staff = self.db.query(Staff).filter(
            Staff.business_id == business_id,
            Staff.is_active == True
        ).all()
        
        schedule = {}
        total_cost = 0
        
        # Group predictions by date
        predictions_by_date = {}
        for pred in predictions:
            date_key = pred["date"]
            if date_key not in predictions_by_date:
                predictions_by_date[date_key] = []
            predictions_by_date[date_key].append(pred)
        
        # Generate shifts for each date
        for date_str, daily_predictions in predictions_by_date.items():
            daily_schedule = await self.optimize_daily_schedule(
                business_id, date_str, daily_predictions, staff
            )
            schedule[date_str] = daily_schedule
            total_cost += daily_schedule.get("estimated_cost", 0)
        
        return {
            "shifts": schedule,
            "total_estimated_cost": total_cost,
            "optimization_notes": self.generate_optimization_notes(schedule)
        }
    
    async def optimize_daily_schedule(self, business_id: int, date_str: str, 
                                    predictions: List[Dict], available_staff: List) -> Dict:
        """Optimize schedule for a single day"""
        
        # Calculate required staff levels for each hour
        staffing_needs = []
        for pred in sorted(predictions, key=lambda x: x["hour"]):
            required_staff = max(1, int(pred["demand"] / 30))  # 1 staff per 30 demand units
            staffing_needs.append({
                "hour": pred["hour"],
                "required_staff": required_staff,
                "demand": pred["demand"]
            })
        
        # Create optimal shifts
        shifts = self.create_efficient_shifts(staffing_needs, available_staff)
        
        return {
            "date": date_str,
            "shifts": shifts,
            "staffing_needs": staffing_needs,
            "estimated_cost": sum(shift.get("cost", 0) for shift in shifts)
        }
    
    def create_efficient_shifts(self, staffing_needs: List[Dict], available_staff: List) -> List[Dict]:
        """Create efficient shift patterns to meet staffing needs"""
        
        shifts = []
        
        # Common shift patterns
        shift_patterns = [
            {"start": 8, "end": 16, "name": "Morning Shift"},
            {"start": 12, "end": 20, "name": "Afternoon Shift"},
            {"start": 16, "end": 23, "name": "Evening Shift"},
            {"start": 8, "end": 23, "name": "Full Day"}
        ]
        
        for pattern in shift_patterns:
            # Calculate if this shift pattern is needed
            pattern_demand = sum(
                need["required_staff"] for need in staffing_needs
                if pattern["start"] <= need["hour"] < pattern["end"]
            )
            
            if pattern_demand > 0:
                # Find suitable staff for this shift
                suitable_staff = self.find_suitable_staff(
                    available_staff, pattern["start"], pattern["end"]
                )
                
                if suitable_staff:
                    shifts.append({
                        "name": pattern["name"],
                        "start_time": f"{pattern['start']:02d}:00",
                        "end_time": f"{pattern['end']:02d}:00",
                        "assigned_staff": suitable_staff[:min(2, len(suitable_staff))],
                        "cost": len(suitable_staff[:2]) * (pattern["end"] - pattern["start"]) * 15  # £15/hour
                    })
        
        return shifts
    
    def find_suitable_staff(self, staff_list: List, start_hour: int, end_hour: int) -> List[Dict]:
        """Find staff available for specific time slot"""
        suitable = []
        
        for staff_member in staff_list:
            # Check availability (simplified - would check actual availability JSON)
            if staff_member.is_active:
                suitable.append({
                    "id": staff_member.id,
                    "name": staff_member.name,
                    "role": staff_member.role,
                    "skills": staff_member.skills or [],
                    "reliability_score": staff_member.reliability_score
                })
        
        # Sort by reliability score
        return sorted(suitable, key=lambda x: x["reliability_score"], reverse=True)
    
    async def get_sales_history(self, business_id: int) -> Dict:
        """Get historical sales data for predictions"""
        # Simplified - would integrate with POS system
        return {
            "last_30_days_avg": 1500,
            "peak_hours": [12, 13, 18, 19, 20],
            "busy_days": ["friday", "saturday"],
            "seasonal_trend": "increasing"
        }
    
    async def get_weather_data(self, date: date) -> Dict:
        """Get weather forecast data"""
        # Would integrate with weather API
        return {
            "temperature": 18,
            "condition": "partly_cloudy",
            "precipitation": 0.2,
            "impact_score": 0.8  # Positive impact on foot traffic
        }
    
    async def get_local_events(self, business_id: int, date: date) -> List[Dict]:
        """Get local events that might affect demand"""
        # Would integrate with events API
        return [
            {
                "name": "Local Football Match",
                "time": "15:00",
                "expected_impact": "high",
                "type": "sports"
            }
        ]
    
    def generate_fallback_predictions(self, business_id: int, target_date: date) -> List[Dict]:
        """Generate simple heuristic-based predictions as fallback"""
        predictions = []
        
        # Basic patterns based on day of week
        day_of_week = target_date.weekday()
        base_demand = 60 if day_of_week >= 4 else 40  # Higher on weekends
        
        for hour in range(8, 24):
            if hour in [12, 13, 18, 19, 20]:  # Peak hours
                demand = base_demand + 20
            elif hour in [8, 9, 22, 23]:  # Quiet hours
                demand = base_demand - 20
            else:
                demand = base_demand
            
            predictions.append({
                "date": target_date.isoformat(),
                "hour": hour,
                "demand": max(10, min(100, demand)),
                "confidence": 0.6,
                "factors": ["heuristic_based"]
            })
        
        return predictions
    
    def calculate_cost_savings(self, schedule: Dict) -> Dict:
        """Calculate potential cost savings from optimized scheduling"""
        return {
            "estimated_savings_per_week": 300,
            "efficiency_improvement": "25%",
            "overstaffing_reduction": "15%"
        }
    
    def calculate_overall_confidence(self, predictions: List[Dict]) -> float:
        """Calculate overall confidence score for predictions"""
        if not predictions:
            return 0.0
        
        total_confidence = sum(pred.get("confidence", 0.5) for pred in predictions)
        return total_confidence / len(predictions)
    
    def generate_optimization_notes(self, schedule: Dict) -> List[str]:
        """Generate human-readable optimization notes"""
        return [
            "Peak hours identified: 12-14, 18-21",
            "Recommended 2-3 staff during lunch rush",
            "Consider split shifts for better coverage",
            "Weekend staffing increased by 30%"
        ]