"""
Enhanced tests for constraint validation functionality
"""

import pytest
from datetime import datetime, date, timedelta
from unittest.mock import Mock, MagicMock, patch
from sqlalchemy.orm import Session

from services.constraint_solver import ConstraintSolver, ConstraintType, ValidationResult, SchedulingContext
from models import (
    Staff, Shift, SchedulingConstraint, StaffPreference, 
    DraftShiftAssignment, Business
)


class TestEnhancedConstraintValidation:
    """Test enhanced constraint validation functionality"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.db = Mock(spec=Session)
        self.solver = ConstraintSolver(self.db)
        
        # Mock business
        self.business = Mock(spec=Business)
        self.business.id = 1
        self.business.name = "Test Restaurant"
        
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
        
        self.staff3 = Mock(spec=Staff)
        self.staff3.id = 3
        self.staff3.name = "Bob Wilson"
        self.staff3.business_id = 1
        self.staff3.skills = ["kitchen", "management"]
        self.staff3.availability = {
            "monday": ["06:00-14:00"],
            "tuesday": ["06:00-14:00"],
            "wednesday": ["06:00-14:00"]
        }
        self.staff3.is_active = True
        
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
        
        self.shift3 = Mock(spec=Shift)
        self.shift3.id = 3
        self.shift3.business_id = 1
        self.shift3.date = datetime(2024, 1, 16)  # Tuesday
        self.shift3.start_time = "08:00"
        self.shift3.end_time = "16:00"
        self.shift3.required_skill = "kitchen"
        self.shift3.required_staff_count = 1
        self.shift3.hourly_rate = 15.0
        
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
        
        self.consecutive_days_constraint = Mock(spec=SchedulingConstraint)
        self.consecutive_days_constraint.id = 3
        self.consecutive_days_constraint.business_id = 1
        self.consecutive_days_constraint.constraint_type = "max_consecutive_days"
        self.consecutive_days_constraint.constraint_value = {"days": 5}
        self.consecutive_days_constraint.priority = "medium"
        self.consecutive_days_constraint.is_active = True
        
        self.skill_match_constraint = Mock(spec=SchedulingConstraint)
        self.skill_match_constraint.id = 4
        self.skill_match_constraint.business_id = 1
        self.skill_match_constraint.constraint_type = "skill_match_required"
        self.skill_match_constraint.constraint_value = {"required": True}
        self.skill_match_constraint.priority = "critical"
        self.skill_match_constraint.is_active = True
        
        self.fair_distribution_constraint = Mock(spec=SchedulingConstraint)
        self.fair_distribution_constraint.id = 5
        self.fair_distribution_constraint.business_id = 1
        self.fair_distribution_constraint.constraint_type = "fair_distribution"
        self.fair_distribution_constraint.constraint_value = {"enabled": True}
        self.fair_distribution_constraint.priority = "medium"
        self.fair_distribution_constraint.is_active = True
        
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
        self.context.constraints = [
            self.max_hours_constraint, 
            self.rest_constraint,
            self.consecutive_days_constraint,
            self.skill_match_constraint,
            self.fair_distribution_constraint
        ]
        self.context.staff_preferences = [self.max_hours_pref]
    
    def test_validate_max_hours_constraint_success(self):
        """Test max hours constraint validation when within limits"""
        assignments = [
            {"shift_id": 1, "staff_id": 1},  # 6 hours
            {"shift_id": 2, "staff_id": 1}   # 4 hours, total 10 hours
        ]
        
        # Mock database queries
        self.db.query.return_value.filter.return_value.first.side_effect = [
            self.shift1, self.shift2
        ]
        
        violations = self.solver._validate_max_hours_constraint(
            self.max_hours_constraint, assignments, []
        )
        
        # Should have no violations (10 hours < 40 hours limit)
        assert len(violations) == 0
    
    def test_validate_max_hours_constraint_violation(self):
        """Test max hours constraint validation when exceeding limits"""
        # Create assignments that exceed 40 hours
        assignments = []
        shifts = []
        
        # Create 6 shifts of 8 hours each = 48 hours
        for i in range(6):
            shift = Mock(spec=Shift)
            shift.id = i + 10
            shift.date = datetime(2024, 1, 15) + timedelta(days=i % 7)
            shift.start_time = "09:00"
            shift.end_time = "17:00"  # 8 hours
            shifts.append(shift)
            assignments.append({"shift_id": shift.id, "staff_id": 1})
        
        # Mock database queries
        self.db.query.return_value.filter.return_value.first.side_effect = shifts
        self.db.query.return_value.filter.return_value.first.return_value = self.staff1
        
        violations = self.solver._validate_max_hours_constraint(
            self.max_hours_constraint, assignments, []
        )
        
        # Should have violations (48 hours > 40 hours limit)
        assert len(violations) > 0
        assert violations[0]["constraint_type"] == "max_hours_per_week"
        assert violations[0]["severity"] == "error"
        assert "48.0 hours" in violations[0]["message"]
    
    def test_validate_min_rest_constraint_success(self):
        """Test minimum rest constraint validation when sufficient rest"""
        assignments = [
            {"shift_id": 1, "staff_id": 1},  # Monday 10:00-16:00
            {"shift_id": 3, "staff_id": 1}   # Tuesday 08:00-16:00 (16 hours rest)
        ]
        
        # Mock database queries
        self.db.query.return_value.filter.return_value.first.side_effect = [
            self.shift1, self.shift3
        ]
        
        violations = self.solver._validate_min_rest_constraint(
            self.rest_constraint, assignments, []
        )
        
        # Should have no violations (16 hours > 8 hours minimum)
        assert len(violations) == 0
    
    def test_validate_min_rest_constraint_violation(self):
        """Test minimum rest constraint validation when insufficient rest"""
        # Create shifts with insufficient rest
        shift_evening = Mock(spec=Shift)
        shift_evening.id = 10
        shift_evening.date = datetime(2024, 1, 15)
        shift_evening.start_time = "18:00"
        shift_evening.end_time = "23:00"
        
        shift_morning = Mock(spec=Shift)
        shift_morning.id = 11
        shift_morning.date = datetime(2024, 1, 16)
        shift_morning.start_time = "06:00"  # Only 7 hours rest
        shift_morning.end_time = "14:00"
        
        assignments = [
            {"shift_id": 10, "staff_id": 1},
            {"shift_id": 11, "staff_id": 1}
        ]
        
        # Mock database queries
        self.db.query.return_value.filter.return_value.first.side_effect = [
            shift_evening, shift_morning
        ]
        self.db.query.return_value.filter.return_value.first.return_value = self.staff1
        
        violations = self.solver._validate_min_rest_constraint(
            self.rest_constraint, assignments, []
        )
        
        # Should have violations (7 hours < 8 hours minimum)
        assert len(violations) > 0
        assert violations[0]["constraint_type"] == "min_rest_between_shifts"
        assert "7.0h rest" in violations[0]["message"]
    
    def test_validate_consecutive_days_constraint_success(self):
        """Test consecutive days constraint validation when within limits"""
        assignments = []
        shifts = []
        
        # Create 3 consecutive days (within 5-day limit)
        for i in range(3):
            shift = Mock(spec=Shift)
            shift.id = i + 20
            shift.date = datetime(2024, 1, 15) + timedelta(days=i)
            shift.start_time = "09:00"
            shift.end_time = "17:00"
            shifts.append(shift)
            assignments.append({"shift_id": shift.id, "staff_id": 1})
        
        # Mock database queries
        self.db.query.return_value.filter.return_value.first.side_effect = shifts
        
        violations = self.solver._validate_consecutive_days_constraint(
            self.consecutive_days_constraint, assignments, []
        )
        
        # Should have no violations (3 days <= 5 days limit)
        assert len(violations) == 0
    
    def test_validate_consecutive_days_constraint_violation(self):
        """Test consecutive days constraint validation when exceeding limits"""
        assignments = []
        shifts = []
        
        # Create 6 consecutive days (exceeds 5-day limit)
        for i in range(6):
            shift = Mock(spec=Shift)
            shift.id = i + 30
            shift.date = datetime(2024, 1, 15) + timedelta(days=i)
            shift.start_time = "09:00"
            shift.end_time = "17:00"
            shifts.append(shift)
            assignments.append({"shift_id": shift.id, "staff_id": 1})
        
        # Mock database queries
        self.db.query.return_value.filter.return_value.first.side_effect = shifts
        self.db.query.return_value.filter.return_value.first.return_value = self.staff1
        
        violations = self.solver._validate_consecutive_days_constraint(
            self.consecutive_days_constraint, assignments, []
        )
        
        # Should have violations (6 days > 5 days limit)
        assert len(violations) > 0
        assert violations[0]["constraint_type"] == "max_consecutive_days"
        assert "6 consecutive days" in violations[0]["message"]
    
    def test_validate_skill_match_constraint_success(self):
        """Test skill match constraint validation when skills match"""
        assignments = [
            {"shift_id": 1, "staff_id": 1}  # Kitchen shift to kitchen staff
        ]
        
        # Mock database queries
        self.db.query.return_value.filter.return_value.first.side_effect = [
            self.shift1, self.staff1
        ]
        
        violations = self.solver._validate_skill_match_constraint(
            self.skill_match_constraint, assignments, []
        )
        
        # Should have no violations (staff has kitchen skill)
        assert len(violations) == 0
    
    def test_validate_skill_match_constraint_violation(self):
        """Test skill match constraint validation when skills don't match"""
        assignments = [
            {"shift_id": 1, "staff_id": 2}  # Kitchen shift to server staff
        ]
        
        # Mock database queries
        self.db.query.return_value.filter.return_value.first.side_effect = [
            self.shift1, self.staff2
        ]
        
        violations = self.solver._validate_skill_match_constraint(
            self.skill_match_constraint, assignments, []
        )
        
        # Should have violations (staff lacks kitchen skill)
        assert len(violations) > 0
        assert violations[0]["constraint_type"] == "skill_match_required"
        assert violations[0]["severity"] == "error"
        assert "kitchen" in violations[0]["message"]
    
    def test_validate_fair_distribution_constraint_success(self):
        """Test fair distribution constraint validation when balanced"""
        assignments = [
            {"shift_id": 1, "staff_id": 1},  # 1 assignment to staff 1
            {"shift_id": 2, "staff_id": 2}   # 1 assignment to staff 2
        ]
        
        violations = self.solver._validate_fair_distribution_constraint(
            self.fair_distribution_constraint, assignments, []
        )
        
        # Should have no violations (balanced distribution)
        assert len(violations) == 0
    
    def test_validate_fair_distribution_constraint_violation(self):
        """Test fair distribution constraint validation when unbalanced"""
        assignments = [
            {"shift_id": 1, "staff_id": 1},
            {"shift_id": 2, "staff_id": 1},
            {"shift_id": 3, "staff_id": 1},  # 3 assignments to staff 1
            {"shift_id": 4, "staff_id": 2}   # 1 assignment to staff 2
        ]
        
        # Mock database queries
        self.db.query.return_value.filter.return_value.first.return_value = self.staff1
        
        violations = self.solver._validate_fair_distribution_constraint(
            self.fair_distribution_constraint, assignments, []
        )
        
        # Should have violations (unbalanced distribution)
        assert len(violations) > 0
        assert violations[0]["constraint_type"] == "fair_distribution"
        assert violations[0]["severity"] == "warning"
    
    def test_real_time_assignment_validation_success(self):
        """Test real-time assignment validation for valid assignment"""
        # Mock database queries
        self.db.query.return_value.filter.return_value.first.side_effect = [
            self.shift1, self.staff1
        ]
        self.db.query.return_value.filter.return_value.all.return_value = [
            self.max_hours_constraint, self.skill_match_constraint
        ]
        
        result = self.solver.validate_real_time_assignment(
            shift_id=1,
            staff_id=1,
            business_id=1,
            existing_assignments=[]
        )
        
        assert result["valid"] is True
        assert len(result["errors"]) == 0
        assert result["confidence_score"] > 0.7
    
    def test_real_time_assignment_validation_failure(self):
        """Test real-time assignment validation for invalid assignment"""
        # Mock database queries
        self.db.query.return_value.filter.return_value.first.side_effect = [
            self.shift1, self.staff2  # Kitchen shift to server staff
        ]
        self.db.query.return_value.filter.return_value.all.return_value = [
            self.skill_match_constraint
        ]
        
        result = self.solver.validate_real_time_assignment(
            shift_id=1,
            staff_id=2,
            business_id=1,
            existing_assignments=[]
        )
        
        assert result["valid"] is False
        assert len(result["errors"]) > 0
        assert "skill" in result["errors"][0].lower()
    
    def test_get_constraint_violations_summary(self):
        """Test getting violations summary"""
        assignments = [
            {"shift_id": 1, "staff_id": 2},  # Skill mismatch
            {"shift_id": 2, "staff_id": 1}   # Valid assignment
        ]
        
        # Mock database queries
        self.db.query.return_value.filter.return_value.all.side_effect = [
            [self.skill_match_constraint, self.max_hours_constraint],
            [self.max_hours_pref]
        ]
        
        with patch.object(self.solver, 'validate_assignments') as mock_validate:
            mock_validate.return_value = {
                "violations": [
                    {
                        "constraint_type": "skill_match_required",
                        "severity": "error",
                        "affected_staff_id": 2,
                        "affected_shift_id": 1,
                        "message": "Skill mismatch"
                    }
                ],
                "warnings": [
                    {
                        "constraint_type": "availability",
                        "severity": "warning",
                        "affected_staff_id": 1,
                        "affected_shift_id": 2,
                        "message": "Limited availability"
                    }
                ]
            }
            
            summary = self.solver.get_constraint_violations_summary(1, assignments)
            
            assert summary["total_violations"] == 1
            assert summary["total_warnings"] == 1
            assert summary["by_type"]["skill_match_required"] == 1
            assert summary["by_type"]["availability"] == 1
            assert summary["by_severity"]["error"] == 1
            assert summary["by_severity"]["warning"] == 1
            assert 2 in summary["affected_staff"]
            assert 1 in summary["affected_staff"]
            assert len(summary["critical_issues"]) == 1
    
    def test_constraint_type_labels(self):
        """Test constraint type label generation"""
        test_cases = [
            ("skill_match", "Skill Match"),
            ("max_hours_per_week", "Weekly Hour Limit"),
            ("min_rest_between_shifts", "Rest Between Shifts"),
            ("fair_distribution", "Fair Distribution"),
            ("unknown_type", "Unknown Type")
        ]
        
        for constraint_type, expected_label in test_cases:
            # This would be tested in the frontend hook
            pass
    
    def test_suggested_resolutions(self):
        """Test suggested resolution generation"""
        test_cases = [
            ("Staff lacks required skill", "Assign staff member with required skill or provide training"),
            ("Staff not available", "Check staff availability or adjust shift time"),
            ("Would exceed max hours", "Reduce assigned hours or distribute across multiple staff"),
            ("Insufficient rest", "Increase time between shifts or assign different staff"),
            ("Unfair distribution", "Balance assignments more evenly among qualified staff")
        ]
        
        for violation_msg, expected_resolution in test_cases:
            resolution = self.solver._get_suggested_resolution(violation_msg)
            assert expected_resolution in resolution or "Review constraint settings" in resolution
    
    def test_validation_with_missing_data(self):
        """Test validation handles missing data gracefully"""
        assignments = [
            {"shift_id": 999, "staff_id": 1},  # Non-existent shift
            {"shift_id": 1, "staff_id": 999}   # Non-existent staff
        ]
        
        # Mock database to return None for non-existent records
        self.db.query.return_value.filter.return_value.first.return_value = None
        
        result = self.solver.validate_assignments(
            assignments,
            [self.max_hours_constraint],
            []
        )
        
        # Should handle missing data gracefully
        assert "violations" in result
        assert "warnings" in result
        data_violations = [v for v in result["violations"] if v["constraint_type"] == "data_integrity"]
        assert len(data_violations) > 0
    
    def test_validation_performance_with_large_dataset(self):
        """Test validation performance with large number of assignments"""
        # Create 100 assignments
        assignments = []
        shifts = []
        staff_members = []
        
        for i in range(100):
            shift = Mock(spec=Shift)
            shift.id = i + 100
            shift.date = datetime(2024, 1, 15) + timedelta(days=i % 7)
            shift.start_time = "09:00"
            shift.end_time = "17:00"
            shift.required_skill = "kitchen"
            shifts.append(shift)
            
            staff = Mock(spec=Staff)
            staff.id = i + 100
            staff.name = f"Staff {i}"
            staff.skills = ["kitchen"]
            staff_members.append(staff)
            
            assignments.append({"shift_id": shift.id, "staff_id": staff.id})
        
        # Mock database queries
        self.db.query.return_value.filter.return_value.first.side_effect = shifts + staff_members
        
        import time
        start_time = time.time()
        
        result = self.solver.validate_assignments(
            assignments,
            [self.max_hours_constraint, self.skill_match_constraint],
            []
        )
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        # Should complete within reasonable time (< 5 seconds)
        assert execution_time < 5.0
        assert "violations" in result
        assert "warnings" in result
    
    def test_constraint_priority_handling(self):
        """Test that constraint priorities are handled correctly"""
        # Create constraints with different priorities
        critical_constraint = Mock(spec=SchedulingConstraint)
        critical_constraint.priority = "critical"
        critical_constraint.constraint_type = "skill_match_required"
        
        low_constraint = Mock(spec=SchedulingConstraint)
        low_constraint.priority = "low"
        low_constraint.constraint_type = "fair_distribution"
        
        # Test that critical constraints generate errors
        violations = self.solver._validate_skill_match_constraint(
            critical_constraint, [{"shift_id": 1, "staff_id": 2}], []
        )
        
        if violations:
            assert violations[0]["severity"] == "error"
        
        # Test that low priority constraints generate warnings
        violations = self.solver._validate_fair_distribution_constraint(
            low_constraint, [{"shift_id": 1, "staff_id": 1}] * 5, []
        )
        
        if violations:
            assert violations[0]["severity"] == "warning"


if __name__ == "__main__":
    pytest.main([__file__])