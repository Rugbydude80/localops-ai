from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from models import (BusinessMetric, KPITarget, Shift, ShiftAssignment, Staff, 
                   EmergencyRequest, ShiftCoverage, MessageLog, Business)
import json

class BusinessIntelligenceService:
    def __init__(self, db: Session):
        self.db = db
    
    async def get_real_time_metrics(self, business_id: int) -> Dict:
        """Get real-time business metrics"""
        
        today = date.today()
        
        # Calculate current metrics
        metrics = {
            "labour_cost_percentage": await self.calculate_labour_cost_percentage(business_id, today),
            "staff_utilisation": await self.calculate_staff_utilisation(business_id, today),
            "shift_coverage_rate": await self.calculate_coverage_rate(business_id, today),
            "staff_punctuality_rate": await self.calculate_punctuality_rate(business_id, today),
            "emergency_response_time": await self.calculate_avg_response_time(business_id, today),
            "hourly_data": await self.get_hourly_performance_data(business_id, today)
        }
        
        # Get trends (compare with yesterday)
        yesterday = today - timedelta(days=1)
        yesterday_metrics = await self.get_daily_metrics(business_id, yesterday)
        
        metrics["trends"] = {
            "labour_cost_trend": self.calculate_trend(
                metrics["labour_cost_percentage"], 
                yesterday_metrics.get("labour_cost_percentage", 0)
            ),
            "utilisation_trend": self.calculate_trend(
                metrics["staff_utilisation"],
                yesterday_metrics.get("staff_utilisation", 0)
            ),
            "coverage_trend": self.calculate_trend(
                metrics["shift_coverage_rate"],
                yesterday_metrics.get("shift_coverage_rate", 0)
            )
        }
        
        # Get KPI targets
        targets = await self.get_kpi_targets(business_id)
        metrics["targets"] = targets
        
        # Store metrics for historical tracking
        await self.store_daily_metrics(business_id, today, metrics)
        
        return metrics
    
    async def calculate_labour_cost_percentage(self, business_id: int, target_date: date) -> float:
        """Calculate labour cost as percentage of revenue"""
        
        # Get shifts for the day
        shifts = self.db.query(Shift).filter(
            Shift.business_id == business_id,
            func.date(Shift.date) == target_date
        ).all()
        
        total_labour_cost = 0
        for shift in shifts:
            # Calculate shift cost (hours * rate)
            start_hour = int(shift.start_time.split(':')[0])
            end_hour = int(shift.end_time.split(':')[0])
            hours = end_hour - start_hour
            
            # Get assigned staff count
            staff_count = self.db.query(ShiftAssignment).filter(
                ShiftAssignment.shift_id == shift.id,
                ShiftAssignment.status.in_(["assigned", "confirmed"])
            ).count()
            
            shift_cost = hours * staff_count * (shift.hourly_rate or 15)  # Default £15/hour
            total_labour_cost += shift_cost
        
        # Mock revenue data (would integrate with POS system)
        estimated_revenue = total_labour_cost * 3.5  # Typical restaurant ratio
        
        if estimated_revenue > 0:
            return (total_labour_cost / estimated_revenue) * 100
        return 0
    
    async def calculate_staff_utilisation(self, business_id: int, target_date: date) -> float:
        """Calculate staff utilisation rate"""
        
        # Get total scheduled hours
        shifts = self.db.query(Shift).filter(
            Shift.business_id == business_id,
            func.date(Shift.date) == target_date
        ).all()
        
        total_scheduled_hours = 0
        total_worked_hours = 0
        
        for shift in shifts:
            start_hour = int(shift.start_time.split(':')[0])
            end_hour = int(shift.end_time.split(':')[0])
            shift_hours = end_hour - start_hour
            
            # Get assignments
            assignments = self.db.query(ShiftAssignment).filter(
                ShiftAssignment.shift_id == shift.id
            ).all()
            
            for assignment in assignments:
                total_scheduled_hours += shift_hours
                
                # Count as worked if not no-show
                if assignment.status != "no_show":
                    total_worked_hours += shift_hours
        
        if total_scheduled_hours > 0:
            return (total_worked_hours / total_scheduled_hours) * 100
        return 0
    
    async def calculate_coverage_rate(self, business_id: int, target_date: date) -> float:
        """Calculate shift coverage rate"""
        
        shifts = self.db.query(Shift).filter(
            Shift.business_id == business_id,
            func.date(Shift.date) == target_date
        ).all()
        
        total_shifts = len(shifts)
        covered_shifts = 0
        
        for shift in shifts:
            required_staff = shift.required_staff_count
            assigned_staff = self.db.query(ShiftAssignment).filter(
                ShiftAssignment.shift_id == shift.id,
                ShiftAssignment.status.in_(["assigned", "confirmed"])
            ).count()
            
            if assigned_staff >= required_staff:
                covered_shifts += 1
        
        if total_shifts > 0:
            return (covered_shifts / total_shifts) * 100
        return 0
    
    async def calculate_punctuality_rate(self, business_id: int, target_date: date) -> float:
        """Calculate staff punctuality rate"""
        
        # This would integrate with time tracking system
        # For now, return mock data based on reliability scores
        
        staff = self.db.query(Staff).filter(
            Staff.business_id == business_id,
            Staff.is_active == True
        ).all()
        
        if not staff:
            return 0
        
        avg_reliability = sum(s.reliability_score for s in staff) / len(staff)
        return min(avg_reliability * 10, 100)  # Convert to percentage
    
    async def calculate_avg_response_time(self, business_id: int, target_date: date) -> float:
        """Calculate average emergency response time"""
        
        responses = self.db.query(ShiftCoverage).join(EmergencyRequest).filter(
            EmergencyRequest.business_id == business_id,
            func.date(EmergencyRequest.created_at) == target_date,
            ShiftCoverage.response_time_minutes.isnot(None)
        ).all()
        
        if not responses:
            return 0
        
        total_time = sum(r.response_time_minutes for r in responses)
        return total_time / len(responses)
    
    async def get_hourly_performance_data(self, business_id: int, target_date: date) -> List[Dict]:
        """Get hourly performance data for charts"""
        
        hourly_data = []
        
        for hour in range(8, 24):  # Operating hours
            # Mock data - would integrate with POS and time tracking
            hour_data = {
                "hour": hour,
                "revenue": 150 + (hour - 12) * 20 if 12 <= hour <= 20 else 100,
                "staff_count": 3 if 12 <= hour <= 20 else 2,
                "customer_count": 25 + (hour - 12) * 5 if 12 <= hour <= 20 else 15,
                "efficiency_score": 85 + (hour % 3) * 5
            }
            hourly_data.append(hour_data)
        
        return hourly_data
    
    async def get_daily_metrics(self, business_id: int, target_date: date) -> Dict:
        """Get stored daily metrics"""
        
        metric = self.db.query(BusinessMetric).filter(
            BusinessMetric.business_id == business_id,
            BusinessMetric.metric_date == target_date,
            BusinessMetric.hour.is_(None)  # Daily summary
        ).first()
        
        if metric:
            return {
                "labour_cost_percentage": metric.labour_cost_percentage,
                "staff_utilisation": metric.staff_utilisation,
                "shift_coverage_rate": metric.shift_coverage_rate,
                "staff_punctuality_rate": metric.staff_punctuality_rate
            }
        
        return {}
    
    def calculate_trend(self, current: float, previous: float) -> str:
        """Calculate trend direction"""
        
        if previous == 0:
            return "stable"
        
        change_percent = ((current - previous) / previous) * 100
        
        if change_percent > 5:
            return "increasing"
        elif change_percent < -5:
            return "decreasing"
        else:
            return "stable"
    
    async def get_kpi_targets(self, business_id: int) -> Dict:
        """Get KPI targets for the business"""
        
        targets = self.db.query(KPITarget).filter(
            KPITarget.business_id == business_id,
            KPITarget.is_active == True
        ).all()
        
        target_dict = {}
        for target in targets:
            target_dict[target.metric_name] = {
                "value": target.target_value,
                "comparison": target.comparison_type
            }
        
        # Default targets if none set
        if not target_dict:
            target_dict = {
                "labour_cost_percentage": {"value": 30, "comparison": "less_than"},
                "staff_utilisation": {"value": 85, "comparison": "greater_than"},
                "shift_coverage_rate": {"value": 95, "comparison": "greater_than"},
                "staff_punctuality_rate": {"value": 90, "comparison": "greater_than"}
            }
        
        return target_dict
    
    async def store_daily_metrics(self, business_id: int, metric_date: date, metrics: Dict):
        """Store daily metrics for historical tracking"""
        
        # Check if already exists
        existing = self.db.query(BusinessMetric).filter(
            BusinessMetric.business_id == business_id,
            BusinessMetric.metric_date == metric_date,
            BusinessMetric.hour.is_(None)
        ).first()
        
        if existing:
            # Update existing
            existing.labour_cost_percentage = metrics.get("labour_cost_percentage")
            existing.staff_utilisation = metrics.get("staff_utilisation")
            existing.shift_coverage_rate = metrics.get("shift_coverage_rate")
            existing.staff_punctuality_rate = metrics.get("staff_punctuality_rate")
        else:
            # Create new
            metric = BusinessMetric(
                business_id=business_id,
                metric_date=metric_date,
                labour_cost_percentage=metrics.get("labour_cost_percentage"),
                staff_utilisation=metrics.get("staff_utilisation"),
                shift_coverage_rate=metrics.get("shift_coverage_rate"),
                staff_punctuality_rate=metrics.get("staff_punctuality_rate"),
                raw_data=metrics
            )
            self.db.add(metric)
        
        self.db.commit()
    
    async def get_weekly_report(self, business_id: int, week_start: date) -> Dict:
        """Generate weekly performance report"""
        
        week_end = week_start + timedelta(days=6)
        
        # Get daily metrics for the week
        daily_metrics = self.db.query(BusinessMetric).filter(
            BusinessMetric.business_id == business_id,
            BusinessMetric.metric_date >= week_start,
            BusinessMetric.metric_date <= week_end,
            BusinessMetric.hour.is_(None)
        ).all()
        
        if not daily_metrics:
            return {"error": "No data available for this week"}
        
        # Calculate weekly averages
        avg_labour_cost = sum(m.labour_cost_percentage or 0 for m in daily_metrics) / len(daily_metrics)
        avg_utilisation = sum(m.staff_utilisation or 0 for m in daily_metrics) / len(daily_metrics)
        avg_coverage = sum(m.shift_coverage_rate or 0 for m in daily_metrics) / len(daily_metrics)
        
        # Get emergency requests for the week
        emergency_count = self.db.query(EmergencyRequest).filter(
            EmergencyRequest.business_id == business_id,
            func.date(EmergencyRequest.created_at) >= week_start,
            func.date(EmergencyRequest.created_at) <= week_end
        ).count()
        
        filled_count = self.db.query(EmergencyRequest).filter(
            EmergencyRequest.business_id == business_id,
            func.date(EmergencyRequest.created_at) >= week_start,
            func.date(EmergencyRequest.created_at) <= week_end,
            EmergencyRequest.status == "filled"
        ).count()
        
        return {
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "averages": {
                "labour_cost_percentage": round(avg_labour_cost, 1),
                "staff_utilisation": round(avg_utilisation, 1),
                "shift_coverage_rate": round(avg_coverage, 1)
            },
            "emergency_requests": {
                "total": emergency_count,
                "filled": filled_count,
                "fill_rate": (filled_count / emergency_count * 100) if emergency_count > 0 else 0
            },
            "daily_breakdown": [
                {
                    "date": m.metric_date.isoformat(),
                    "labour_cost": m.labour_cost_percentage,
                    "utilisation": m.staff_utilisation,
                    "coverage": m.shift_coverage_rate
                }
                for m in daily_metrics
            ],
            "recommendations": await self.generate_weekly_recommendations(business_id, daily_metrics)
        }
    
    async def generate_weekly_recommendations(self, business_id: int, 
                                           daily_metrics: List) -> List[str]:
        """Generate actionable recommendations based on weekly data"""
        
        recommendations = []
        
        # Analyse labour cost
        avg_labour_cost = sum(m.labour_cost_percentage or 0 for m in daily_metrics) / len(daily_metrics)
        if avg_labour_cost > 35:
            recommendations.append("Labour costs are high - consider optimizing shift schedules")
        
        # Analyse coverage
        avg_coverage = sum(m.shift_coverage_rate or 0 for m in daily_metrics) / len(daily_metrics)
        if avg_coverage < 90:
            recommendations.append("Improve shift coverage by building a larger pool of available staff")
        
        # Analyse utilisation
        avg_utilisation = sum(m.staff_utilisation or 0 for m in daily_metrics) / len(daily_metrics)
        if avg_utilisation < 80:
            recommendations.append("Staff utilisation is low - consider reducing scheduled hours")
        
        # Check for patterns
        weekend_metrics = [m for m in daily_metrics if m.metric_date.weekday() >= 5]
        if weekend_metrics:
            weekend_labour = sum(m.labour_cost_percentage or 0 for m in weekend_metrics) / len(weekend_metrics)
            weekday_labour = sum(m.labour_cost_percentage or 0 for m in daily_metrics if m.metric_date.weekday() < 5) / max(1, len(daily_metrics) - len(weekend_metrics))
            
            if weekend_labour > weekday_labour * 1.2:
                recommendations.append("Weekend labour costs are significantly higher - review weekend scheduling")
        
        return recommendations
    
    async def get_staff_performance_ranking(self, business_id: int, days: int = 30) -> List[Dict]:
        """Get staff performance ranking"""
        
        since_date = datetime.now() - timedelta(days=days)
        
        staff_members = self.db.query(Staff).filter(
            Staff.business_id == business_id,
            Staff.is_active == True
        ).all()
        
        staff_performance = []
        
        for staff in staff_members:
            # Get shift assignments
            assignments = self.db.query(ShiftAssignment).join(Shift).filter(
                ShiftAssignment.staff_id == staff.id,
                Shift.date >= since_date
            ).all()
            
            # Calculate performance metrics
            total_shifts = len(assignments)
            no_shows = len([a for a in assignments if a.status == "no_show"])
            on_time = len([a for a in assignments if a.status == "confirmed"])
            
            # Get emergency response rate
            emergency_responses = self.db.query(ShiftCoverage).join(EmergencyRequest).filter(
                ShiftCoverage.staff_id == staff.id,
                EmergencyRequest.created_at >= since_date
            ).all()
            
            accepted_emergencies = len([r for r in emergency_responses if r.response == "accept"])
            total_emergency_requests = len(emergency_responses)
            
            performance_score = staff.reliability_score
            if total_shifts > 0:
                attendance_rate = ((total_shifts - no_shows) / total_shifts) * 100
                performance_score = (performance_score + attendance_rate) / 2
            
            staff_performance.append({
                "staff_id": staff.id,
                "name": staff.name,
                "role": staff.role,
                "performance_score": round(performance_score, 1),
                "total_shifts": total_shifts,
                "attendance_rate": round(((total_shifts - no_shows) / total_shifts) * 100, 1) if total_shifts > 0 else 0,
                "emergency_response_rate": round((accepted_emergencies / total_emergency_requests) * 100, 1) if total_emergency_requests > 0 else 0,
                "reliability_score": staff.reliability_score
            })
        
        # Sort by performance score
        staff_performance.sort(key=lambda x: x["performance_score"], reverse=True)
        
        return staff_performance
    
    async def get_cost_analysis(self, business_id: int, days: int = 30) -> Dict:
        """Get detailed cost analysis"""
        
        since_date = date.today() - timedelta(days=days)
        
        # Get shifts in period
        shifts = self.db.query(Shift).filter(
            Shift.business_id == business_id,
            func.date(Shift.date) >= since_date
        ).all()
        
        total_cost = 0
        cost_by_role = {}
        cost_by_day = {}
        
        for shift in shifts:
            # Calculate shift cost
            start_hour = int(shift.start_time.split(':')[0])
            end_hour = int(shift.end_time.split(':')[0])
            hours = end_hour - start_hour
            
            staff_count = self.db.query(ShiftAssignment).filter(
                ShiftAssignment.shift_id == shift.id,
                ShiftAssignment.status.in_(["assigned", "confirmed"])
            ).count()
            
            shift_cost = hours * staff_count * (shift.hourly_rate or 15)
            total_cost += shift_cost
            
            # Track by role
            role = shift.required_skill
            if role not in cost_by_role:
                cost_by_role[role] = 0
            cost_by_role[role] += shift_cost
            
            # Track by day
            day_key = shift.date.strftime('%Y-%m-%d')
            if day_key not in cost_by_day:
                cost_by_day[day_key] = 0
            cost_by_day[day_key] += shift_cost
        
        # Calculate emergency costs
        emergency_requests = self.db.query(EmergencyRequest).filter(
            EmergencyRequest.business_id == business_id,
            func.date(EmergencyRequest.created_at) >= since_date
        ).count()
        
        estimated_emergency_cost = emergency_requests * 50  # Estimated cost per emergency
        
        return {
            "period_days": days,
            "total_labour_cost": round(total_cost, 2),
            "average_daily_cost": round(total_cost / days, 2),
            "cost_by_role": {k: round(v, 2) for k, v in cost_by_role.items()},
            "emergency_cost_estimate": estimated_emergency_cost,
            "cost_breakdown": {
                "regular_shifts": round(total_cost, 2),
                "emergency_premium": estimated_emergency_cost,
                "total_with_emergencies": round(total_cost + estimated_emergency_cost, 2)
            },
            "daily_costs": [
                {"date": k, "cost": round(v, 2)} 
                for k, v in sorted(cost_by_day.items())
            ]
        }