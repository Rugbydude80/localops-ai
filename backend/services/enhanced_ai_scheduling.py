"""
Enhanced AI Scheduling Service for LocalOps AI

This service implements the comprehensive AI scheduling system with:
- Shift template management
- Employee availability and preferences
- Weekly hour allocation
- Intelligent scheduling with multiple factors
- Manual override capabilities
- Employee self-service features
"""

import os
import json
import logging
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime, date, time, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import openai
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from models import (
    Staff, Shift, ScheduleDraft, DraftShiftAssignment, 
    SchedulingConstraint, StaffPreference, Business,
    ShiftAssignment, DemandPrediction, ShiftTemplate,
    EmployeeAvailability, WeeklyHourAllocation, ScheduleOverride,
    ShiftSwapRequest, OpenShift, ScheduleAnalytics
)
from services.constraint_solver import ConstraintSolver, SchedulingContext, ValidationResult
from services.error_handler import error_handler, ErrorContext
from exceptions import (
    AIServiceException, ScheduleGenerationException, InsufficientStaffException,
    ConstraintViolationException, ExternalAPIException
)

logger = logging.getLogger(__name__)


@dataclass
class EnhancedSchedulingParameters:
    """Enhanced parameters for schedule generation"""
    business_id: int
    date_range_start: date
    date_range_end: date
    use_templates: bool = True
    respect_availability: bool = True
    optimize_hours: bool = True
    special_events: List[Dict[str, Any]] = None
    staff_notes: List[Dict[str, Any]] = None
    constraints: Dict[str, Any] = None
    created_by: int = 1
    
    def __post_init__(self):
        if self.special_events is None:
            self.special_events = []
        if self.staff_notes is None:
            self.staff_notes = []
        if self.constraints is None:
            self.constraints = {}


class SchedulingStrategy(Enum):
    """Enhanced scheduling strategies"""
    BALANCED = "balanced"  # Balance all factors
    COST_OPTIMIZED = "cost_optimized"  # Minimize labor costs
    STAFF_PREFERRED = "staff_preferred"  # Prioritize staff preferences
    COVERAGE_FOCUSED = "coverage_focused"  # Ensure all shifts are covered
    TEMPLATE_BASED = "template_based"  # Use shift templates as primary guide


@dataclass
class ShiftTemplateConfig:
    """Configuration for shift template application"""
    template_id: int
    days_to_apply: List[int]  # 0=Monday, 6=Sunday
    staff_count_override: Optional[int] = None
    time_adjustments: Optional[Dict[str, str]] = None  # {"start_time": "08:00", "end_time": "16:00"}


@dataclass
class EmployeeAvailabilityConfig:
    """Employee availability configuration"""
    staff_id: int
    weekly_target_hours: float
    preferred_shift_lengths: List[int]  # [4, 8, 12] hours
    max_consecutive_days: int = 6
    min_rest_hours: int = 11
    blackout_dates: Optional[List[date]] = None


class EnhancedAISchedulingEngine:
    """
    Enhanced AI-powered scheduling engine with comprehensive features
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.constraint_solver = ConstraintSolver(db)
        
        # Initialize OpenAI client
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            self.client = openai.AsyncOpenAI(api_key=api_key)
            self.ai_enabled = True
        else:
            self.client = None
            self.ai_enabled = False
            logger.warning("OpenAI API key not configured. AI features will use fallback logic.")
        
        self.model = "gpt-4-turbo"
    
    async def generate_enhanced_schedule(
        self,
        params: EnhancedSchedulingParameters,
        strategy: SchedulingStrategy = SchedulingStrategy.BALANCED,
        template_configs: Optional[List[ShiftTemplateConfig]] = None,
        availability_configs: Optional[List[EmployeeAvailabilityConfig]] = None
    ) -> Dict[str, Any]:
        """
        Generate enhanced schedule using all available features
        """
        logger.info(f"Generating enhanced schedule for business {params.business_id}")
        
        # Create draft record
        draft = ScheduleDraft(
            business_id=params.business_id,
            created_by=params.created_by,
            date_range_start=params.date_range_start,
            date_range_end=params.date_range_end,
            ai_generated=True,
            generation_params=asdict(params),
            status="draft"
        )
        self.db.add(draft)
        self.db.commit()
        self.db.refresh(draft)
        
        try:
            # Step 1: Generate or apply shift templates
            if params.use_templates and template_configs:
                shifts = await self._generate_shifts_from_templates(
                    params.business_id, params.date_range_start, params.date_range_end, template_configs
                )
            else:
                shifts = await self._get_existing_shifts(params.business_id, params.date_range_start, params.date_range_end)
            
            # Step 2: Get available staff with enhanced availability
            staff = await self._get_available_staff_with_preferences(
                params.business_id, params.date_range_start, params.date_range_end
            )
            
            # Step 3: Set up weekly hour allocations
            if params.optimize_hours and availability_configs:
                await self._setup_weekly_hour_allocations(
                    staff, params.date_range_start, params.date_range_end, availability_configs
                )
            
            # Step 4: Generate AI-enhanced assignments
            assignments = await self._generate_enhanced_assignments(
                shifts, staff, params, strategy, draft.id
            )
            
            # Step 5: Calculate analytics
            analytics = await self._calculate_schedule_analytics(
                params.business_id, params.date_range_start, assignments, staff
            )
            
            return {
                "draft_id": draft.id,
                "total_shifts": len(shifts),
                "assigned_shifts": len(assignments),
                "unassigned_shifts": len(shifts) - len(assignments),
                "overall_confidence": self._calculate_overall_confidence(assignments),
                "analytics": analytics,
                "warnings": self._generate_warnings(assignments, staff),
                "recommendations": await self._generate_recommendations(assignments, staff, analytics)
            }
            
        except Exception as e:
            logger.error(f"Enhanced schedule generation failed: {str(e)}")
            raise ScheduleGenerationException(f"Schedule generation failed: {str(e)}")
    
    async def _get_existing_shifts(
        self,
        business_id: int,
        start_date: date,
        end_date: date
    ) -> List[Shift]:
        """Get existing shifts in the date range"""
        return self.db.query(Shift).filter(
            Shift.business_id == business_id,
            Shift.date >= start_date,
            Shift.date <= end_date
        ).order_by(Shift.date, Shift.start_time).all()
    
    async def _generate_shifts_from_templates(
        self,
        business_id: int,
        start_date: date,
        end_date: date,
        template_configs: List[ShiftTemplateConfig]
    ) -> List[Shift]:
        """Generate shifts from templates"""
        shifts = []
        current_date = start_date
        
        while current_date <= end_date:
            day_of_week = current_date.weekday()
            
            # Find applicable templates for this day
            for config in template_configs:
                if day_of_week in config.days_to_apply:
                    template = self.db.query(ShiftTemplate).filter(
                        ShiftTemplate.id == config.template_id,
                        ShiftTemplate.business_id == business_id,
                        ShiftTemplate.is_active == True
                    ).first()
                    
                    if template:
                        # Create shift from template
                        shift = Shift(
                            business_id=business_id,
                            title=template.name,
                            date=current_date,
                            start_time=config.time_adjustments.get("start_time", template.start_time) if config.time_adjustments else template.start_time,
                            end_time=config.time_adjustments.get("end_time", template.end_time) if config.time_adjustments else template.end_time,
                            required_skill=template.required_skills[0] if template.required_skills else "general",
                            required_staff_count=config.staff_count_override or template.min_staff_count,
                            hourly_rate=template.hourly_rate,
                            notes=f"Generated from template: {template.name}"
                        )
                        self.db.add(shift)
                        shifts.append(shift)
            
            current_date += timedelta(days=1)
        
        self.db.commit()
        return shifts
    
    async def _get_available_staff_with_preferences(
        self,
        business_id: int,
        start_date: date,
        end_date: date
    ) -> List[Dict[str, Any]]:
        """Get staff with enhanced availability and preferences"""
        staff = self.db.query(Staff).filter(
            Staff.business_id == business_id,
            Staff.is_active == True
        ).all()
        
        enhanced_staff = []
        for s in staff:
            # Get availability preferences
            availability = self.db.query(EmployeeAvailability).filter(
                EmployeeAvailability.staff_id == s.id,
                EmployeeAvailability.is_active == True
            ).all()
            
            # Get weekly hour allocation
            week_start = start_date - timedelta(days=start_date.weekday())
            hour_allocation = self.db.query(WeeklyHourAllocation).filter(
                WeeklyHourAllocation.staff_id == s.id,
                WeeklyHourAllocation.week_start == week_start
            ).first()
            
            enhanced_staff.append({
                "id": s.id,
                "name": s.name,
                "skills": s.skills or [],
                "availability": availability,
                "hour_allocation": hour_allocation,
                "reliability_score": s.reliability_score,
                "hourly_rate": getattr(s, 'hourly_rate', None)
            })
        
        return enhanced_staff
    
    async def _setup_weekly_hour_allocations(
        self,
        staff: List[Dict[str, Any]],
        start_date: date,
        end_date: date,
        availability_configs: List[EmployeeAvailabilityConfig]
    ):
        """Set up weekly hour allocations for staff"""
        week_start = start_date - timedelta(days=start_date.weekday())
        
        for staff_member in staff:
            # Check if allocation already exists
            existing = self.db.query(WeeklyHourAllocation).filter(
                WeeklyHourAllocation.staff_id == staff_member["id"],
                WeeklyHourAllocation.week_start == week_start
            ).first()
            
            if not existing:
                # Find config for this staff member
                config = next((c for c in availability_configs if c.staff_id == staff_member["id"]), None)
                
                allocation = WeeklyHourAllocation(
                    staff_id=staff_member["id"],
                    week_start=week_start,
                    target_hours=config.weekly_target_hours if config else 40.0,
                    status="pending"
                )
                self.db.add(allocation)
        
        self.db.commit()
    
    async def _generate_enhanced_assignments(
        self,
        shifts: List[Shift],
        staff: List[Dict[str, Any]],
        params: EnhancedSchedulingParameters,
        strategy: SchedulingStrategy,
        draft_id: str
    ) -> List[DraftShiftAssignment]:
        """Generate enhanced assignments using AI and availability data"""
        
        assignments = []
        
        # Sort shifts by priority (earlier dates, harder skills first)
        sorted_shifts = self._prioritize_shifts(shifts)
        
        for shift in sorted_shifts:
            # Find best staff for this shift considering availability
            best_staff = await self._find_best_staff_for_shift(
                shift, staff, params.date_range_start, strategy
            )
            
            if best_staff:
                # Create assignment
                assignment = DraftShiftAssignment(
                    draft_id=draft_id,
                    shift_id=shift.id,
                    staff_id=best_staff["id"],
                    confidence_score=best_staff.get("confidence", 0.8),
                    reasoning=best_staff.get("reasoning", "AI assignment"),
                    is_ai_generated=True
                )
                self.db.add(assignment)
                assignments.append(assignment)
                
                # Update hour allocation
                await self._update_hour_allocation(best_staff["id"], shift)
        
        self.db.commit()
        return assignments
    
    async def _find_best_staff_for_shift(
        self,
        shift: Shift,
        staff: List[Dict[str, Any]],
        week_start: date,
        strategy: SchedulingStrategy
    ) -> Optional[Dict[str, Any]]:
        """Find the best staff member for a specific shift"""
        
        shift_date = shift.date
        day_of_week = shift_date.weekday()
        
        suitable_staff = []
        
        for staff_member in staff:
            # Check availability for this day
            availability = self._check_staff_availability(
                staff_member, day_of_week, shift.start_time, shift.end_time
            )
            
            if availability["available"]:
                # Calculate assignment score
                score = self._calculate_assignment_score(
                    staff_member, shift, availability, strategy
                )
                
                suitable_staff.append({
                    **staff_member,
                    "assignment_score": score,
                    "availability": availability
                })
        
        if not suitable_staff:
            return None
        
        # Sort by score and return best match
        suitable_staff.sort(key=lambda x: x["assignment_score"], reverse=True)
        best_staff = suitable_staff[0]
        
        # Generate reasoning
        reasoning = self._generate_assignment_reasoning(best_staff, shift, suitable_staff)
        
        return {
            **best_staff,
            "confidence": min(0.95, best_staff["assignment_score"]),
            "reasoning": reasoning
        }
    
    def _check_staff_availability(
        self,
        staff_member: Dict[str, Any],
        day_of_week: int,
        start_time: str,
        end_time: str
    ) -> Dict[str, Any]:
        """Check if staff member is available for specific shift"""
        
        # Check availability preferences
        availability = next(
            (a for a in staff_member["availability"] if a.day_of_week == day_of_week),
            None
        )
        
        if not availability:
            return {"available": True, "type": "default", "priority": "medium"}
        
        if availability.availability_type == "unavailable":
            return {"available": False, "type": "unavailable", "reason": "Marked as unavailable"}
        
        # Check time overlap
        if availability.start_time and availability.end_time:
            shift_start = datetime.strptime(start_time, "%H:%M").time()
            shift_end = datetime.strptime(end_time, "%H:%M").time()
            avail_start = datetime.strptime(availability.start_time, "%H:%M").time()
            avail_end = datetime.strptime(availability.end_time, "%H:%M").time()
            
            if shift_start < avail_start or shift_end > avail_end:
                return {"available": False, "type": "time_conflict", "reason": "Outside available hours"}
        
        return {
            "available": True,
            "type": availability.availability_type,
            "priority": availability.priority,
            "preferred": availability.availability_type == "available"
        }
    
    def _calculate_assignment_score(
        self,
        staff_member: Dict[str, Any],
        shift: Shift,
        availability: Dict[str, Any],
        strategy: SchedulingStrategy
    ) -> float:
        """Calculate assignment score based on multiple factors"""
        
        score = 0.0
        
        # Skill matching (40% weight)
        if shift.required_skill in staff_member["skills"]:
            score += 0.4
        elif any(skill in staff_member["skills"] for skill in ["management", "supervisor"]):
            score += 0.3  # Management can handle most roles
        else:
            score += 0.1  # Basic score for skill mismatch
        
        # Availability preference (25% weight)
        if availability["preferred"]:
            score += 0.25
        elif availability["type"] == "if_needed":
            score += 0.15
        else:
            score += 0.05
        
        # Hour allocation optimization (20% weight)
        hour_allocation = staff_member.get("hour_allocation")
        if hour_allocation:
            hours_needed = self._calculate_shift_hours(shift)
            remaining_hours = hour_allocation.target_hours - hour_allocation.allocated_hours
            
            if remaining_hours >= hours_needed:
                score += 0.2
            elif remaining_hours > 0:
                score += 0.1 * (remaining_hours / hours_needed)
        
        # Reliability score (15% weight)
        reliability = staff_member.get("reliability_score", 5.0)
        score += 0.15 * (reliability / 10.0)
        
        # Strategy-specific adjustments
        if strategy == SchedulingStrategy.COST_OPTIMIZED:
            hourly_rate = staff_member.get("hourly_rate", 15.0)
            score -= 0.1 * (hourly_rate - 15.0) / 15.0  # Prefer lower rates
        
        elif strategy == SchedulingStrategy.STAFF_PREFERRED:
            if availability["preferred"]:
                score += 0.2  # Bonus for preferred availability
        
        return min(1.0, max(0.0, score))
    
    def _calculate_shift_hours(self, shift: Shift) -> float:
        """Calculate shift duration in hours"""
        start = datetime.strptime(shift.start_time, "%H:%M")
        end = datetime.strptime(shift.end_time, "%H:%M")
        
        if end < start:  # Overnight shift
            end += timedelta(days=1)
        
        duration = end - start
        return duration.total_seconds() / 3600
    
    async def _update_hour_allocation(self, staff_id: int, shift: Shift):
        """Update staff member's allocated hours"""
        week_start = shift.date - timedelta(days=shift.date.weekday())
        
        allocation = self.db.query(WeeklyHourAllocation).filter(
            WeeklyHourAllocation.staff_id == staff_id,
            WeeklyHourAllocation.week_start == week_start
        ).first()
        
        if allocation:
            hours_to_add = self._calculate_shift_hours(shift)
            allocation.allocated_hours += hours_to_add
            
            # Check for overtime
            if allocation.allocated_hours > allocation.target_hours:
                allocation.overtime_hours = allocation.allocated_hours - allocation.target_hours
    
    def _generate_assignment_reasoning(
        self,
        staff_member: Dict[str, Any],
        shift: Shift,
        all_candidates: List[Dict[str, Any]]
    ) -> str:
        """Generate human-readable reasoning for assignment"""
        
        reasons = []
        
        # Skill match
        if shift.required_skill in staff_member["skills"]:
            reasons.append(f"✓ Has required {shift.required_skill} skill")
        else:
            reasons.append(f"⚠ Skill mismatch, but has related skills")
        
        # Availability
        availability = staff_member["availability"]
        if availability["preferred"]:
            reasons.append("✓ Preferred availability")
        elif availability["type"] == "if_needed":
            reasons.append("✓ Available if needed")
        
        # Hour optimization
        hour_allocation = staff_member.get("hour_allocation")
        if hour_allocation:
            remaining = hour_allocation.target_hours - hour_allocation.allocated_hours
            if remaining > 0:
                reasons.append(f"✓ Needs {remaining:.1f} more hours this week")
        
        # Reliability
        reliability = staff_member.get("reliability_score", 5.0)
        if reliability >= 8.0:
            reasons.append("✓ High reliability score")
        
        return "; ".join(reasons)
    
    def _prioritize_shifts(self, shifts: List[Shift]) -> List[Shift]:
        """Prioritize shifts for assignment"""
        def shift_priority(shift):
            # Earlier dates first
            date_priority = (shift.date - date.today()).days
            
            # Harder skills first
            skill_priority = {
                "management": 3,
                "kitchen": 2,
                "bar": 2,
                "front_of_house": 1
            }.get(shift.required_skill, 1)
            
            # Higher staff requirements first
            staff_priority = shift.required_staff_count
            
            return (date_priority, -skill_priority, -staff_priority)
        
        return sorted(shifts, key=shift_priority)
    
    def _calculate_overall_confidence(self, assignments: List[DraftShiftAssignment]) -> float:
        """Calculate overall confidence score for the schedule"""
        if not assignments:
            return 0.0
        
        total_confidence = sum(a.confidence_score for a in assignments)
        return total_confidence / len(assignments)
    
    async def _calculate_schedule_analytics(
        self,
        business_id: int,
        week_start: date,
        assignments: List[DraftShiftAssignment],
        staff: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate comprehensive schedule analytics"""
        
        total_hours = 0
        total_cost = 0
        coverage_gaps = 0
        
        for assignment in assignments:
            shift = self.db.query(Shift).filter(Shift.id == assignment.shift_id).first()
            if shift:
                hours = self._calculate_shift_hours(shift)
                total_hours += hours
                
                # Calculate cost
                staff_member = next((s for s in staff if s["id"] == assignment.staff_id), None)
                if staff_member and staff_member.get("hourly_rate"):
                    total_cost += hours * staff_member["hourly_rate"]
        
        # Calculate coverage rate
        all_shifts = self.db.query(Shift).filter(
            Shift.business_id == business_id,
            Shift.date >= week_start,
            Shift.date < week_start + timedelta(days=7)
        ).all()
        
        covered_shifts = len(set(a.shift_id for a in assignments))
        coverage_rate = (covered_shifts / len(all_shifts)) * 100 if all_shifts else 0
        
        return {
            "total_scheduled_hours": total_hours,
            "total_labor_cost": total_cost,
            "coverage_rate": coverage_rate,
            "understaffed_shifts": coverage_gaps,
            "ai_confidence_average": self._calculate_overall_confidence(assignments)
        }
    
    def _generate_warnings(self, assignments: List[DraftShiftAssignment], staff: List[Dict[str, Any]]) -> List[str]:
        """Generate warnings about the schedule"""
        warnings = []
        
        # Check for overtime
        for staff_member in staff:
            hour_allocation = staff_member.get("hour_allocation")
            if hour_allocation and hour_allocation.overtime_hours > 0:
                warnings.append(f"{staff_member['name']} scheduled for {hour_allocation.overtime_hours:.1f} overtime hours")
        
        # Check for low confidence assignments
        low_confidence = [a for a in assignments if a.confidence_score < 0.6]
        if low_confidence:
            warnings.append(f"{len(low_confidence)} assignments have low confidence scores")
        
        return warnings
    
    async def _generate_recommendations(
        self,
        assignments: List[DraftShiftAssignment],
        staff: List[Dict[str, Any]],
        analytics: Dict[str, Any]
    ) -> List[str]:
        """Generate AI-powered recommendations for schedule improvement"""
        
        if not self.ai_enabled:
            return []
        
        recommendations = []
        
        # Coverage recommendations
        if analytics["coverage_rate"] < 90:
            recommendations.append("Consider adding more staff to improve coverage rate")
        
        # Cost optimization
        if analytics["total_labor_cost"] > 0:
            recommendations.append("Review hourly rates to optimize labor costs")
        
        # Overtime management
        overtime_staff = [s for s in staff if s.get("hour_allocation") and s["hour_allocation"].overtime_hours > 0]
        if overtime_staff:
            recommendations.append("Distribute overtime more evenly across staff")
        
        return recommendations
    
    async def apply_manual_override(
        self,
        draft_id: str,
        shift_id: int,
        staff_id: int,
        override_type: str,
        reason: str,
        overridden_by: int
    ) -> Dict[str, Any]:
        """Apply manual override to AI-generated schedule"""
        
        # Create override record
        override = ScheduleOverride(
            draft_id=draft_id,
            shift_id=shift_id,
            staff_id=staff_id,
            override_type=override_type,
            reason=reason,
            overridden_by=overridden_by
        )
        self.db.add(override)
        
        # Update assignment
        assignment = self.db.query(DraftShiftAssignment).filter(
            DraftShiftAssignment.draft_id == draft_id,
            DraftShiftAssignment.shift_id == shift_id
        ).first()
        
        if assignment:
            assignment.manual_override = True
            assignment.confidence_score = 1.0  # Manual overrides have full confidence
        
        self.db.commit()
        
        return {
            "override_id": override.id,
            "message": "Manual override applied successfully"
        }
    
    async def create_shift_swap_request(
        self,
        business_id: int,
        requester_id: int,
        target_staff_id: int,
        requester_shift_id: int,
        target_shift_id: int,
        reason: str
    ) -> Dict[str, Any]:
        """Create a shift swap request"""
        
        # Validate request
        requester_shift = self.db.query(Shift).filter(Shift.id == requester_shift_id).first()
        target_shift = self.db.query(Shift).filter(Shift.id == target_shift_id).first()
        
        if not requester_shift or not target_shift:
            raise ValueError("Invalid shift IDs")
        
        # Create swap request
        swap_request = ShiftSwapRequest(
            business_id=business_id,
            requester_id=requester_id,
            target_staff_id=target_staff_id,
            requester_shift_id=requester_shift_id,
            target_shift_id=target_shift_id,
            reason=reason,
            expires_at=datetime.now() + timedelta(hours=24)  # 24 hour expiry
        )
        self.db.add(swap_request)
        self.db.commit()
        
        return {
            "swap_id": swap_request.id,
            "message": "Shift swap request created successfully"
        }
    
    async def create_open_shift(
        self,
        business_id: int,
        shift_id: int,
        required_skills: List[str],
        hourly_rate: float = None,
        pickup_deadline: datetime = None
    ) -> Dict[str, Any]:
        """Create an open shift for employee pickup"""
        
        shift = self.db.query(Shift).filter(Shift.id == shift_id).first()
        if not shift:
            raise ValueError("Invalid shift ID")
        
        open_shift = OpenShift(
            business_id=business_id,
            shift_id=shift_id,
            required_skills=required_skills,
            hourly_rate=hourly_rate or shift.hourly_rate,
            pickup_deadline=pickup_deadline or (datetime.now() + timedelta(hours=12))
        )
        self.db.add(open_shift)
        self.db.commit()
        
        return {
            "open_shift_id": open_shift.id,
            "message": "Open shift created successfully"
        } 