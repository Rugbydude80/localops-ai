"""
Comprehensive tests for AI Scheduling Engine

Tests cover AI scheduling with mock OpenAI responses, constraint solving,
reasoning generation, and various scheduling scenarios.
"""

import pytest
import json
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, date, time, timedelta
from sqlalchemy.orm import Session

from services.ai_scheduling_engine import (
    AISchedulingEngine, ReasoningEngine, SchedulingParameters,
    SchedulingStrategy, AssignmentReasoning, ScheduleGenerationResult
)
from services.constraint_solver import SchedulingContext
from models import (
    Staff, Shift, ScheduleDraft, DraftShiftAssignment,
    SchedulingConstraint, StaffPreference, Business
)


class TestAISchedulingEngine:
    """Test suite for AI Scheduling Engine"""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        db = Mock(spec=Session)
        db.add = Mock()
        db.commit = Mock()
        db.refresh = Mock()
        db.merge = Mock()
        db.query = Mock()
        return db
    
    @pytest.fixture
    def sample_staff(self):
        """Sample staff data for testing"""
        return [
            Staff(
                id=1,
                business_id=1,
                name="John Chef",
                phone_number="+1234567890",
                email="john@test.com",
                role="chef",
                skills=["kitchen", "grill"],
                availability={"monday": ["09:00-17:00"], "tuesday": ["09:00-17:00"]},
                reliability_score=8.5,
                is_active=True
            ),
            Staff(
                id=2,
                business_id=1,
                name="Sarah Server",
                phone_number="+1234567891",
                email="sarah@test.com",
                role="server",
                skills=["front_of_house", "bar"],
                availability={"monday": ["17:00-23:00"], "tuesday": ["17:00-23:00"]},
                reliability_score=9.0,
                is_active=True
            ),
            Staff(
                id=3,
                business_id=1,
                name="Mike Manager",
                phone_number="+1234567892",
                email="mike@test.com",
                role="manager",
                skills=["management", "kitchen", "front_of_house"],
                availability={"monday": ["08:00-18:00"], "tuesday": ["08:00-18:00"]},
                reliability_score=9.5,
                is_active=True
            )
        ]
    
    @pytest.fixture
    def sample_shifts(self):
        """Sample shifts for testing"""
        base_date = date.today() + timedelta(days=1)
        return [
            Shift(
                id=1,
                business_id=1,
                title="Morning Kitchen",
                date=datetime.combine(base_date, time(9, 0)),
                start_time="09:00",
                end_time="15:00",
                required_skill="kitchen",
                required_staff_count=1,
                status="scheduled"
            ),
            Shift(
                id=2,
                business_id=1,
                title="Evening Service",
                date=datetime.combine(base_date, time(17, 0)),
                start_time="17:00",
                end_time="23:00",
                required_skill="front_of_house",
                required_staff_count=2,
                status="scheduled"
            ),
            Shift(
                id=3,
                business_id=1,
                title="Bar Shift",
                date=datetime.combine(base_date, time(18, 0)),
                start_time="18:00",
                end_time="24:00",
                required_skill="bar",
                required_staff_count=1,
                status="scheduled"
            )
        ]
    
    @pytest.fixture
    def scheduling_params(self):
        """Sample scheduling parameters"""
        start_date = date.today() + timedelta(days=1)
        end_date = start_date + timedelta(days=6)
        
        return SchedulingParameters(
            business_id=1,
            date_range_start=start_date,
            date_range_end=end_date,
            special_events=[
                {
                    "date": start_date.isoformat(),
                    "name": "Football Match",
                    "expected_impact": "high"
                }
            ],
            staff_notes=[
                {
                    "staff_id": 1,
                    "note": "Prefers morning shifts"
                }
            ],
            constraints={"max_hours_per_week": 40},
            created_by=1
        )
    
    @pytest.fixture
    def mock_openai_response(self):
        """Mock OpenAI API response"""
        return {
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "recommendations": {
                            "1": {
                                "recommended_staff_id": 1,
                                "confidence": 0.9,
                                "reasoning": "John Chef has required kitchen skills and high reliability",
                                "alternatives": [{"staff_id": 3, "score": 0.7}],
                                "risk_factors": []
                            },
                            "2": {
                                "recommended_staff_id": 2,
                                "confidence": 0.85,
                                "reasoning": "Sarah Server has front_of_house skills and good availability",
                                "alternatives": [{"staff_id": 3, "score": 0.8}],
                                "risk_factors": ["May need backup for busy periods"]
                            }
                        },
                        "overall_insights": "Good skill coverage, consider cross-training for flexibility"
                    })
                }
            }]
        }
    
    @pytest.fixture
    def ai_engine(self, mock_db):
        """AI Scheduling Engine instance with mocked dependencies"""
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'}):
            engine = AISchedulingEngine(mock_db)
            engine.ai_enabled = True
            return engine
    
    @pytest.fixture
    def ai_engine_no_key(self, mock_db):
        """AI Scheduling Engine without OpenAI key (fallback mode)"""
        with patch.dict('os.environ', {}, clear=True):
            engine = AISchedulingEngine(mock_db)
            return engine
    
    @pytest.mark.asyncio
    async def test_generate_schedule_with_ai(
        self, ai_engine, mock_db, scheduling_params, 
        sample_staff, sample_shifts, mock_openai_response
    ):
        """Test schedule generation with AI enabled"""
        
        # Mock database queries
        mock_db.query.return_value.filter.return_value.all.return_value = []
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Mock draft creation
        mock_draft = Mock()
        mock_draft.id = "test-draft-123"
        mock_db.refresh = Mock(side_effect=lambda obj: setattr(obj, 'id', 'test-draft-123'))
        
        # Mock constraint solver
        mock_assignment = DraftShiftAssignment(
            shift_id=1,
            staff_id=1,
            confidence_score=0.8,
            reasoning="Good skill match",
            is_ai_generated=True
        )
        ai_engine.constraint_solver.solve_scheduling_constraints = Mock(
            return_value=[mock_assignment]
        )
        
        # Mock OpenAI client
        with patch.object(ai_engine, 'client') as mock_client:
            mock_client.chat.completions.create = AsyncMock(
                return_value=Mock(**mock_openai_response)
            )
            
            # Mock internal methods
            ai_engine._get_shifts_to_schedule = AsyncMock(return_value=sample_shifts)
            ai_engine._get_available_staff = AsyncMock(return_value=sample_staff)
            mock_context = Mock(spec=SchedulingContext)
            mock_context.business_id = 1
            mock_context.date_range_start = date.today()
            ai_engine._build_scheduling_context = AsyncMock(
                return_value=mock_context
            )
            ai_engine._get_historical_scheduling_data = AsyncMock(
                return_value={"staff_performance": {}, "skill_demand": {}}
            )
            
            # Execute
            result = await ai_engine.generate_schedule(
                scheduling_params, SchedulingStrategy.BALANCED
            )
            
            # Assertions
            assert isinstance(result, ScheduleGenerationResult)
            assert result.draft_id == "test-draft-123"
            assert len(result.assignments) > 0
            assert 0 <= result.overall_confidence <= 1
            assert isinstance(result.generation_summary, dict)
            
            # Verify AI was called
            mock_client.chat.completions.create.assert_called()
    
    @pytest.mark.asyncio
    async def test_generate_schedule_fallback_mode(
        self, ai_engine_no_key, mock_db, scheduling_params,
        sample_staff, sample_shifts
    ):
        """Test schedule generation without AI (fallback mode)"""
        
        # Mock database queries
        mock_db.query.return_value.filter.return_value.all.return_value = []
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Mock draft creation
        mock_db.refresh = Mock(side_effect=lambda obj: setattr(obj, 'id', 'test-draft-456'))
        
        # Mock constraint solver
        mock_assignment = DraftShiftAssignment(
            shift_id=1,
            staff_id=1,
            confidence_score=0.7,
            reasoning="Constraint-based assignment",
            is_ai_generated=True
        )
        ai_engine_no_key.constraint_solver.solve_scheduling_constraints = Mock(
            return_value=[mock_assignment]
        )
        
        # Mock internal methods
        ai_engine_no_key._get_shifts_to_schedule = AsyncMock(return_value=sample_shifts)
        ai_engine_no_key._get_available_staff = AsyncMock(return_value=sample_staff)
        ai_engine_no_key._build_scheduling_context = AsyncMock(
            return_value=Mock(spec=SchedulingContext)
        )
        
        # Execute
        result = await ai_engine_no_key.generate_schedule(
            scheduling_params, SchedulingStrategy.BALANCED
        )
        
        # Assertions
        assert isinstance(result, ScheduleGenerationResult)
        assert result.draft_id == "test-draft-456"
        assert len(result.assignments) > 0
        assert ai_engine_no_key.ai_enabled == False
    
    @pytest.mark.asyncio
    async def test_explain_assignment(
        self, ai_engine, mock_db, sample_staff, sample_shifts
    ):
        """Test assignment explanation generation"""
        
        # Create test assignment
        assignment = DraftShiftAssignment(
            shift_id=1,
            staff_id=1,
            confidence_score=0.85,
            reasoning="AI-generated assignment",
            is_ai_generated=True
        )
        
        # Mock database queries
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            sample_shifts[0],  # shift query
            sample_staff[0]    # staff query
        ]
        
        # Mock context
        mock_context = Mock(spec=SchedulingContext)
        
        # Mock reasoning engine
        expected_reasoning = AssignmentReasoning(
            staff_id=1,
            shift_id=1,
            confidence_score=0.85,
            primary_reasons=["Has required kitchen skill", "High reliability score"],
            considerations=["Good availability match"],
            alternatives_considered=[{"staff_id": 3, "score": 0.7}],
            risk_factors=[]
        )
        
        ai_engine.reasoning_engine.generate_assignment_reasoning = AsyncMock(
            return_value=expected_reasoning
        )
        
        # Execute
        result = await ai_engine.explain_assignment(assignment, mock_context)
        
        # Assertions
        assert isinstance(result, AssignmentReasoning)
        assert result.staff_id == 1
        assert result.shift_id == 1
        assert result.confidence_score == 0.85
        assert len(result.primary_reasons) > 0
    
    @pytest.mark.asyncio
    async def test_optimize_existing_schedule(
        self, ai_engine, mock_db
    ):
        """Test optimization of existing schedule"""
        
        # Mock draft
        mock_draft = Mock()
        mock_draft.id = "test-draft-789"
        mock_draft.business_id = 1
        mock_draft.date_range_start = date.today()
        mock_draft.date_range_end = date.today() + timedelta(days=7)
        
        mock_db.query.return_value.filter.return_value.first.return_value = mock_draft
        
        # Mock existing assignments
        existing_assignments = [
            DraftShiftAssignment(
                shift_id=1,
                staff_id=1,
                confidence_score=0.7,
                reasoning="Original assignment"
            )
        ]
        mock_db.query.return_value.filter.return_value.all.return_value = existing_assignments
        
        # Mock context building
        ai_engine._build_context_from_draft = AsyncMock(
            return_value=Mock(spec=SchedulingContext)
        )
        
        # Mock optimization
        ai_engine._apply_ai_optimizations = AsyncMock(
            return_value=existing_assignments
        )
        
        # Execute
        result = await ai_engine.optimize_existing_schedule(
            "test-draft-789", ["cost_optimization", "staff_satisfaction"]
        )
        
        # Assertions
        assert isinstance(result, ScheduleGenerationResult)
        assert result.draft_id == "test-draft-789"
        assert len(result.assignments) > 0
    
    def test_calculate_overall_confidence(self, ai_engine):
        """Test overall confidence calculation"""
        
        assignments = [
            Mock(confidence_score=0.8),
            Mock(confidence_score=0.9),
            Mock(confidence_score=0.7)
        ]
        
        confidence = ai_engine._calculate_overall_confidence(assignments)
        
        assert abs(confidence - 0.8) < 0.001  # (0.8 + 0.9 + 0.7) / 3
    
    def test_calculate_overall_confidence_empty(self, ai_engine):
        """Test confidence calculation with no assignments"""
        
        confidence = ai_engine._calculate_overall_confidence([])
        
        assert confidence == 0.0
    
    @pytest.mark.asyncio
    async def test_build_scheduling_context(
        self, ai_engine, mock_db, scheduling_params
    ):
        """Test scheduling context building"""
        
        # Mock database queries
        mock_constraints = [Mock(spec=SchedulingConstraint)]
        mock_preferences = [Mock(spec=StaffPreference)]
        mock_assignments = [Mock(spec=DraftShiftAssignment)]
        
        mock_db.query.return_value.filter.return_value.all.side_effect = [
            mock_constraints,
            mock_preferences,
            mock_assignments
        ]
        
        # Execute
        context = await ai_engine._build_scheduling_context(scheduling_params)
        
        # Assertions
        assert isinstance(context, SchedulingContext)
        assert context.business_id == scheduling_params.business_id
        assert context.date_range_start == scheduling_params.date_range_start
        assert context.date_range_end == scheduling_params.date_range_end
    
    @pytest.mark.asyncio
    async def test_get_shifts_to_schedule(
        self, ai_engine, mock_db, scheduling_params, sample_shifts
    ):
        """Test getting shifts to schedule"""
        
        # Mock database query
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.all.return_value = sample_shifts
        mock_db.query.return_value = mock_query
        
        # Execute
        shifts = await ai_engine._get_shifts_to_schedule(scheduling_params)
        
        # Assertions
        assert len(shifts) == len(sample_shifts)
        assert all(isinstance(shift, Shift) for shift in shifts)
    
    @pytest.mark.asyncio
    async def test_get_available_staff(
        self, ai_engine, mock_db, sample_staff
    ):
        """Test getting available staff"""
        
        # Mock database query
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = sample_staff
        mock_db.query.return_value = mock_query
        
        # Execute
        staff = await ai_engine._get_available_staff(1)
        
        # Assertions
        assert len(staff) == len(sample_staff)
        assert all(isinstance(s, Staff) for s in staff)
    
    @pytest.mark.asyncio
    async def test_get_historical_scheduling_data(
        self, ai_engine, mock_db
    ):
        """Test historical data retrieval"""
        
        # Mock historical assignments
        mock_assignments = []
        mock_query = Mock()
        mock_query.join.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = mock_assignments
        mock_db.query.return_value = mock_query
        
        # Execute
        data = await ai_engine._get_historical_scheduling_data(1, date.today())
        
        # Assertions
        assert isinstance(data, dict)
        assert "staff_performance" in data
        assert "skill_demand" in data
        assert "total_historical_shifts" in data
        assert "analysis_period_days" in data
    
    def test_build_ai_scheduling_prompt(self, ai_engine):
        """Test AI prompt building"""
        
        shifts_data = [{"id": 1, "title": "Test Shift"}]
        staff_data = [{"id": 1, "name": "Test Staff"}]
        historical_data = {"staff_performance": {}}
        strategy = SchedulingStrategy.BALANCED
        
        prompt = ai_engine._build_ai_scheduling_prompt(
            shifts_data, staff_data, historical_data, strategy
        )
        
        assert isinstance(prompt, str)
        assert "SHIFTS TO SCHEDULE" in prompt
        assert "AVAILABLE STAFF" in prompt
        assert "STRATEGY: balanced" in prompt
        assert "Return JSON format" in prompt


class TestReasoningEngine:
    """Test suite for Reasoning Engine"""
    
    @pytest.fixture
    def reasoning_engine(self):
        """Reasoning engine instance"""
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'}):
            return ReasoningEngine()
    
    @pytest.fixture
    def reasoning_engine_no_key(self):
        """Reasoning engine without OpenAI key"""
        with patch.dict('os.environ', {}, clear=True):
            return ReasoningEngine()
    
    @pytest.mark.asyncio
    async def test_generate_assignment_reasoning_with_ai(
        self, reasoning_engine
    ):
        """Test reasoning generation with AI"""
        
        # Create test data
        shift = Shift(
            id=1,
            title="Test Shift",
            date=datetime.now(),
            start_time="09:00",
            end_time="17:00",
            required_skill="kitchen"
        )
        
        staff = Staff(
            id=1,
            name="Test Staff",
            skills=["kitchen"],
            availability={"monday": ["09:00-17:00"]},
            reliability_score=8.0
        )
        
        assignment = DraftShiftAssignment(
            shift_id=1,
            staff_id=1,
            confidence_score=0.85
        )
        
        context = Mock(spec=SchedulingContext)
        
        # Mock AI response
        ai_response = {
            "considerations": ["Good skill match", "Available during shift"],
            "additional_risks": ["No backup available"]
        }
        
        with patch.object(reasoning_engine, '_get_ai_reasoning') as mock_ai:
            mock_ai.return_value = ai_response
            reasoning_engine._find_assignment_alternatives = AsyncMock(
                return_value=[{"staff_id": 2, "score": 0.7}]
            )
            
            # Execute
            result = await reasoning_engine.generate_assignment_reasoning(
                shift, staff, assignment, context, ai_enabled=True
            )
            
            # Assertions
            assert isinstance(result, AssignmentReasoning)
            assert result.staff_id == 1
            assert result.shift_id == 1
            assert result.confidence_score == 0.85
            assert "Has required kitchen skill" in result.primary_reasons
            assert len(result.considerations) > 0
    
    @pytest.mark.asyncio
    async def test_generate_assignment_reasoning_fallback(
        self, reasoning_engine_no_key
    ):
        """Test reasoning generation without AI"""
        
        # Create test data
        shift = Shift(
            id=1,
            title="Test Shift",
            date=datetime.now(),
            start_time="09:00",
            end_time="17:00",
            required_skill="kitchen"
        )
        
        staff = Staff(
            id=1,
            name="Test Staff",
            skills=["kitchen"],
            availability={"monday": ["09:00-17:00"]},
            reliability_score=8.0
        )
        
        assignment = DraftShiftAssignment(
            shift_id=1,
            staff_id=1,
            confidence_score=0.85
        )
        
        context = Mock(spec=SchedulingContext)
        
        reasoning_engine_no_key._find_assignment_alternatives = AsyncMock(
            return_value=[{"staff_id": 2, "score": 0.7}]
        )
        
        # Execute
        result = await reasoning_engine_no_key.generate_assignment_reasoning(
            shift, staff, assignment, context, ai_enabled=False
        )
        
        # Assertions
        assert isinstance(result, AssignmentReasoning)
        assert result.staff_id == 1
        assert result.shift_id == 1
        assert "Has required kitchen skill" in result.primary_reasons
    
    @pytest.mark.asyncio
    async def test_get_ai_reasoning_success(self, reasoning_engine):
        """Test successful AI reasoning call"""
        
        shift = Mock()
        shift.title = "Test Shift"
        shift.date = datetime.now()
        shift.start_time = "09:00"
        shift.end_time = "17:00"
        shift.required_skill = "kitchen"
        shift.required_staff_count = 1
        
        staff = Mock()
        staff.name = "Test Staff"
        staff.skills = ["kitchen"]
        staff.reliability_score = 8.0
        staff.availability = {"monday": ["09:00-17:00"]}
        
        assignment = Mock()
        context = Mock()
        
        # Mock OpenAI response
        mock_response = {
            "considerations": ["Good availability match"],
            "additional_risks": ["Busy period risk"]
        }
        
        with patch.object(reasoning_engine, 'client') as mock_client:
            mock_client.chat.completions.create = AsyncMock(
                return_value=Mock(
                    choices=[Mock(message=Mock(content=json.dumps(mock_response)))]
                )
            )
            
            # Execute
            result = await reasoning_engine._get_ai_reasoning(
                shift, staff, assignment, context
            )
            
            # Assertions
            assert result == mock_response
            mock_client.chat.completions.create.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_ai_reasoning_failure(self, reasoning_engine):
        """Test AI reasoning call failure"""
        
        shift = Mock()
        staff = Mock()
        assignment = Mock()
        context = Mock()
        
        with patch.object(reasoning_engine, 'client') as mock_client:
            mock_client.chat.completions.create = AsyncMock(
                side_effect=Exception("API Error")
            )
            
            # Execute
            result = await reasoning_engine._get_ai_reasoning(
                shift, staff, assignment, context
            )
            
            # Assertions
            assert result is None
    
    @pytest.mark.asyncio
    async def test_find_assignment_alternatives(self, reasoning_engine):
        """Test finding assignment alternatives"""
        
        shift = Mock()
        context = Mock()
        
        # Execute
        alternatives = await reasoning_engine._find_assignment_alternatives(
            shift, context
        )
        
        # Assertions
        assert isinstance(alternatives, list)
        assert len(alternatives) > 0
        assert all("staff_id" in alt for alt in alternatives)
        assert all("score" in alt for alt in alternatives)


class TestSchedulingStrategies:
    """Test different scheduling strategies"""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        db = Mock(spec=Session)
        db.add = Mock()
        db.commit = Mock()
        db.refresh = Mock()
        db.merge = Mock()
        db.query = Mock()
        return db
    
    @pytest.fixture
    def scheduling_params(self):
        """Sample scheduling parameters"""
        start_date = date.today() + timedelta(days=1)
        end_date = start_date + timedelta(days=6)
        
        return SchedulingParameters(
            business_id=1,
            date_range_start=start_date,
            date_range_end=end_date,
            special_events=[
                {
                    "date": start_date.isoformat(),
                    "name": "Football Match",
                    "expected_impact": "high"
                }
            ],
            staff_notes=[
                {
                    "staff_id": 1,
                    "note": "Prefers morning shifts"
                }
            ],
            constraints={"max_hours_per_week": 40},
            created_by=1
        )
    
    @pytest.fixture
    def ai_engine(self, mock_db):
        """AI Scheduling Engine instance with mocked dependencies"""
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'}):
            engine = AISchedulingEngine(mock_db)
            engine.ai_enabled = True
            return engine
    
    @pytest.mark.asyncio
    async def test_balanced_strategy(self, ai_engine, mock_db, scheduling_params):
        """Test balanced scheduling strategy"""
        
        # Mock dependencies
        ai_engine._get_shifts_to_schedule = AsyncMock(return_value=[])
        ai_engine._get_available_staff = AsyncMock(return_value=[])
        mock_context = Mock(spec=SchedulingContext)
        mock_context.business_id = 1
        mock_context.date_range_start = date.today()
        ai_engine._build_scheduling_context = AsyncMock(return_value=mock_context)
        ai_engine._get_historical_scheduling_data = AsyncMock(
            return_value={"staff_performance": {}, "skill_demand": {}}
        )
        ai_engine.constraint_solver.solve_scheduling_constraints = Mock(return_value=[])
        
        mock_db.refresh = Mock(side_effect=lambda obj: setattr(obj, 'id', 'test-draft'))
        
        # Execute
        result = await ai_engine.generate_schedule(
            scheduling_params, SchedulingStrategy.BALANCED
        )
        
        # Assertions
        assert isinstance(result, ScheduleGenerationResult)
    
    @pytest.mark.asyncio
    async def test_cost_optimized_strategy(self, ai_engine, mock_db, scheduling_params):
        """Test cost-optimized scheduling strategy"""
        
        # Mock dependencies
        ai_engine._get_shifts_to_schedule = AsyncMock(return_value=[])
        ai_engine._get_available_staff = AsyncMock(return_value=[])
        mock_context = Mock(spec=SchedulingContext)
        mock_context.business_id = 1
        mock_context.date_range_start = date.today()
        ai_engine._build_scheduling_context = AsyncMock(return_value=mock_context)
        ai_engine._get_historical_scheduling_data = AsyncMock(
            return_value={"staff_performance": {}, "skill_demand": {}}
        )
        ai_engine.constraint_solver.solve_scheduling_constraints = Mock(return_value=[])
        
        mock_db.refresh = Mock(side_effect=lambda obj: setattr(obj, 'id', 'test-draft'))
        
        # Execute
        result = await ai_engine.generate_schedule(
            scheduling_params, SchedulingStrategy.COST_OPTIMIZED
        )
        
        # Assertions
        assert isinstance(result, ScheduleGenerationResult)


class TestErrorHandling:
    """Test error handling scenarios"""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        db = Mock(spec=Session)
        db.add = Mock()
        db.commit = Mock()
        db.refresh = Mock()
        db.merge = Mock()
        db.query = Mock()
        return db
    
    @pytest.fixture
    def scheduling_params(self):
        """Sample scheduling parameters"""
        start_date = date.today() + timedelta(days=1)
        end_date = start_date + timedelta(days=6)
        
        return SchedulingParameters(
            business_id=1,
            date_range_start=start_date,
            date_range_end=end_date,
            special_events=[],
            staff_notes=[],
            constraints={"max_hours_per_week": 40},
            created_by=1
        )
    
    @pytest.fixture
    def ai_engine(self, mock_db):
        """AI Scheduling Engine instance with mocked dependencies"""
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'}):
            engine = AISchedulingEngine(mock_db)
            engine.ai_enabled = True
            return engine
    
    @pytest.mark.asyncio
    async def test_schedule_generation_database_error(
        self, ai_engine, mock_db, scheduling_params
    ):
        """Test handling of database errors during schedule generation"""
        
        # Mock database error
        mock_db.add.side_effect = Exception("Database connection failed")
        
        # Execute and expect exception
        with pytest.raises(Exception) as exc_info:
            await ai_engine.generate_schedule(scheduling_params)
        
        assert "Database connection failed" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_explain_assignment_invalid_data(
        self, ai_engine, mock_db
    ):
        """Test assignment explanation with invalid data"""
        
        assignment = DraftShiftAssignment(shift_id=999, staff_id=999)
        context = Mock()
        
        # Mock database returning None
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Execute and expect exception
        with pytest.raises(ValueError) as exc_info:
            await ai_engine.explain_assignment(assignment, context)
        
        assert "Invalid assignment" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_optimize_nonexistent_schedule(
        self, ai_engine, mock_db
    ):
        """Test optimization of non-existent schedule"""
        
        # Mock database returning None
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Execute and expect exception
        with pytest.raises(ValueError) as exc_info:
            await ai_engine.optimize_existing_schedule("nonexistent-draft", [])
        
        assert "Draft nonexistent-draft not found" in str(exc_info.value)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])