"""
API endpoints for constraint validation functionality
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime, date

from database import get_db
from models import SchedulingConstraint, StaffPreference, Staff, Shift
from schemas import (
    ConstraintValidationRequest, ConstraintValidationResponse,
    ConstraintViolation, SchedulingConstraintCreate, SchedulingConstraintUpdate,
    SchedulingConstraintResponse, StaffPreferenceCreate, StaffPreferenceUpdate,
    StaffPreferenceResponse
)
from services.constraint_solver import ConstraintSolver

router = APIRouter(prefix="/api/constraints", tags=["constraint-validation"])


@router.post("/validate", response_model=ConstraintValidationResponse)
async def validate_assignments(
    request: ConstraintValidationRequest,
    db: Session = Depends(get_db)
):
    """
    Validate a set of assignments against business constraints
    """
    try:
        # Get business constraints
        constraints = db.query(SchedulingConstraint).filter(
            SchedulingConstraint.business_id == request.business_id,
            SchedulingConstraint.is_active == True
        ).all()
        
        # Get staff preferences
        preferences = db.query(StaffPreference).filter(
            StaffPreference.is_active == True
        ).all()
        
        # Initialize constraint solver
        solver = ConstraintSolver(db)
        
        # Validate assignments
        result = solver.validate_assignments(
            request.assignments, constraints, preferences
        )
        
        return ConstraintValidationResponse(
            valid=len(result["violations"]) == 0,
            violations=[ConstraintViolation(**v) for v in result["violations"]],
            warnings=[ConstraintViolation(**w) for w in result["warnings"]],
            total_violations=len(result["violations"]),
            total_warnings=len(result["warnings"])
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Validation failed: {str(e)}"
        )


@router.post("/validate-assignment")
async def validate_single_assignment(
    shift_id: int,
    staff_id: int,
    business_id: int,
    existing_assignments: Optional[List[Dict[str, Any]]] = None,
    db: Session = Depends(get_db)
):
    """
    Real-time validation for a single assignment change
    """
    try:
        solver = ConstraintSolver(db)
        
        result = solver.validate_real_time_assignment(
            shift_id=shift_id,
            staff_id=staff_id,
            business_id=business_id,
            existing_assignments=existing_assignments or []
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Real-time validation failed: {str(e)}"
        )


@router.get("/violations-summary/{business_id}")
async def get_violations_summary(
    business_id: int,
    assignments: List[Dict[str, Any]],
    db: Session = Depends(get_db)
):
    """
    Get a summary of constraint violations for a business
    """
    try:
        solver = ConstraintSolver(db)
        
        summary = solver.get_constraint_violations_summary(
            business_id=business_id,
            assignments=assignments
        )
        
        return summary
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate violations summary: {str(e)}"
        )


# Business Constraints Management
@router.get("/business/{business_id}", response_model=List[SchedulingConstraintResponse])
async def get_business_constraints(
    business_id: int,
    db: Session = Depends(get_db)
):
    """
    Get all scheduling constraints for a business
    """
    constraints = db.query(SchedulingConstraint).filter(
        SchedulingConstraint.business_id == business_id
    ).all()
    
    return constraints


@router.post("/business/{business_id}", response_model=SchedulingConstraintResponse)
async def create_business_constraint(
    business_id: int,
    constraint: SchedulingConstraintCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new scheduling constraint for a business
    """
    try:
        db_constraint = SchedulingConstraint(
            business_id=business_id,
            constraint_type=constraint.constraint_type,
            constraint_value=constraint.constraint_value,
            priority=constraint.priority,
            is_active=True
        )
        
        db.add(db_constraint)
        db.commit()
        db.refresh(db_constraint)
        
        return db_constraint
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create constraint: {str(e)}"
        )


@router.put("/business/{business_id}/{constraint_id}", response_model=SchedulingConstraintResponse)
async def update_business_constraint(
    business_id: int,
    constraint_id: int,
    updates: SchedulingConstraintUpdate,
    db: Session = Depends(get_db)
):
    """
    Update a scheduling constraint
    """
    constraint = db.query(SchedulingConstraint).filter(
        SchedulingConstraint.id == constraint_id,
        SchedulingConstraint.business_id == business_id
    ).first()
    
    if not constraint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Constraint not found"
        )
    
    try:
        # Update fields
        if updates.constraint_value is not None:
            constraint.constraint_value = updates.constraint_value
        if updates.priority is not None:
            constraint.priority = updates.priority
        if updates.is_active is not None:
            constraint.is_active = updates.is_active
        
        db.commit()
        db.refresh(constraint)
        
        return constraint
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update constraint: {str(e)}"
        )


@router.delete("/business/{business_id}/{constraint_id}")
async def delete_business_constraint(
    business_id: int,
    constraint_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a scheduling constraint
    """
    constraint = db.query(SchedulingConstraint).filter(
        SchedulingConstraint.id == constraint_id,
        SchedulingConstraint.business_id == business_id
    ).first()
    
    if not constraint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Constraint not found"
        )
    
    try:
        db.delete(constraint)
        db.commit()
        
        return {"message": "Constraint deleted successfully"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete constraint: {str(e)}"
        )


# Staff Preferences Management
@router.get("/staff/{staff_id}/preferences", response_model=List[StaffPreferenceResponse])
async def get_staff_preferences(
    staff_id: int,
    db: Session = Depends(get_db)
):
    """
    Get all preferences for a staff member
    """
    preferences = db.query(StaffPreference).filter(
        StaffPreference.staff_id == staff_id
    ).all()
    
    # Add staff name to response
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    staff_name = staff.name if staff else f"Staff {staff_id}"
    
    for pref in preferences:
        pref.staff_name = staff_name
    
    return preferences


@router.post("/staff/{staff_id}/preferences", response_model=StaffPreferenceResponse)
async def create_staff_preference(
    staff_id: int,
    preference: StaffPreferenceCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new staff preference
    """
    # Verify staff exists
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found"
        )
    
    try:
        db_preference = StaffPreference(
            staff_id=staff_id,
            preference_type=preference.preference_type,
            preference_value=preference.preference_value,
            priority=preference.priority,
            effective_date=datetime.strptime(preference.effective_date, '%Y-%m-%d').date() if preference.effective_date else None,
            expiry_date=datetime.strptime(preference.expiry_date, '%Y-%m-%d').date() if preference.expiry_date else None,
            is_active=True
        )
        
        db.add(db_preference)
        db.commit()
        db.refresh(db_preference)
        
        # Add staff name for response
        db_preference.staff_name = staff.name
        
        return db_preference
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create preference: {str(e)}"
        )


@router.put("/staff/{staff_id}/preferences/{preference_id}", response_model=StaffPreferenceResponse)
async def update_staff_preference(
    staff_id: int,
    preference_id: int,
    updates: StaffPreferenceUpdate,
    db: Session = Depends(get_db)
):
    """
    Update a staff preference
    """
    preference = db.query(StaffPreference).filter(
        StaffPreference.id == preference_id,
        StaffPreference.staff_id == staff_id
    ).first()
    
    if not preference:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preference not found"
        )
    
    try:
        # Update fields
        if updates.preference_value is not None:
            preference.preference_value = updates.preference_value
        if updates.priority is not None:
            preference.priority = updates.priority
        if updates.effective_date is not None:
            preference.effective_date = datetime.strptime(updates.effective_date, '%Y-%m-%d').date()
        if updates.expiry_date is not None:
            preference.expiry_date = datetime.strptime(updates.expiry_date, '%Y-%m-%d').date()
        if updates.is_active is not None:
            preference.is_active = updates.is_active
        
        db.commit()
        db.refresh(preference)
        
        # Add staff name for response
        staff = db.query(Staff).filter(Staff.id == staff_id).first()
        preference.staff_name = staff.name if staff else f"Staff {staff_id}"
        
        return preference
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update preference: {str(e)}"
        )


@router.delete("/staff/{staff_id}/preferences/{preference_id}")
async def delete_staff_preference(
    staff_id: int,
    preference_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a staff preference
    """
    preference = db.query(StaffPreference).filter(
        StaffPreference.id == preference_id,
        StaffPreference.staff_id == staff_id
    ).first()
    
    if not preference:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preference not found"
        )
    
    try:
        db.delete(preference)
        db.commit()
        
        return {"message": "Preference deleted successfully"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete preference: {str(e)}"
        )


@router.get("/check-conflicts/{business_id}")
async def check_preference_conflicts(
    business_id: int,
    db: Session = Depends(get_db)
):
    """
    Check for conflicts between staff preferences and business constraints
    """
    try:
        # Get business constraints
        constraints = db.query(SchedulingConstraint).filter(
            SchedulingConstraint.business_id == business_id,
            SchedulingConstraint.is_active == True
        ).all()
        
        # Get all staff preferences for this business
        staff_ids = db.query(Staff.id).filter(
            Staff.business_id == business_id,
            Staff.is_active == True
        ).all()
        
        preferences = db.query(StaffPreference).filter(
            StaffPreference.staff_id.in_([s.id for s in staff_ids]),
            StaffPreference.is_active == True
        ).all()
        
        conflicts = []
        suggestions = []
        
        # Check for conflicts between constraints and preferences
        for constraint in constraints:
            if constraint.constraint_type == "max_hours_per_week":
                max_hours = constraint.constraint_value.get("hours", 40)
                
                # Check if any staff preferences exceed this
                for pref in preferences:
                    if (pref.preference_type == "max_hours" and 
                        pref.preference_value.get("hours", 0) > max_hours):
                        
                        staff = db.query(Staff).filter(Staff.id == pref.staff_id).first()
                        conflicts.append({
                            "type": "hours_conflict",
                            "message": f"{staff.name if staff else 'Staff'} prefers {pref.preference_value['hours']}h but business limit is {max_hours}h",
                            "staff_id": pref.staff_id,
                            "constraint_id": constraint.id,
                            "preference_id": pref.id
                        })
            
            elif constraint.constraint_type == "min_rest_between_shifts":
                min_rest = constraint.constraint_value.get("hours", 8)
                
                # Check for preferences that might conflict with rest requirements
                for pref in preferences:
                    if pref.preference_type == "consecutive_shifts":
                        consecutive_count = pref.preference_value.get("max_consecutive", 0)
                        if consecutive_count > 3:  # Arbitrary threshold
                            staff = db.query(Staff).filter(Staff.id == pref.staff_id).first()
                            suggestions.append({
                                "type": "rest_concern",
                                "message": f"{staff.name if staff else 'Staff'} prefers {consecutive_count} consecutive shifts - monitor rest periods",
                                "staff_id": pref.staff_id,
                                "constraint_id": constraint.id,
                                "preference_id": pref.id
                            })
        
        return {
            "has_conflicts": len(conflicts) > 0,
            "conflicts": conflicts,
            "suggestions": suggestions
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check conflicts: {str(e)}"
        )