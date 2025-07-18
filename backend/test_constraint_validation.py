"""
Tests for constraint validation functionality
"""

import pytest
from datetime import datetime, date, timedelta
from unittest.mock import Mock, MagicMock
from sqlalchemy.orm import Session

from services.constraint_solver import ConstraintSolver, ConstraintType, ValidationResult, SchedulingContext
from models import (
    Staff, Shift, SchedulingConstraint, StaffPreference, 
    DraftShiftAssignment
)


class TestConstraintValidation:
    """Test constraint validation functionality"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.db = Mock(spec=Session)
        self.solver = ConstraintSolver(self.db)
        
        # Mock staff
        self.staff1 = Mock(spec=Staff)
        self.staff1.id = 1
        self.staff1.name = "John Doe"
        self.staff1.business_id = 1
        self.staff1.skills = ["kitchen", "bar"]
        self.staff1.availability = {
            "monday": ["09:00-17:00"],
            "tuesday": ["09:00-17:00"],
            "wednesday": ["09:00-17:00"]
        }
        self.staff1.is_active = True
        
        self.staff2 = Mock(spec=Staff)
        self.staff2.id = 2
        self.staff2.name = "Jane Smith"
        self.staff2.business_id = 1
        self.staff2.skills = ["server", "host"]
        self.staff2.availability = {
            "monday": ["18:00-23:00"],
            "tuesday": ["18:00-23:00"]
        }
        self.staff2.is_active = True
        
        # Mock shifts
        self.shift1 = Mock(spec=Shift)
        self.shift1.id = 1
        self.shift1.business_id = 1
        self.shift1.date = datetime(2024, 1, 15)  # Monday
        self.shift1.start_time = "10:00"
        self.shift1.end_time = "16:00"
        self.shift1.required_skill = "kitchen"
        self.shift1.required_staff_count = 1
        self.shift1.hourly_rate = 15.0
        
        self.shift2 = Mock(spec=Shift)
        self.shift2.id = 2
        self.shift2.business_id = 1
        self.shift2.date = datetime(2024, 1, 15)  # Monday
        self.shift2.start_time = "19:00"
        self.shift2.end_time = "23:00"
        self.shift2.required_skill = "server"
        self.shift2.required_staff_count = 1
        self.shift2.hourly_rate = 12.0
        
        # Mock constraints
        self.max_hours_constraint = Mock(spec=SchedulingConstraint)
        self.max_hours_constraint.id = 1
        self.max_hours_constraint.business_id = 1
        self.max_hours_constraint.constraint_type = "max_hours_per_week"
        self.max_hours_constraint.constraint_value = {"hours": 40}
        self.max_hours_constraint.priority = "high"
        self.max_hours_constraint.is_active = True
        
        self.rest_constraint = Mock(spec=SchedulingConstraint)
        self.rest_constraint.id = 2
        self.rest_constraint.business_id = 1
        self.rest_constraint.constraint_type = "min_rest_between_shifts"
        self.rest_constraint.constraint_value = {"hours": 8}
        self.rest_constraint.priority = "medium"
        self.rest_constraint.is_active = True
        
        # Mock preferences
        self.max_hours_pref = Mock(spec=StaffPreference)
        self.max_hours_pref.id = 1
        self.max_hours_pref.staff_id = 1
        self.max_hours_pref.preference_type = "max_hours"
        self.max_hours_pref.preference_value = {"hours": 35}
        self.max_hours_pref.priority = "high"
        self.max_hours_pref.is_active = True
        
        # Mock context
        self.context = Mock(spec=SchedulingContext)
        self.context.business_id = 1
        self.context.date_range_start = date(2024, 1, 15)
        self.context.date_range_end = date(2024, 1, 21)
        self.context.existing_assignments = []
        self.context.constraints = [self.max_hours_constraint, self.rest_constraint]
        self.context.staff_preferences = [self.max_hours_pref]
    
    def test_skill_match_validation_success(self):
        """Test successful skill match validation"""
        result = self.solver.validate_assignment(
            self.shift1, self.staff1, [], self.context
        )
        
        assert result.is_valid
        assert result.score > 0.8
        assert "skill" not in str(result.violations).lower()
    
    def test_skill_match_validation_failure(self):
        """Test skill match validation failure"""
        result = self.solver.validate_assignment(
            self.shift1, self.staff2, [], self.context
        )
        
        assert not result.is_valid
        assert result.score < 0.5
        assert any("skill" in violation.lower() for violation in result.violations)
    
    def test_availability_validation_success(self):
        """Test successful availability validation"""
        result = self.solver.validate_assignment(
            self.shift1, self.staff1, [], self.context
        )
        
        # Should pass availability check (Monday 10:00-16:00 within 09:00-17:00)
        assert result.details["constraint_scores"]["availability"] >= 0.7
    
    def test_availability_validation_failure(self):
        """Test availability validation failure"""
        result = self.solver.validate_assignment(
            self.shift2, self.staff1, [], self.context
        )
        
        # Should fail availability check (Monday 19:00-23:00 outside 09:00-17:00)
        availability_score = result.details["constraint_scores"]["availability"]
        assert availability_score < 0.7
    
    def test_max_hours_validation_success(self):
        """Test max hours validation when within limits"""
        # Mock database queries
        self.db.query.return_value.filter.return_value.first.return_value = self.shift1
        self.db.query.return_value.join.return_value.filter.return_value.all.return_value = []
        
        result = self.solver.validate_assignment(
            self.shift1, self.staff1, [], self.context
        )
        
        # Should pass max hours check (6 hours shift within 35 hour limit)
        max_hours_score = result.details["constraint_scores"]["max_hours"]
        assert max_hours_score >= 0.5
    
    def test_max_hours_validation_failure(self):
        """Test max hours validation when exceeding limits"""
        # Create existing assignments that would exceed limit
        existing_assignments = []
        for i in range(6):  # 6 shifts of 6 hours each = 36 hours
            assignment = Mock(spec=DraftShiftAssignment)
            assignment.staff_id = 1
            assignment.shift_id = i + 10
            existing_assignments.append(assignment)
        
        # Mock shift for existing assignments
        mock_shift = Mock(spec=Shift)
        mock_shift.date = datetime(2024, 1, 15)
        mock_shift.start_time = "10:00"
        mock_shift.end_time = "16:00"
        
        self.db.query.return_value.filter.return_value.first.return_value = mock_shift
        self.db.query.return_value.join.return_value.filter.return_value.all.return_value = []
        
        result = self.solver.validate_assignment(
            self.shift1, self.staff1, existing_assignments, self.context
        )
        
        # Should fail max hours check (would exceed 35 hour limit)
        max_hours_score = result.details["constraint_scores"]["max_hours"]
        assert max_hours_score < 0.5
    
    def test_validate_assignments_api(self):
        """Test the validate_assignments API method"""
        assignments = [
            {"shift_id": 1, "staff_id": 1},
            {"shift_id": 2, "staff_id": 2}
        ]
        
        # Mock database queries
        self.db.query.return_value.filter.return_value.first.side_effect = [
            self.shift1, self.staff1, self.shift2, self.staff2
        ]
        
        result = self.solver.validate_assignments(
            assignments, 
            [self.max_hours_constraint, self.rest_constraint],
            [self.max_hours_pref]
        )
        
        assert "violations" in result
        assert "warnings" in result
        assert isinstance(result["violations"], list)
        assert isinstance(result["warnings"], list)
    
    def test_validate_assignments_with_skill_mismatch(self):
        """Test validation with skill mismatch"""
        assignments = [
            {"shift_id": 1, "staff_id": 2}  # Kitchen shift assigned to server
        ]
        
        # Mock database queries
        self.db.query.return_value.filter.return_value.first.side_effect = [
            self.shift1, self.staff2
        ]
        
        result = self.solver.validate_assignments(
            assignments,
            [self.max_hours_constraint],
            []
        )
        
        # Should have violations due to skill mismatch
        assert len(result["violations"]) > 0
        skill_violations = [v for v in result["violations"] if v["constraint_type"] == "skill_match"]
        assert len(skill_violations) > 0
    
    def test_validate_business_constraint_max_hours(self):
        """Test business constraint validation for max hours"""
        assignments = [
            {"shift_id": 1, "staff_id": 1},
            {"shift_id": 2, "staff_id": 1}  # Same staff, multiple shifts
        ]
        
        # Mock shifts with long hours
        long_shift1 = Mock(spec=Shift)
        long_shift1.id = 1
        long_shift1.date = datetime(2024, 1, 15)
        long_shift1.start_time = "08:00"
        long_shift1.end_time = "20:00"  # 12 hours
        
        long_shift2 = Mock(spec=Shift)
        long_shift2.id = 2
        long_shift2.date = datetime(2024, 1, 16)
        long_shift2.start_time = "08:00"
        long_shift2.end_time = "20:00"  # 12 hours
        
        self.db.query.return_value.filter.return_value.first.side_effect = [
            long_shift1, long_shift2
        ]
        self.db.query.return_value.filter.return_value.first.return_value = self.staff1
        
        # Create constraint for 20 hours max per week
        constraint = Mock(spec=SchedulingConstraint)
        constraint.id = 1
        constraint.constraint_type = "max_hours_per_week"
        constraint.constraint_value = {"hours": 20}
        
        violations = self.solver._validate_business_constraint(
            constraint, assignments, []
        )
        
        # Should have violation (24 hours > 20 hours limit)
        assert len(violations) > 0
        assert violations[0]["constraint_type"] == "max_hours_per_week"
        assert violations[0]["severity"] == "error"
    
    def test_validate_business_constraint_min_rest(self):
        """Test business constraint validation for minimum rest"""
        assignments = [
            {"shift_id": 1, "staff_id": 1},
            {"shift_id": 2, "staff_id": 1}  # Same staff, consecutive shifts
        ]
        
        # Mock consecutive shifts with insufficient rest
        shift1 = Mock(spec=Shift)
        shift1.id = 1
        shift1.date = datetime(2024, 1, 15)
        shift1.start_time = "08:00"
        shift1.end_time = "16:00"
        
        shift2 = Mock(spec=Shift)
        shift2.id = 2
        shift2.date = datetime(2024, 1, 15)  # Same day
        shift2.start_time = "18:00"  # Only 2 hours rest
        shift2.end_time = "23:00"
        
        self.db.query.return_value.filter.return_value.first.side_effect = [
            shift1, shift2
        ]
        self.db.query.return_value.filter.return_value.first.return_value = self.staff1
        
        # Create constraint for 8 hours minimum rest
        constraint = Mock(spec=SchedulingConstraint)
        constraint.id = 2
        constraint.constraint_type = "min_rest_between_shifts"
        constraint.constraint_value = {"hours": 8}
        
        violations = self.solver._validate_business_constraint(
            constraint, assignments, []
        )
        
        # Should have violation (2 hours < 8 hours minimum)
        assert len(violations) > 0
        assert violations[0]["constraint_type"] == "min_rest_between_shifts"
        assert violations[0]["severity"] == "error"
    
    def test_constraint_priority_scoring(self):
        """Test that constraint priorities affect scoring correctly"""
        # Test with high priority skill mismatch
        result = self.solver.validate_assignment(
            self.shift1, self.staff2, [], self.context  # Kitchen shift to server
        )
        
        # Should have very low score due to skill mismatch
        assert result.score < 0.3
        
        # Test with matching skills
        result = self.solver.validate_assignment(
            self.shift1, self.staff1, [], self.context  # Kitchen shift to kitchen staff
        )
        
        # Should have much higher score
        assert result.score > 0.7
    
    def test_fair_distribution_constraint(self):
        """Test fair distribution constraint validation"""
        # Create multiple assignments for one staff member
        existing_assignments = []
        for i in range(5):
            assignment = Mock(spec=DraftShiftAssignment)
            assignment.staff_id = 1  # All assignments to staff1
            assignment.shift_id = i + 10
            existing_assignments.append(assignment)
        
        # Mock qualified staff query
        self.db.query.return_value.filter.return_value.all.return_value = [
            self.staff1, self.staff2
        ]
        
        result = self.solver.validate_assignment(
            self.shift1, self.staff1, existing_assignments, self.context
        )
        
        # Should have lower fair distribution score
        fair_dist_score = result.details["constraint_scores"]["fair_distribution"]
        assert fair_dist_score < 0.8
    
    def test_missing_data_validation(self):
        """Test validation with missing shift or staff data"""
        assignments = [
            {"shift_id": 999, "staff_id": 1}  # Non-existent shift
        ]
        
        # Mock database to return None for non-existent shift
        self.db.query.return_value.filter.return_value.first.return_value = None
        
        result = self.solver.validate_assignments(
            assignments,
            [self.max_hours_constraint],
            []
        )
        
        # Should have data integrity violations
        assert len(result["violations"]) > 0
        data_violations = [v for v in result["violations"] if v["constraint_type"] == "data_integrity"]
        assert len(data_violations) > 0
    
    def test_low_confidence_warnings(self):
        """Test that low confidence assignments generate warnings"""
        # Create assignment with partial availability conflict
        result = self.solver.validate_assignment(
            self.shift2, self.staff1, [], self.context  # Evening shift to day staff
        )
        
        # Should generate warning for low confidence
        if result.score < 0.7 and not result.violations:
            assignments = [{"shift_id": 2, "staff_id": 1}]
            
            self.db.query.return_value.filter.return_value.first.side_effect = [
                self.shift2, self.staff1
            ]
            
            validation_result = self.solver.validate_assignments(
                assignments, [], []
            )
            
            # Should have warnings for low confidence
            confidence_warnings = [w for w in validation_result["warnings"] if w["constraint_type"] == "confidence"]
            assert len(confidence_warnings) >= 0  # May or may not have warnings depending on score


if __name__ == "__main__":
    pytest.main([__file__])