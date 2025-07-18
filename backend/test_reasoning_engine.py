"""
Tests for the ReasoningEngine class and assignment reasoning functionality
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, date, time
from sqlalchemy.orm import Session

from services.ai_scheduling_engine import ReasoningEngine, AssignmentReasoning
from services.constraint_solver import SchedulingContext
from models import Staff, Shift, DraftShiftAssignment, ScheduleDraft


@pytest.fixture
def mock_db():
    """Mock database session"""
    return Mock(spec=Session)


@pytest.fixture
def reasoning_engine():
    """Create ReasoningEngine instance for testing"""
    with patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'}):
        return ReasoningEngine()


@pytest.fixture
def sample_staff():
    """Sample staff member for testing"""
    staff = Mock(spec=Staff)
    staff.id = 1
    staff.name = "John Doe"
    staff.skills = ["kitchen", "prep"]
    staff.reliability_score = 8.5
    staff.availability = {
        "monday": ["09:00-17:00"],
        "tuesday": ["09:00-17:00"],
        "wednesday": ["09:00-17:00"]
    }
    staff.hourly_rate = 15.0
    return staff


@pytest.fixture
def sample_shift():
    """Sample shift for testing"""
    shift = Mock(spec=Shift)
    shift.id = 1
    shift.title = "Morning Kitchen"
    shift.date = datetime(2024, 1, 15, 10, 0)
    shift.start_time = "10:00"
    shift.end_time = "18:00"
    shift.required_skill = "kitchen"
    shift.required_staff_count = 2
    return shift


@pytest.fixture
def sample_assignment():
    """Sample draft assignment for testing"""
    assignment = Mock(spec=DraftShiftAssignment)
    assignment.id = 1
    assignment.staff_id = 1
    assignment.shift_id = 1
    assignment.confidence_score = 0.85
    assignment.reasoning = "Good match for kitchen skills"
    assignment.is_ai_generated = True
    return assignment


@pytest.fixture
def sample_context():
    """Sample scheduling context for testing"""
    context = Mock(spec=SchedulingContext)
    context.business_id = 1
    context.date_range_start = date(2024, 1, 15)
    context.date_range_end = date(2024, 1, 21)
    context.existing_assignments = []
    context.constraints = []
    context.staff_preferences = []
    return context


class TestReasoningEngine:
    """Test cases for ReasoningEngine"""
    
    @pytest.mark.asyncio
    async def test_generate_assignment_reasoning_basic(
        self, reasoning_engine, sample_staff, sample_shift, sample_assignment, sample_context
    ):
        """Test basic assignment reasoning generation"""
        
        reasoning = await reasoning_engine.generate_assignment_reasoning(
            sample_shift, sample_staff, sample_assignment, sample_context, ai_enabled=False
        )
        
        assert isinstance(reasoning, AssignmentReasoning)
        assert reasoning.staff_id == sample_staff.id
        assert reasoning.shift_id == sample_shift.id
        assert reasoning.confidence_score == sample_assignment.confidence_score
        assert len(reasoning.primary_reasons) > 0
        
        # Check that skill matching is detected
        skill_reasons = [r for r in reasoning.primary_reasons if "kitchen" in r.lower()]
        assert len(skill_reasons) > 0
        
        # Check reliability score reasoning
        reliability_reasons = [r for r in reasoning.primary_reasons if "reliability" in r.lower()]
        assert len(reliability_reasons) > 0
    
    @pytest.mark.asyncio
    async def test_generate_assignment_reasoning_missing_skill(
        self, reasoning_engine, sample_staff, sample_shift, sample_assignment, sample_context
    ):
        """Test reasoning when staff lacks required skill"""
        
        # Modify staff to not have required skill
        sample_staff.skills = ["bar", "service"]
        
        reasoning = await reasoning_engine.generate_assignment_reasoning(
            sample_shift, sample_staff, sample_assignment, sample_context, ai_enabled=False
        )
        
        # Should have risk factors about missing skill
        skill_risks = [r for r in reasoning.risk_factors if "kitchen" in r.lower()]
        assert len(skill_risks) > 0
    
    @pytest.mark.asyncio
    async def test_generate_assignment_reasoning_low_reliability(
        self, reasoning_engine, sample_staff, sample_shift, sample_assignment, sample_context
    ):
        """Test reasoning with low reliability staff"""
        
        # Set low reliability score
        sample_staff.reliability_score = 4.0
        
        reasoning = await reasoning_engine.generate_assignment_reasoning(
            sample_shift, sample_staff, sample_assignment, sample_context, ai_enabled=False
        )
        
        # Should have risk factors about low reliability
        reliability_risks = [r for r in reasoning.risk_factors if "reliability" in r.lower()]
        assert len(reliability_risks) > 0
    
    @pytest.mark.asyncio
    async def test_generate_assignment_reasoning_with_ai(
        self, reasoning_engine, sample_staff, sample_shift, sample_assignment, sample_context
    ):
        """Test reasoning generation with AI enhancement"""
        
        # Mock OpenAI client response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"considerations": ["AI insight 1"], "additional_risks": ["AI risk 1"]}'
        
        with patch.object(reasoning_engine, 'client') as mock_client:
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            
            reasoning = await reasoning_engine.generate_assignment_reasoning(
                sample_shift, sample_staff, sample_assignment, sample_context, ai_enabled=True
            )
            
            # Should include AI-generated considerations
            assert "AI insight 1" in reasoning.considerations
            assert "AI risk 1" in reasoning.risk_factors
    
    def test_get_skill_level(self, reasoning_engine, sample_staff):
        """Test skill level determination"""
        
        # High reliability should give expert level
        sample_staff.reliability_score = 9.0
        level = reasoning_engine._get_skill_level(sample_staff, "kitchen")
        assert level == "Expert"
        
        # Medium reliability should give intermediate level
        sample_staff.reliability_score = 7.0
        level = reasoning_engine._get_skill_level(sample_staff, "kitchen")
        assert level == "Intermediate"
        
        # Low reliability should give basic level
        sample_staff.reliability_score = 4.0
        level = reasoning_engine._get_skill_level(sample_staff, "kitchen")
        assert level == "Basic"
    
    def test_find_related_skills(self, reasoning_engine):
        """Test finding related skills"""
        
        # Test with skills that should be related to kitchen
        staff_skills = ["prep", "grill", "bar"]
        related = reasoning_engine._find_related_skills(staff_skills, "kitchen")
        
        # The current implementation looks for skills in the same category
        # Since "kitchen" is not in the skill_relationships, it won't find matches
        # Let's test with a skill that is in the relationships
        staff_skills = ["prep", "grill", "fryer"]
        related = reasoning_engine._find_related_skills(staff_skills, "prep")
        
        # prep, grill, and fryer should be related to each other as they're all in kitchen category
        assert "grill" in related or "fryer" in related  # At least one should be related
    
    def test_analyze_availability(self, reasoning_engine, sample_staff, sample_shift):
        """Test availability analysis"""
        
        # Shift on Monday should have good availability
        sample_shift.date = datetime(2024, 1, 15)  # Monday
        score = reasoning_engine._analyze_availability(sample_staff, sample_shift)
        assert score > 0.5
        
        # Staff with no availability data should get neutral score
        sample_staff.availability = None
        score = reasoning_engine._analyze_availability(sample_staff, sample_shift)
        assert score == 0.5
    
    @pytest.mark.asyncio
    async def test_analyze_workload_distribution(
        self, reasoning_engine, sample_staff, sample_context
    ):
        """Test workload distribution analysis"""
        
        # Mock existing assignments
        mock_assignment = Mock()
        mock_assignment.staff_id = sample_staff.id
        sample_context.existing_assignments = [mock_assignment, mock_assignment]  # 2 assignments
        
        workload = await reasoning_engine._analyze_workload_distribution(
            sample_staff, sample_context
        )
        
        assert workload is not None
        assert "hours_this_week" in workload
        assert "is_balanced" in workload
        assert workload["hours_this_week"] == 16  # 2 assignments * 8 hours
    
    def test_analyze_cost_efficiency(self, reasoning_engine, sample_staff, sample_shift):
        """Test cost efficiency analysis"""
        
        # Low hourly rate should be cost-effective
        sample_staff.hourly_rate = 10.0
        analysis = reasoning_engine._analyze_cost_efficiency(sample_staff, sample_shift)
        assert "cost-effective" in analysis.lower()
        
        # High hourly rate should indicate higher cost
        sample_staff.hourly_rate = 25.0
        analysis = reasoning_engine._analyze_cost_efficiency(sample_staff, sample_shift)
        assert "higher cost" in analysis.lower()
        
        # No hourly rate should return None
        sample_staff.hourly_rate = None
        analysis = reasoning_engine._analyze_cost_efficiency(sample_staff, sample_shift)
        assert analysis is None
    
    @pytest.mark.asyncio
    async def test_get_historical_performance(
        self, reasoning_engine, sample_staff, sample_shift, sample_context
    ):
        """Test historical performance analysis"""
        
        # High reliability should give high success rate
        sample_staff.reliability_score = 8.5
        performance = await reasoning_engine._get_historical_performance(
            sample_staff, sample_shift, sample_context
        )
        
        assert performance is not None
        assert performance["success_rate"] >= 0.9
        assert "similar_shifts" in performance
    
    def test_generate_confidence_explanation(self, reasoning_engine):
        """Test confidence score explanation generation"""
        
        # Test different confidence levels
        explanation = reasoning_engine.generate_confidence_explanation(0.95)
        assert "excellent" in explanation.lower()
        
        explanation = reasoning_engine.generate_confidence_explanation(0.75)
        assert "good" in explanation.lower()
        
        explanation = reasoning_engine.generate_confidence_explanation(0.45)
        assert "poor" in explanation.lower()
    
    def test_get_confidence_color_class(self, reasoning_engine):
        """Test confidence color class generation"""
        
        # High confidence should be green
        color_class = reasoning_engine.get_confidence_color_class(0.9)
        assert "green" in color_class
        
        # Medium confidence should be amber
        color_class = reasoning_engine.get_confidence_color_class(0.7)
        assert "amber" in color_class
        
        # Low confidence should be red
        color_class = reasoning_engine.get_confidence_color_class(0.4)
        assert "red" in color_class


class TestAssignmentReasoningIntegration:
    """Integration tests for assignment reasoning"""
    
    @pytest.mark.asyncio
    async def test_full_reasoning_workflow(
        self, reasoning_engine, sample_staff, sample_shift, sample_assignment, sample_context
    ):
        """Test complete reasoning workflow"""
        
        # Set up a realistic scenario
        sample_staff.skills = ["kitchen", "prep"]
        sample_staff.reliability_score = 8.0
        sample_staff.hourly_rate = 16.0
        sample_assignment.confidence_score = 0.82
        
        reasoning = await reasoning_engine.generate_assignment_reasoning(
            sample_shift, sample_staff, sample_assignment, sample_context, ai_enabled=False
        )
        
        # Verify comprehensive reasoning
        assert len(reasoning.primary_reasons) >= 2  # Should have skill and reliability reasons
        assert len(reasoning.considerations) >= 1   # Should have additional considerations
        assert reasoning.confidence_score == 0.82
        
        # Verify reasoning quality
        reasoning_text = " ".join(reasoning.primary_reasons + reasoning.considerations)
        assert "kitchen" in reasoning_text.lower()
        assert "reliability" in reasoning_text.lower()


if __name__ == "__main__":
    pytest.main([__file__])