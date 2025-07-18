"""
AI Scheduling Engine for Auto-Scheduling System

This service integrates with OpenAI API to provide intelligent scheduling decisions
considering staff preferences, historical data, and business rules.
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

from models import (
    Staff, Shift, ScheduleDraft, DraftShiftAssignment, 
    SchedulingConstraint, StaffPreference, Business,
    ShiftAssignment, DemandPrediction
)
from services.constraint_solver import ConstraintSolver, SchedulingContext, ValidationResult
from services.error_handler import error_handler, ErrorContext
from exceptions import (
    AIServiceException, ScheduleGenerationException, InsufficientStaffException,
    ConstraintViolationException, ExternalAPIException
)

logger = logging.getLogger(__name__)


@dataclass
class SchedulingParameters:
    """Parameters for schedule generation"""
    business_id: int
    date_range_start: date
    date_range_end: date
    special_events: List[Dict[str, Any]]
    staff_notes: List[Dict[str, Any]]
    constraints: Dict[str, Any]
    created_by: int


@dataclass
class AssignmentReasoning:
    """Reasoning for a specific assignment decision"""
    staff_id: int
    shift_id: int
    confidence_score: float
    primary_reasons: List[str]
    considerations: List[str]
    alternatives_considered: List[Dict[str, Any]]
    risk_factors: List[str]


@dataclass
class ScheduleGenerationResult:
    """Result of schedule generation"""
    draft_id: str
    assignments: List[DraftShiftAssignment]
    overall_confidence: float
    generation_summary: Dict[str, Any]
    warnings: List[str]
    recommendations: List[str]


class SchedulingStrategy(Enum):
    """Different scheduling strategies"""
    BALANCED = "balanced"  # Balance all factors
    COST_OPTIMIZED = "cost_optimized"  # Minimize labor costs
    STAFF_PREFERRED = "staff_preferred"  # Prioritize staff preferences
    COVERAGE_FOCUSED = "coverage_focused"  # Ensure all shifts are covered


class AISchedulingEngine:
    """
    AI-powered scheduling engine that integrates with OpenAI API
    for intelligent scheduling decisions
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.constraint_solver = ConstraintSolver(db)
        self.reasoning_engine = ReasoningEngine()
        
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
    
    async def generate_schedule(
        self,
        params: SchedulingParameters,
        strategy: SchedulingStrategy = SchedulingStrategy.BALANCED
    ) -> ScheduleGenerationResult:
        """
        Generate optimal schedule using AI and constraint solving with comprehensive error handling
        
        Args:
            params: Scheduling parameters
            strategy: Scheduling strategy to use
            
        Returns:
            ScheduleGenerationResult with assignments and reasoning
        """
        logger.info(f"Generating schedule for business {params.business_id} "
                   f"from {params.date_range_start} to {params.date_range_end}")
        
        # Create error context for tracking
        error_context = ErrorContext(
            operation="generate_schedule",
            business_id=params.business_id,
            additional_data={
                "date_range_start": params.date_range_start.isoformat(),
                "date_range_end": params.date_range_end.isoformat(),
                "strategy": strategy.value
            }
        )
        
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
        
        error_context.draft_id = draft.id
        
        try:
            # Get scheduling context
            context = await self._build_scheduling_context(params)
            
            # Get shifts to schedule
            shifts = await self._get_shifts_to_schedule(params)
            if not shifts:
                raise ScheduleGenerationException(
                    "No shifts found to schedule in the specified date range",
                    {"date_range": f"{params.date_range_start} to {params.date_range_end}"}
                )
            
            # Get available staff
            staff = await self._get_available_staff(params.business_id)
            if not staff:
                raise InsufficientStaffException(
                    required_skills=list(set(shift.required_skill for shift in shifts)),
                    available_count=0,
                    required_count=len(shifts),
                    shift_details={"total_shifts": len(shifts)}
                )
            
            # Generate AI-enhanced assignments with fallback
            assignments = await self._generate_ai_assignments_with_fallback(
                shifts, staff, context, strategy, draft.id
            )
            
            # Calculate overall confidence
            overall_confidence = self._calculate_overall_confidence(assignments)
            
            # Generate summary and recommendations
            summary = await self._generate_schedule_summary(
                assignments, shifts, staff, context
            )
            
            # Update draft with confidence score
            draft.confidence_score = overall_confidence
            self.db.commit()
            
            logger.info(f"Generated schedule with {len(assignments)} assignments, "
                       f"confidence: {overall_confidence:.2f}")
            
            return ScheduleGenerationResult(
                draft_id=draft.id,
                assignments=assignments,
                overall_confidence=overall_confidence,
                generation_summary=summary,
                warnings=summary.get("warnings", []),
                recommendations=summary.get("recommendations", [])
            )
            
        except (ScheduleGenerationException, InsufficientStaffException, ConstraintViolationException) as e:
            # Handle known scheduling exceptions
            logger.error(f"Schedule generation failed: {str(e)}")
            draft.status = "failed"
            self.db.commit()
            
            # Use error handler for recovery
            error_result = await error_handler.handle_error(e, error_context, enable_fallback=True)
            
            # If recovery was successful, return the recovered result
            if error_result.get("success") and error_result.get("recovery"):
                recovery_data = error_result["recovery"]
                
                # Create a basic schedule result from recovery
                return ScheduleGenerationResult(
                    draft_id=draft.id,
                    assignments=[],  # Would be populated by recovery
                    overall_confidence=recovery_data.get("confidence_score", 0.5),
                    generation_summary={
                        "fallback_used": True,
                        "recovery_strategy": recovery_data.get("strategy"),
                        "message": recovery_data.get("message")
                    },
                    warnings=[f"Fallback strategy used: {recovery_data.get('strategy')}"],
                    recommendations=["Review scheduling parameters and constraints"]
                )
            
            # Re-raise if no recovery possible
            raise
            
        except Exception as e:
            # Handle unexpected errors
            logger.error(f"Unexpected error in schedule generation: {str(e)}")
            draft.status = "failed"
            self.db.commit()
            
            # Use error handler for unexpected errors
            error_result = await error_handler.handle_error(e, error_context, enable_fallback=True)
            
            if error_result.get("success"):
                # Return minimal result if recovery succeeded
                return ScheduleGenerationResult(
                    draft_id=draft.id,
                    assignments=[],
                    overall_confidence=0.3,
                    generation_summary={"error_recovery": True},
                    warnings=["Schedule generation encountered errors but was recovered"],
                    recommendations=["Contact support if issues persist"]
                )
            
            # Convert to scheduling exception for consistent error handling
            raise ScheduleGenerationException(
                f"Unexpected error during schedule generation: {str(e)}",
                {"original_error": type(e).__name__},
                fallback_available=False
            )
    
    async def explain_assignment(
        self,
        assignment: DraftShiftAssignment,
        context: SchedulingContext
    ) -> AssignmentReasoning:
        """
        Generate human-readable explanation for assignment decision
        
        Args:
            assignment: The assignment to explain
            context: Scheduling context
            
        Returns:
            AssignmentReasoning with detailed explanation
        """
        # Get shift and staff details
        shift = self.db.query(Shift).filter(Shift.id == assignment.shift_id).first()
        staff = self.db.query(Staff).filter(Staff.id == assignment.staff_id).first()
        
        if not shift or not staff:
            raise ValueError("Invalid assignment - shift or staff not found")
        
        # Use reasoning engine to generate explanation
        reasoning = await self.reasoning_engine.generate_assignment_reasoning(
            shift, staff, assignment, context, self.ai_enabled
        )
        
        return reasoning
    
    async def optimize_existing_schedule(
        self,
        draft_id: str,
        optimization_goals: List[str]
    ) -> ScheduleGenerationResult:
        """
        Optimize an existing schedule draft based on specific goals
        
        Args:
            draft_id: ID of the draft to optimize
            optimization_goals: List of optimization goals
            
        Returns:
            Updated ScheduleGenerationResult
        """
        draft = self.db.query(ScheduleDraft).filter(
            ScheduleDraft.id == draft_id
        ).first()
        
        if not draft:
            raise ValueError(f"Draft {draft_id} not found")
        
        # Get current assignments
        current_assignments = self.db.query(DraftShiftAssignment).filter(
            DraftShiftAssignment.draft_id == draft_id
        ).all()
        
        # Build context from draft
        context = await self._build_context_from_draft(draft)
        
        # Apply AI-powered optimizations
        optimized_assignments = await self._apply_ai_optimizations(
            current_assignments, context, optimization_goals
        )
        
        # Update assignments in database
        for assignment in optimized_assignments:
            self.db.merge(assignment)
        
        # Recalculate confidence
        overall_confidence = self._calculate_overall_confidence(optimized_assignments)
        draft.confidence_score = overall_confidence
        
        self.db.commit()
        
        return ScheduleGenerationResult(
            draft_id=draft_id,
            assignments=optimized_assignments,
            overall_confidence=overall_confidence,
            generation_summary={"optimized": True, "goals": optimization_goals},
            warnings=[],
            recommendations=[]
        )
    
    async def _build_scheduling_context(
        self, params: SchedulingParameters
    ) -> SchedulingContext:
        """Build scheduling context from parameters"""
        
        # Get constraints
        constraints = self.db.query(SchedulingConstraint).filter(
            SchedulingConstraint.business_id == params.business_id,
            SchedulingConstraint.is_active == True
        ).all()
        
        # Get staff preferences
        preferences = self.db.query(StaffPreference).filter(
            StaffPreference.is_active == True,
            StaffPreference.effective_date <= params.date_range_end,
            (StaffPreference.expiry_date.is_(None) | 
             (StaffPreference.expiry_date >= params.date_range_start))
        ).all()
        
        # Get existing assignments in the date range
        existing_assignments = self.db.query(DraftShiftAssignment).join(
            ScheduleDraft
        ).filter(
            ScheduleDraft.business_id == params.business_id,
            ScheduleDraft.date_range_start <= params.date_range_end,
            ScheduleDraft.date_range_end >= params.date_range_start,
            ScheduleDraft.status == "published"
        ).all()
        
        return SchedulingContext(
            business_id=params.business_id,
            date_range_start=params.date_range_start,
            date_range_end=params.date_range_end,
            existing_assignments=existing_assignments,
            constraints=constraints,
            staff_preferences=preferences
        )
    
    async def _get_shifts_to_schedule(
        self, params: SchedulingParameters
    ) -> List[Shift]:
        """Get shifts that need to be scheduled"""
        
        shifts = self.db.query(Shift).filter(
            Shift.business_id == params.business_id,
            Shift.date >= datetime.combine(params.date_range_start, time.min),
            Shift.date <= datetime.combine(params.date_range_end, time.max),
            Shift.status.in_(["scheduled", "understaffed"])
        ).order_by(Shift.date, Shift.start_time).all()
        
        return shifts
    
    async def _get_available_staff(self, business_id: int) -> List[Staff]:
        """Get available staff for scheduling"""
        
        staff = self.db.query(Staff).filter(
            Staff.business_id == business_id,
            Staff.is_active == True
        ).all()
        
        return staff
    
    async def _generate_ai_assignments_with_fallback(
        self,
        shifts: List[Shift],
        staff: List[Staff],
        context: SchedulingContext,
        strategy: SchedulingStrategy,
        draft_id: str
    ) -> List[DraftShiftAssignment]:
        """Generate assignments using AI with comprehensive fallback mechanisms"""
        
        error_context = ErrorContext(
            operation="generate_ai_assignments",
            business_id=context.business_id,
            draft_id=draft_id,
            additional_data={
                "shifts_count": len(shifts),
                "staff_count": len(staff),
                "strategy": strategy.value
            }
        )
        
        try:
            # Try AI-enhanced assignment generation first
            return await self._generate_ai_assignments(
                shifts, staff, context, strategy, draft_id
            )
            
        except AIServiceException as e:
            # AI service failed, use rule-based fallback
            logger.warning(f"AI service failed, falling back to rule-based scheduling: {str(e)}")
            
            error_result = await error_handler.handle_error(e, error_context, enable_fallback=True)
            
            # Generate assignments using constraint solver only
            return await self._generate_rule_based_assignments(
                shifts, staff, context, draft_id
            )
            
        except Exception as e:
            # Unexpected error, try to recover
            logger.error(f"Unexpected error in AI assignment generation: {str(e)}")
            
            # Convert to AI service exception for consistent handling
            ai_error = AIServiceException(
                message=f"Assignment generation failed: {str(e)}",
                service_name="SchedulingEngine",
                error_type="assignment_generation_error"
            )
            
            error_result = await error_handler.handle_error(ai_error, error_context, enable_fallback=True)
            
            # Fall back to basic rule-based assignments
            return await self._generate_rule_based_assignments(
                shifts, staff, context, draft_id
            )
    
    async def _generate_ai_assignments(
        self,
        shifts: List[Shift],
        staff: List[Staff],
        context: SchedulingContext,
        strategy: SchedulingStrategy,
        draft_id: str
    ) -> List[DraftShiftAssignment]:
        """Generate assignments using AI and constraint solving"""
        
        assignments = []
        
        if self.ai_enabled:
            try:
                # Use AI to enhance assignment decisions
                ai_recommendations = await self._get_ai_scheduling_recommendations(
                    shifts, staff, context, strategy
                )
            except Exception as e:
                # AI recommendations failed, but continue with constraint solver
                logger.warning(f"AI recommendations failed: {str(e)}")
                raise AIServiceException(
                    message=f"Failed to get AI recommendations: {str(e)}",
                    service_name="OpenAI",
                    error_type="recommendation_error"
                )
        else:
            ai_recommendations = {}
        
        # Use constraint solver for base assignments
        try:
            base_assignments = self.constraint_solver.solve_scheduling_constraints(
                shifts, staff, context
            )
        except Exception as e:
            logger.error(f"Constraint solver failed: {str(e)}")
            raise ConstraintViolationException(
                constraint_type="scheduling_optimization",
                violation_details={"error": str(e)},
                affected_shifts=[shift.id for shift in shifts]
            )
        
        # Enhance assignments with AI insights
        for assignment in base_assignments:
            assignment.draft_id = draft_id
            
            # Apply AI enhancements if available
            if assignment.shift_id in ai_recommendations:
                ai_rec = ai_recommendations[assignment.shift_id]
                assignment.confidence_score = ai_rec.get("confidence", assignment.confidence_score)
                assignment.reasoning = ai_rec.get("reasoning", assignment.reasoning)
            
            assignments.append(assignment)
            self.db.add(assignment)
        
        self.db.commit()
        return assignments
    
    async def _generate_rule_based_assignments(
        self,
        shifts: List[Shift],
        staff: List[Staff],
        context: SchedulingContext,
        draft_id: str
    ) -> List[DraftShiftAssignment]:
        """Generate assignments using only rule-based logic (fallback)"""
        
        logger.info("Generating schedule using rule-based fallback logic")
        
        assignments = []
        
        try:
            # Use constraint solver for basic assignments
            base_assignments = self.constraint_solver.solve_scheduling_constraints(
                shifts, staff, context
            )
            
            # Convert to draft assignments with lower confidence
            for assignment in base_assignments:
                draft_assignment = DraftShiftAssignment(
                    draft_id=draft_id,
                    shift_id=assignment.shift_id,
                    staff_id=assignment.staff_id,
                    confidence_score=0.6,  # Lower confidence for rule-based
                    reasoning="Rule-based assignment (AI fallback)",
                    is_ai_generated=False,
                    manual_override=False
                )
                assignments.append(draft_assignment)
                self.db.add(draft_assignment)
            
            self.db.commit()
            logger.info(f"Generated {len(assignments)} rule-based assignments")
            
        except Exception as e:
            logger.error(f"Rule-based assignment generation failed: {str(e)}")
            
            # Last resort: create minimal assignments
            assignments = await self._generate_minimal_assignments(
                shifts, staff, draft_id
            )
        
        return assignments
    
    async def _generate_minimal_assignments(
        self,
        shifts: List[Shift],
        staff: List[Staff],
        draft_id: str
    ) -> List[DraftShiftAssignment]:
        """Generate minimal assignments as last resort"""
        
        logger.warning("Using minimal assignment generation as last resort")
        
        assignments = []
        staff_by_skill = {}
        
        # Group staff by skills
        for staff_member in staff:
            for skill in staff_member.skills or []:
                if skill not in staff_by_skill:
                    staff_by_skill[skill] = []
                staff_by_skill[skill].append(staff_member)
        
        # Assign staff to shifts based on skill matching only
        for shift in shifts:
            available_staff = staff_by_skill.get(shift.required_skill, [])
            
            if available_staff:
                # Simple assignment: first available staff member
                selected_staff = available_staff[0]
                
                assignment = DraftShiftAssignment(
                    draft_id=draft_id,
                    shift_id=shift.id,
                    staff_id=selected_staff.id,
                    confidence_score=0.3,  # Very low confidence
                    reasoning="Minimal skill-based assignment (emergency fallback)",
                    is_ai_generated=False,
                    manual_override=False
                )
                
                assignments.append(assignment)
                self.db.add(assignment)
                
                # Remove staff from available pool to avoid overassignment
                available_staff.remove(selected_staff)
        
        self.db.commit()
        logger.info(f"Generated {len(assignments)} minimal assignments")
        
        return assignments
    
    async def _get_ai_scheduling_recommendations(
        self,
        shifts: List[Shift],
        staff: List[Staff],
        context: SchedulingContext,
        strategy: SchedulingStrategy
    ) -> Dict[int, Dict[str, Any]]:
        """Get AI recommendations for scheduling decisions"""
        
        if not self.ai_enabled:
            return {}
        
        # Prepare data for AI analysis
        shifts_data = []
        for shift in shifts:
            shifts_data.append({
                "id": shift.id,
                "title": shift.title,
                "date": shift.date.isoformat(),
                "start_time": shift.start_time,
                "end_time": shift.end_time,
                "required_skill": shift.required_skill,
                "required_staff_count": shift.required_staff_count
            })
        
        staff_data = []
        for s in staff:
            staff_data.append({
                "id": s.id,
                "name": s.name,
                "skills": s.skills or [],
                "availability": s.availability or {},
                "reliability_score": s.reliability_score
            })
        
        # Get historical performance data
        historical_data = await self._get_historical_scheduling_data(
            context.business_id, context.date_range_start
        )
        
        prompt = self._build_ai_scheduling_prompt(
            shifts_data, staff_data, historical_data, strategy
        )
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert restaurant scheduling AI. Analyze the data and provide optimal staff assignments with reasoning."
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.3
            )
            
            # Parse AI response
            ai_response = json.loads(response.choices[0].message.content)
            return ai_response.get("recommendations", {})
            
        except Exception as e:
            logger.error(f"AI scheduling recommendations failed: {str(e)}")
            return {}
    
    def _build_ai_scheduling_prompt(
        self,
        shifts_data: List[Dict],
        staff_data: List[Dict],
        historical_data: Dict,
        strategy: SchedulingStrategy
    ) -> str:
        """Build prompt for AI scheduling recommendations"""
        
        return f"""
        Analyze this restaurant scheduling scenario and provide optimal staff assignments:
        
        SHIFTS TO SCHEDULE:
        {json.dumps(shifts_data, indent=2)}
        
        AVAILABLE STAFF:
        {json.dumps(staff_data, indent=2)}
        
        HISTORICAL PERFORMANCE:
        {json.dumps(historical_data, indent=2)}
        
        STRATEGY: {strategy.value}
        
        For each shift, recommend the best staff assignment considering:
        1. Skill matching and experience
        2. Staff availability and preferences
        3. Workload distribution and fairness
        4. Historical performance and reliability
        5. Cost optimization (if strategy requires)
        
        Return JSON format:
        {{
            "recommendations": {{
                "shift_id": {{
                    "recommended_staff_id": int,
                    "confidence": float (0-1),
                    "reasoning": "detailed explanation",
                    "alternatives": [{{staff_id: int, score: float}}],
                    "risk_factors": ["list of concerns"]
                }}
            }},
            "overall_insights": "general observations about this schedule"
        }}
        
        Focus on practical, actionable recommendations that a restaurant manager would find valuable.
        """
    
    async def _get_historical_scheduling_data(
        self, business_id: int, reference_date: date
    ) -> Dict[str, Any]:
        """Get historical scheduling performance data"""
        
        # Look back 30 days for patterns
        lookback_start = reference_date - timedelta(days=30)
        
        # Get published schedules and their performance
        historical_assignments = self.db.query(ShiftAssignment).join(Shift).filter(
            Shift.business_id == business_id,
            Shift.date >= datetime.combine(lookback_start, time.min),
            Shift.date < datetime.combine(reference_date, time.min)
        ).all()
        
        # Analyze patterns
        staff_performance = {}
        skill_demand = {}
        
        for assignment in historical_assignments:
            staff_id = assignment.staff_id
            shift = assignment.shift
            
            if staff_id not in staff_performance:
                staff_performance[staff_id] = {
                    "total_shifts": 0,
                    "no_shows": 0,
                    "late_arrivals": 0,
                    "skills_used": set()
                }
            
            staff_performance[staff_id]["total_shifts"] += 1
            staff_performance[staff_id]["skills_used"].add(shift.required_skill)
            
            if assignment.status == "no_show":
                staff_performance[staff_id]["no_shows"] += 1
            
            # Track skill demand
            skill = shift.required_skill
            if skill not in skill_demand:
                skill_demand[skill] = 0
            skill_demand[skill] += 1
        
        # Convert sets to lists for JSON serialization
        for staff_id in staff_performance:
            staff_performance[staff_id]["skills_used"] = list(
                staff_performance[staff_id]["skills_used"]
            )
        
        return {
            "staff_performance": staff_performance,
            "skill_demand": skill_demand,
            "total_historical_shifts": len(historical_assignments),
            "analysis_period_days": 30
        }
    
    async def _generate_schedule_summary(
        self,
        assignments: List[DraftShiftAssignment],
        shifts: List[Shift],
        staff: List[Staff],
        context: SchedulingContext
    ) -> Dict[str, Any]:
        """Generate summary and recommendations for the schedule"""
        
        # Basic statistics
        total_shifts = len(shifts)
        assigned_shifts = len(assignments)
        unassigned_shifts = total_shifts - assigned_shifts
        
        # Staff utilization
        staff_assignments = {}
        for assignment in assignments:
            if assignment.staff_id not in staff_assignments:
                staff_assignments[assignment.staff_id] = 0
            staff_assignments[assignment.staff_id] += 1
        
        # Skill coverage analysis
        skill_coverage = {}
        for shift in shifts:
            skill = shift.required_skill
            if skill not in skill_coverage:
                skill_coverage[skill] = {"required": 0, "assigned": 0}
            skill_coverage[skill]["required"] += 1
        
        for assignment in assignments:
            shift = next((s for s in shifts if s.id == assignment.shift_id), None)
            if shift:
                skill_coverage[shift.required_skill]["assigned"] += 1
        
        # Generate warnings and recommendations
        warnings = []
        recommendations = []
        
        if unassigned_shifts > 0:
            warnings.append(f"{unassigned_shifts} shifts remain unassigned")
        
        # Check for overworked staff
        avg_assignments = len(assignments) / len(staff) if staff else 0
        for staff_id, count in staff_assignments.items():
            if count > avg_assignments * 1.5:
                staff_member = next((s for s in staff if s.id == staff_id), None)
                if staff_member:
                    warnings.append(f"{staff_member.name} may be overworked ({count} shifts)")
        
        # Check skill coverage
        for skill, coverage in skill_coverage.items():
            coverage_rate = coverage["assigned"] / coverage["required"] if coverage["required"] > 0 else 0
            if coverage_rate < 0.8:
                warnings.append(f"Low coverage for {skill}: {coverage_rate:.1%}")
        
        # Generate AI-powered recommendations if available
        if self.ai_enabled:
            ai_recommendations = await self._get_ai_schedule_recommendations(
                assignments, shifts, staff, context
            )
            recommendations.extend(ai_recommendations)
        else:
            recommendations.append("Consider hiring more staff for better coverage")
            recommendations.append("Review staff availability preferences")
        
        return {
            "total_shifts": total_shifts,
            "assigned_shifts": assigned_shifts,
            "unassigned_shifts": unassigned_shifts,
            "staff_utilization": staff_assignments,
            "skill_coverage": skill_coverage,
            "warnings": warnings,
            "recommendations": recommendations,
            "generated_at": datetime.now().isoformat()
        }
    
    async def _get_ai_schedule_recommendations(
        self,
        assignments: List[DraftShiftAssignment],
        shifts: List[Shift],
        staff: List[Staff],
        context: SchedulingContext
    ) -> List[str]:
        """Get AI-powered recommendations for schedule improvement"""
        
        if not self.ai_enabled:
            return []
        
        # Prepare summary data for AI analysis
        summary_data = {
            "total_shifts": len(shifts),
            "assigned_shifts": len(assignments),
            "staff_count": len(staff),
            "avg_confidence": sum(a.confidence_score for a in assignments) / len(assignments) if assignments else 0
        }
        
        prompt = f"""
        Analyze this restaurant schedule and provide 3-5 specific recommendations for improvement:
        
        SCHEDULE SUMMARY:
        {json.dumps(summary_data, indent=2)}
        
        Consider:
        1. Staff workload distribution
        2. Skill coverage gaps
        3. Cost optimization opportunities
        4. Staff satisfaction factors
        5. Operational efficiency
        
        Provide practical, actionable recommendations that a restaurant manager can implement.
        Return as a JSON array of strings.
        """
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert restaurant operations consultant. Provide specific, actionable recommendations."
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=400,
                temperature=0.3
            )
            
            recommendations = json.loads(response.choices[0].message.content)
            return recommendations if isinstance(recommendations, list) else []
            
        except Exception as e:
            logger.error(f"AI recommendations failed: {str(e)}")
            return []
    
    def _calculate_overall_confidence(
        self, assignments: List[DraftShiftAssignment]
    ) -> float:
        """Calculate overall confidence score for the schedule"""
        
        if not assignments:
            return 0.0
        
        total_confidence = sum(assignment.confidence_score for assignment in assignments)
        return total_confidence / len(assignments)
    
    async def _build_context_from_draft(self, draft: ScheduleDraft) -> SchedulingContext:
        """Build scheduling context from existing draft"""
        
        # Get constraints
        constraints = self.db.query(SchedulingConstraint).filter(
            SchedulingConstraint.business_id == draft.business_id,
            SchedulingConstraint.is_active == True
        ).all()
        
        # Get staff preferences
        preferences = self.db.query(StaffPreference).filter(
            StaffPreference.is_active == True,
            StaffPreference.effective_date <= draft.date_range_end,
            (StaffPreference.expiry_date.is_(None) | 
             (StaffPreference.expiry_date >= draft.date_range_start))
        ).all()
        
        # Get existing assignments
        existing_assignments = draft.draft_assignments
        
        return SchedulingContext(
            business_id=draft.business_id,
            date_range_start=draft.date_range_start,
            date_range_end=draft.date_range_end,
            existing_assignments=existing_assignments,
            constraints=constraints,
            staff_preferences=preferences
        )
    
    async def _apply_ai_optimizations(
        self,
        assignments: List[DraftShiftAssignment],
        context: SchedulingContext,
        goals: List[str]
    ) -> List[DraftShiftAssignment]:
        """Apply AI-powered optimizations to existing assignments"""
        
        if not self.ai_enabled:
            return assignments
        
        # For now, return assignments as-is
        # This would be enhanced with specific optimization algorithms
        return assignments


class ReasoningEngine:
    """
    Engine for generating human-readable explanations for scheduling decisions
    """
    
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            self.client = openai.AsyncOpenAI(api_key=api_key)
        else:
            self.client = None
        self.model = "gpt-4-turbo"
    
    async def generate_assignment_reasoning(
        self,
        shift: Shift,
        staff: Staff,
        assignment: DraftShiftAssignment,
        context: SchedulingContext,
        ai_enabled: bool = True
    ) -> AssignmentReasoning:
        """Generate detailed reasoning for an assignment"""
        
        # Basic reasoning factors
        primary_reasons = []
        considerations = []
        risk_factors = []
        
        # Skill matching analysis
        staff_skills = staff.skills or []
        if shift.required_skill in staff_skills:
            primary_reasons.append(f"✓ Has required {shift.required_skill} skill")
            
            # Check skill level if available
            skill_level = self._get_skill_level(staff, shift.required_skill)
            if skill_level:
                considerations.append(f"Skill level: {skill_level}")
        else:
            risk_factors.append(f"⚠ Missing required {shift.required_skill} skill")
            
            # Check for related skills
            related_skills = self._find_related_skills(staff_skills, shift.required_skill)
            if related_skills:
                considerations.append(f"Has related skills: {', '.join(related_skills)}")
        
        # Availability analysis
        availability_score = self._analyze_availability(staff, shift)
        if availability_score >= 0.8:
            primary_reasons.append("✓ Excellent availability match")
        elif availability_score >= 0.6:
            considerations.append("Good availability with minor conflicts")
        else:
            risk_factors.append("⚠ Limited availability during shift hours")
        
        # Reliability and performance analysis
        if staff.reliability_score >= 8.0:
            primary_reasons.append(f"✓ Excellent reliability ({staff.reliability_score:.1f}/10)")
        elif staff.reliability_score >= 6.0:
            considerations.append(f"Good reliability score ({staff.reliability_score:.1f}/10)")
        else:
            risk_factors.append(f"⚠ Lower reliability score ({staff.reliability_score:.1f}/10)")
        
        # Workload distribution analysis
        workload_analysis = await self._analyze_workload_distribution(staff, context)
        if workload_analysis:
            if workload_analysis["is_balanced"]:
                considerations.append("Balanced workload distribution")
            else:
                risk_factors.append(f"Potential overwork: {workload_analysis['hours_this_week']} hours this week")
        
        # Cost efficiency analysis
        cost_analysis = self._analyze_cost_efficiency(staff, shift)
        if cost_analysis:
            considerations.append(f"Cost efficiency: {cost_analysis}")
        
        # Historical performance analysis
        historical_performance = await self._get_historical_performance(staff, shift, context)
        if historical_performance:
            if historical_performance["success_rate"] >= 0.9:
                primary_reasons.append(f"✓ Strong track record ({historical_performance['success_rate']:.0%} success rate)")
            elif historical_performance["success_rate"] >= 0.7:
                considerations.append(f"Good performance history ({historical_performance['success_rate']:.0%} success rate)")
            else:
                risk_factors.append(f"⚠ Mixed performance history ({historical_performance['success_rate']:.0%} success rate)")
        
        # AI-enhanced reasoning
        if ai_enabled and self.client:
            ai_reasoning = await self._get_ai_reasoning(
                shift, staff, assignment, context
            )
            if ai_reasoning:
                considerations.extend(ai_reasoning.get("considerations", []))
                risk_factors.extend(ai_reasoning.get("additional_risks", []))
        
        # Find alternatives
        alternatives = await self._find_assignment_alternatives(
            shift, context
        )
        
        return AssignmentReasoning(
            staff_id=staff.id,
            shift_id=shift.id,
            confidence_score=assignment.confidence_score,
            primary_reasons=primary_reasons,
            considerations=considerations,
            alternatives_considered=alternatives,
            risk_factors=risk_factors
        )
    
    def _get_skill_level(self, staff: Staff, skill: str) -> Optional[str]:
        """Get skill level for a specific skill"""
        # This would be enhanced with actual skill level data
        # For now, return based on reliability score as a proxy
        if staff.reliability_score >= 8.0:
            return "Expert"
        elif staff.reliability_score >= 6.0:
            return "Intermediate"
        else:
            return "Basic"
    
    def _find_related_skills(self, staff_skills: List[str], required_skill: str) -> List[str]:
        """Find related skills that might be relevant"""
        skill_relationships = {
            "kitchen": ["prep", "grill", "fryer"],
            "bar": ["cocktails", "wine", "beer"],
            "service": ["waiter", "host", "cashier"],
            "management": ["supervisor", "shift_lead", "assistant_manager"]
        }
        
        related = []
        for skill in staff_skills:
            if skill != required_skill:
                # Check if skills are in the same category
                for category, skills in skill_relationships.items():
                    if required_skill in skills and skill in skills:
                        related.append(skill)
        
        return related
    
    def _analyze_availability(self, staff: Staff, shift: Shift) -> float:
        """Analyze how well staff availability matches the shift"""
        if not staff.availability:
            return 0.5  # Neutral score if no availability data
        
        day_name = shift.date.strftime('%A').lower()
        if day_name not in staff.availability:
            return 0.2  # Low score if not available on this day
        
        # Check time overlap (simplified)
        # In practice, this would do proper time range analysis
        return 0.9  # High score for now
    
    async def _analyze_workload_distribution(
        self, staff: Staff, context: SchedulingContext
    ) -> Optional[Dict[str, Any]]:
        """Analyze staff workload for the scheduling period"""
        # Count existing assignments for this staff member
        existing_assignments = [
            a for a in context.existing_assignments 
            if a.staff_id == staff.id
        ]
        
        hours_this_week = len(existing_assignments) * 8  # Simplified calculation
        max_hours = 40  # Standard full-time hours
        
        return {
            "hours_this_week": hours_this_week,
            "max_hours": max_hours,
            "is_balanced": hours_this_week <= max_hours * 0.8
        }
    
    def _analyze_cost_efficiency(self, staff: Staff, shift: Shift) -> Optional[str]:
        """Analyze cost efficiency of the assignment"""
        if not hasattr(staff, 'hourly_rate') or not staff.hourly_rate:
            return None
        
        # Simple cost analysis
        if staff.hourly_rate <= 12:
            return "Cost-effective choice"
        elif staff.hourly_rate <= 18:
            return "Moderate cost"
        else:
            return "Higher cost but experienced"
    
    async def _get_historical_performance(
        self, staff: Staff, shift: Shift, context: SchedulingContext
    ) -> Optional[Dict[str, Any]]:
        """Get historical performance data for similar shifts"""
        # This would query actual historical data
        # For now, return simulated data based on reliability score
        if staff.reliability_score >= 7.0:
            return {"success_rate": 0.95, "similar_shifts": 15}
        elif staff.reliability_score >= 5.0:
            return {"success_rate": 0.80, "similar_shifts": 10}
        else:
            return {"success_rate": 0.65, "similar_shifts": 8}
    
    async def _get_ai_reasoning(
        self,
        shift: Shift,
        staff: Staff,
        assignment: DraftShiftAssignment,
        context: SchedulingContext
    ) -> Optional[Dict[str, Any]]:
        """Get AI-enhanced reasoning for assignment"""
        
        if not self.client:
            return None
        
        # Get additional context for AI analysis
        business_context = await self._get_business_context(context.business_id)
        
        prompt = f"""
        Analyze this restaurant staff assignment and provide additional insights:
        
        ASSIGNMENT:
        Staff: {staff.name} assigned to {shift.title}
        Date: {shift.date.strftime('%A, %B %d')}
        Time: {shift.start_time} - {shift.end_time}
        
        STAFF PROFILE:
        - Skills: {staff.skills or []}
        - Reliability: {staff.reliability_score}/10
        - Availability: {staff.availability or {}}
        
        SHIFT REQUIREMENTS:
        - Required skill: {shift.required_skill}
        - Staff needed: {shift.required_staff_count}
        
        BUSINESS CONTEXT:
        {json.dumps(business_context, indent=2)}
        
        Provide additional considerations and potential risks that a restaurant manager should be aware of.
        Focus on practical, actionable insights.
        
        Return JSON format:
        {{
            "considerations": ["insight 1", "insight 2"],
            "additional_risks": ["risk 1", "risk 2"],
            "optimization_suggestions": ["suggestion 1", "suggestion 2"]
        }}
        """
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert restaurant operations analyst. Provide specific, actionable insights for staff scheduling decisions."
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=400,
                temperature=0.3
            )
            
            return json.loads(response.choices[0].message.content)
            
        except Exception as e:
            logger.error(f"AI reasoning failed: {str(e)}")
            return None
    
    async def _get_business_context(self, business_id: int) -> Dict[str, Any]:
        """Get relevant business context for AI analysis"""
        # This would fetch actual business data
        # For now, return simulated context
        return {
            "business_type": "restaurant",
            "peak_hours": ["12:00-14:00", "18:00-21:00"],
            "staff_count": 25,
            "average_shift_length": 8
        }
    
    async def _find_assignment_alternatives(
        self,
        shift: Shift,
        context: SchedulingContext
    ) -> List[Dict[str, Any]]:
        """Find alternative staff assignments for a shift"""
        
        # This would analyze all available staff and rank them
        # For now, return simulated alternatives
        alternatives = []
        
        # Simulate finding 2-3 alternatives
        for i in range(2):
            alternatives.append({
                "staff_id": i + 100,  # Placeholder IDs
                "score": 0.8 - (i * 0.1),
                "reason": f"Alternative option #{i+1} with good qualifications",
                "pros": ["Available", "Has required skills"],
                "cons": ["Less experience", "Higher cost"] if i > 0 else ["Slightly lower reliability"]
            })
        
        return alternatives
    
    def generate_confidence_explanation(self, confidence_score: float) -> str:
        """Generate human-readable explanation for confidence score"""
        if confidence_score >= 0.9:
            return "Excellent match - highly confident in this assignment"
        elif confidence_score >= 0.8:
            return "Very good match - confident in this assignment"
        elif confidence_score >= 0.7:
            return "Good match - reasonably confident in this assignment"
        elif confidence_score >= 0.6:
            return "Acceptable match - some concerns but workable"
        elif confidence_score >= 0.5:
            return "Marginal match - significant concerns to consider"
        else:
            return "Poor match - high risk assignment, consider alternatives"
    
    def get_confidence_color_class(self, confidence_score: float) -> str:
        """Get CSS color class for confidence score visualization"""
        if confidence_score >= 0.8:
            return "text-green-600 bg-green-100"
        elif confidence_score >= 0.6:
            return "text-amber-600 bg-amber-100"
        else:
            return "text-red-600 bg-red-100"