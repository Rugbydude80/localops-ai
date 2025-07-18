"""
Integration tests for staff preference management system
Tests the complete workflow from API to scheduling algorithm integration
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, date, timedelta
import json

from services.constraint_solver import ConstraintSolver, SchedulingContext
from models import Staff, Shift, StaffPreference, SchedulingConstraint
from schemas import StaffPreferenceCreate, StaffPreferenceUpdate


class TestStaffPreferenceIntegration:
    """Test integration between staff preferences and scheduling algorithm"""
    
    def setup_method(self):
        """Set up test data"""
        self.mock_db = Mock()
        self.constraint_solver = ConstraintSolver(self.mock_db)
        
        # Sample staff member
        self.staff = Staff(
            id=1,
            business_id=1,
            name="John Doe",
            phone_number="+1234567890",
            email="john@example.com",
            role="server",
            skills=["front_of_house", "bar"],
            availability={"monday": ["09:00-17:00"], "tuesday": ["18:00-23:00"]},
            is_active=True
        )
        
        # Sample shift
        self.shift = Shift(
            id=1,
            business_id=1,
            title="Morning Service",
            date=datetime(2024, 7, 22),  # Monday
            start_time="10:00",
            end_time="14:00",
            required_skill="front_of_house",
            required_staff_count=1
        )
    
    def test_max_hours_preference_integration(self):
        """Test that max hours preferences are properly integrated into scheduling"""
        
        # Create max hours preference
        max_hours_pref = StaffPreference(
            id=1,
            staff_id=1,
            preference_type="max_hours",
            preference_value={"hours": 30},
            priority="high",
            is_active=True,
            created_at=datetime.now()
        )
        
        # Create scheduling context with preference
        context = SchedulingContext(
            business_id=1,
            date_range_start=date(2024, 7, 22),
            date_range_end=date(2024, 7, 28),
            existing_assignments=[],
            constraints=[],
            staff_preferences=[max_hours_pref]
        )
        
        # Test max hours constraint retrieval
        max_hours = self.constraint_solver._get_max_hours_constraint(1, context)
        assert max_hours == 30, "Max hours preference should be retrieved correctly"
    
    def test_min_hours_preference_integration(self):
        """Test that min hours preferences boost assignment scores"""
        
        # Create min hours preference
        min_hours_pref = StaffPreference(
            id=2,
            staff_id=1,
            preference_type="min_hours",
            preference_value={"hours": 20},
            priority="medium",
            is_active=True,
            created_at=datetime.now()
        )
        
        context = SchedulingContext(
            business_id=1,
            date_range_start=date(2024, 7, 22),
            date_range_end=date(2024, 7, 28),
            existing_assignments=[],
            constraints=[],
            staff_preferences=[min_hours_pref]
        )
        
        # Test min hours preference check
        week_start = date(2024, 7, 22)  # Monday
        score, message = self.constraint_solver._check_min_hours_preference(
            1, week_start, [], context
        )
        
        # Should get bonus score since staff needs more hours
        assert score > 0.8, "Staff needing hours should get bonus score"
    
    def test_availability_preference_integration(self):
        """Test that availability preferences are properly considered"""
        
        # Create availability preference
        availability_pref = StaffPreference(
            id=3,
            staff_id=1,
            preference_type="availability",
            preference_value={
                "times": [
                    {
                        "day_of_week": 0,  # Monday
                        "start_time": "09:00",
                        "end_time": "15:00",
                        "preferred": True
                    }
                ]
            },
            priority="high",
            is_active=True,
            created_at=datetime.now()
        )
        
        context = SchedulingContext(
            business_id=1,
            date_range_start=date(2024, 7, 22),
            date_range_end=date(2024, 7, 28),
            existing_assignments=[],
            constraints=[],
            staff_preferences=[availability_pref]
        )
        
        # Test availability check for preferred time
        score, message = self.constraint_solver._check_availability(
            self.shift, self.staff, context
        )
        
        # Should get high score for preferred time slot
        assert score >= 0.95, f"Preferred time slot should get high score, got {score}"
        assert message is None, "No error message for preferred time"
    
    def test_time_off_preference_integration(self):
        """Test that time-off requests are properly handled"""
        
        # Create time-off preference
        time_off_pref = StaffPreference(
            id=4,
            staff_id=1,
            preference_type="time_off",
            preference_value={
                "requests": [
                    {
                        "start_date": "2024-07-22",
                        "end_date": "2024-07-24",
                        "reason": "Family vacation",
                        "status": "approved"
                    }
                ]
            },
            priority="high",
            is_active=True,
            created_at=datetime.now()
        )
        
        context = SchedulingContext(
            business_id=1,
            date_range_start=date(2024, 7, 22),
            date_range_end=date(2024, 7, 28),
            existing_assignments=[],
            constraints=[],
            staff_preferences=[time_off_pref]
        )
        
        # Test time-off check
        score, message = self.constraint_solver._check_time_off_preferences(
            self.shift, self.staff, context
        )
        
        # Should get low score due to time-off request
        assert score == 0.0, "High priority time-off should block assignment"
        assert "time-off request" in message.lower(), "Should indicate time-off conflict"
    
    def test_day_off_preference_integration(self):
        """Test that day-off preferences are considered"""
        
        # Create day-off preference for Monday (day 0)
        day_off_pref = StaffPreference(
            id=5,
            staff_id=1,
            preference_type="day_off",
            preference_value={"days": [0]},  # Monday
            priority="medium",
            is_active=True,
            created_at=datetime.now()
        )
        
        context = SchedulingContext(
            business_id=1,
            date_range_start=date(2024, 7, 22),
            date_range_end=date(2024, 7, 28),
            existing_assignments=[],
            constraints=[],
            staff_preferences=[day_off_pref]
        )
        
        # Test day-off preference check
        score, message = self.constraint_solver._check_day_off_preferences(
            self.shift, self.staff, context
        )
        
        # Should get low score due to day-off preference on Monday
        assert score == 0.4, f"Medium priority day-off should get score 0.4, got {score}"
        assert "prefers" in message.lower() and "monday" in message.lower(), "Should indicate day-off preference"
        
        # Test that the preference is stored correctly
        day_off_prefs = [p for p in context.staff_preferences 
                        if p.preference_type == "day_off"]
        assert len(day_off_prefs) == 1
        assert 0 in day_off_prefs[0].preference_value["days"]
    
    def test_preference_priority_handling(self):
        """Test that preference priorities are handled correctly"""
        
        # Create multiple max hours preferences with different priorities
        high_pref = StaffPreference(
            id=6,
            staff_id=1,
            preference_type="max_hours",
            preference_value={"hours": 25},
            priority="high",
            is_active=True,
            created_at=datetime.now()
        )
        
        low_pref = StaffPreference(
            id=7,
            staff_id=1,
            preference_type="max_hours",
            preference_value={"hours": 35},
            priority="low",
            is_active=True,
            created_at=datetime.now() - timedelta(hours=1)  # Earlier
        )
        
        context = SchedulingContext(
            business_id=1,
            date_range_start=date(2024, 7, 22),
            date_range_end=date(2024, 7, 28),
            existing_assignments=[],
            constraints=[],
            staff_preferences=[high_pref, low_pref]
        )
        
        # Should use the most restrictive (lowest) max hours
        max_hours = self.constraint_solver._get_max_hours_constraint(1, context)
        assert max_hours == 25, "Should use most restrictive max hours preference"
    
    def test_preference_effective_date_handling(self):
        """Test that preference effective dates are properly handled"""
        
        # Create preference with future effective date
        future_pref = StaffPreference(
            id=8,
            staff_id=1,
            preference_type="max_hours",
            preference_value={"hours": 20},
            priority="high",
            effective_date=date(2024, 8, 1),  # Future date
            is_active=True,
            created_at=datetime.now()
        )
        
        context = SchedulingContext(
            business_id=1,
            date_range_start=date(2024, 7, 22),
            date_range_end=date(2024, 7, 28),
            existing_assignments=[],
            constraints=[],
            staff_preferences=[future_pref]
        )
        
        # Test preference effectiveness
        is_effective = self.constraint_solver._is_preference_effective(
            future_pref, self.shift.date
        )
        assert not is_effective, "Future preference should not be effective yet"
    
    def test_preference_expiry_date_handling(self):
        """Test that preference expiry dates are properly handled"""
        
        # Create expired preference
        expired_pref = StaffPreference(
            id=9,
            staff_id=1,
            preference_type="max_hours",
            preference_value={"hours": 20},
            priority="high",
            effective_date=date(2024, 6, 1),
            expiry_date=date(2024, 7, 1),  # Expired
            is_active=True,
            created_at=datetime.now()
        )
        
        # Test preference effectiveness
        is_effective = self.constraint_solver._is_preference_effective(
            expired_pref, self.shift.date
        )
        assert not is_effective, "Expired preference should not be effective"
    
    def test_complete_validation_with_preferences(self):
        """Test complete assignment validation with multiple preferences"""
        
        # Create comprehensive preferences
        preferences = [
            StaffPreference(
                id=10,
                staff_id=1,
                preference_type="max_hours",
                preference_value={"hours": 35},
                priority="high",
                is_active=True,
                created_at=datetime.now()
            ),
            StaffPreference(
                id=11,
                staff_id=1,
                preference_type="availability",
                preference_value={
                    "times": [
                        {
                            "day_of_week": 0,  # Monday
                            "start_time": "08:00",
                            "end_time": "16:00",
                            "preferred": True
                        }
                    ]
                },
                priority="high",
                is_active=True,
                created_at=datetime.now()
            )
        ]
        
        context = SchedulingContext(
            business_id=1,
            date_range_start=date(2024, 7, 22),
            date_range_end=date(2024, 7, 28),
            existing_assignments=[],
            constraints=[],
            staff_preferences=preferences
        )
        
        # Test complete validation
        validation_result = self.constraint_solver.validate_assignment(
            self.shift, self.staff, [], context
        )
        
        # Should be valid with good score due to skill match and preferred availability
        assert validation_result.is_valid or validation_result.score > 0.8
        assert "skill_match" in validation_result.details["constraint_scores"]
        assert "availability" in validation_result.details["constraint_scores"]
    
    def test_preference_schema_validation(self):
        """Test that preference schemas work correctly"""
        
        # Test StaffPreferenceCreate schema
        preference_data = {
            "staff_id": 1,
            "preference_type": "max_hours",
            "preference_value": {"hours": 30},
            "priority": "high",
            "effective_date": "2024-07-01",
            "expiry_date": "2024-12-31"
        }
        
        preference_create = StaffPreferenceCreate(**preference_data)
        assert preference_create.staff_id == 1
        assert preference_create.preference_type == "max_hours"
        assert preference_create.preference_value == {"hours": 30}
        assert preference_create.priority == "high"
    
    def test_preference_update_schema(self):
        """Test preference update schema"""
        
        update_data = {
            "preference_value": {"hours": 25},
            "priority": "medium",
            "is_active": False
        }
        
        preference_update = StaffPreferenceUpdate(**update_data)
        assert preference_update.preference_value == {"hours": 25}
        assert preference_update.priority == "medium"
        assert preference_update.is_active == False


class TestPreferenceAPIIntegration:
    """Test API integration for staff preferences"""
    
    def test_preference_crud_workflow(self):
        """Test complete CRUD workflow for preferences"""
        
        # This would test the actual API endpoints
        # For now, we test the data structures and logic
        
        # Create preference
        create_data = StaffPreferenceCreate(
            staff_id=1,
            preference_type="max_hours",
            preference_value={"hours": 30},
            priority="high"
        )
        
        assert create_data.staff_id == 1
        assert create_data.preference_type == "max_hours"
        
        # Update preference
        update_data = StaffPreferenceUpdate(
            preference_value={"hours": 35},
            priority="medium"
        )
        
        assert update_data.preference_value == {"hours": 35}
        assert update_data.priority == "medium"
    
    def test_preference_types_validation(self):
        """Test that different preference types are handled correctly"""
        
        preference_types = [
            ("max_hours", {"hours": 40}),
            ("min_hours", {"hours": 20}),
            ("availability", {"times": [{"day_of_week": 0, "start_time": "09:00", "end_time": "17:00"}]}),
            ("time_off", {"requests": [{"start_date": "2024-07-01", "end_date": "2024-07-07"}]}),
            ("day_off", {"days": [0, 6]})
        ]
        
        for pref_type, pref_value in preference_types:
            preference = StaffPreferenceCreate(
                staff_id=1,
                preference_type=pref_type,
                preference_value=pref_value,
                priority="medium"
            )
            
            assert preference.preference_type == pref_type
            assert preference.preference_value == pref_value


if __name__ == "__main__":
    pytest.main([__file__])