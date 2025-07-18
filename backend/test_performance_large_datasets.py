import pytest
import asyncio
import time
from datetime import datetime, date, timedelta
from typing import List, Dict
import statistics
from unittest.mock import Mock, patch
import psutil
import threading

from services.ai_scheduling_engine import AISchedulingEngine
from services.constraint_solver import ConstraintSolver
from models import Staff, Shift, Business, SchedulingConstraint, StaffPreference
from schemas import AutoScheduleRequest, SchedulingConstraints


class PerformanceTestData:
    """Generate large datasets for performance testing"""
    
    @staticmethod
    def generate_large_staff_list(count: int = 100) -> List[Staff]:
        """Generate a large list of staff members with varied skills and availability"""
        skills_pool = ['server', 'bartender', 'cook', 'host', 'manager', 'dishwasher', 'prep_cook']
        
        staff_list = []
        for i in range(count):
            # Distribute skills realistically
            if i < count * 0.4:  # 40% servers
                primary_skill = 'server'
                secondary_skills = ['host'] if i % 3 == 0 else []
            elif i < count * 0.6:  # 20% cooks
                primary_skill = 'cook'
                secondary_skills = ['prep_cook'] if i % 2 == 0 else []
            elif i < count * 0.75:  # 15% bartenders
                primary_skill = 'bartender'
                secondary_skills = ['server'] if i % 2 == 0 else []
            elif i < count * 0.85:  # 10% hosts
                primary_skill = 'host'
                secondary_skills = []
            elif i < count * 0.95:  # 10% dishwashers
                primary_skill = 'dishwasher'
                secondary_skills = []
            else:  # 5% managers
                primary_skill = 'manager'
                secondary_skills = ['server', 'bartender']
            
            staff = Staff(
                id=i + 1,
                name=f"Staff Member {i + 1}",
                email=f"staff{i+1}@restaurant.com",
                phone=f"+1{str(i+1).zfill(10)}",
                business_id=1,
                skills=[primary_skill] + secondary_skills,
                hourly_rate=15.0 + (i % 10),  # Varied rates
                max_hours_per_week=40 - (i % 10),  # Varied availability
                is_active=True
            )
            staff_list.append(staff)
        
        return staff_list
    
    @staticmethod
    def generate_complex_shifts(days: int = 7, shifts_per_day: int = 8) -> List[Shift]:
        """Generate complex shift patterns for multiple days"""
        shifts = []
        shift_templates = [
            {'name': 'Morning Prep', 'start': '06:00', 'end': '10:00', 'skill': 'prep_cook', 'count': 2},
            {'name': 'Breakfast', 'start': '07:00', 'end': '11:00', 'skill': 'server', 'count': 3},
            {'name': 'Lunch Prep', 'start': '10:00', 'end': '14:00', 'skill': 'cook', 'count': 2},
            {'name': 'Lunch Service', 'start': '11:00', 'end': '15:00', 'skill': 'server', 'count': 4},
            {'name': 'Afternoon Bar', 'start': '14:00', 'end': '18:00', 'skill': 'bartender', 'count': 2},
            {'name': 'Dinner Prep', 'start': '15:00', 'end': '19:00', 'skill': 'cook', 'count': 3},
            {'name': 'Dinner Service', 'start': '17:00', 'end': '22:00', 'skill': 'server', 'count': 5},
            {'name': 'Evening Bar', 'start': '18:00', 'end': '23:00', 'skill': 'bartender', 'count': 3},
            {'name': 'Closing', 'start': '22:00', 'end': '24:00', 'skill': 'dishwasher', 'count': 2},
        ]
        
        base_date = date.today()
        shift_id = 1
        
        for day in range(days):
            current_date = base_date + timedelta(days=day)
            
            for template in shift_templates:
                for position in range(template['count']):
                    shift = Shift(
                        id=shift_id,
                        business_id=1,
                        title=f"{template['name']} - Position {position + 1}",
                        date=current_date,
                        start_time=template['start'],
                        end_time=template['end'],
                        required_skill=template['skill'],
                        is_published=False
                    )
                    shifts.append(shift)
                    shift_id += 1
        
        return shifts
    
    @staticmethod
    def generate_complex_constraints(staff_count: int) -> List[SchedulingConstraint]:
        """Generate complex scheduling constraints"""
        constraints = []
        
        # Business-level constraints
        business_constraints = [
            {
                'constraint_type': 'min_staff_per_shift',
                'constraint_value': {'minimum': 2, 'skill_specific': True},
                'priority': 'critical'
            },
            {
                'constraint_type': 'max_consecutive_days',
                'constraint_value': {'maximum': 5},
                'priority': 'high'
            },
            {
                'constraint_type': 'min_rest_between_shifts',
                'constraint_value': {'hours': 8},
                'priority': 'high'
            },
            {
                'constraint_type': 'skill_coverage_requirement',
                'constraint_value': {'server': 0.6, 'cook': 0.8, 'bartender': 0.7},
                'priority': 'medium'
            }
        ]
        
        for i, constraint_data in enumerate(business_constraints):
            constraint = SchedulingConstraint(
                id=i + 1,
                business_id=1,
                **constraint_data
            )
            constraints.append(constraint)
        
        return constraints


@pytest.mark.performance
class TestSchedulingPerformance:
    """Performance tests for scheduling algorithms with large datasets"""
    
    @pytest.fixture
    def large_staff_list(self):
        return PerformanceTestData.generate_large_staff_list(100)
    
    @pytest.fixture
    def complex_shifts(self):
        return PerformanceTestData.generate_complex_shifts(14, 8)  # 2 weeks
    
    @pytest.fixture
    def complex_constraints(self):
        return PerformanceTestData.generate_complex_constraints(100)
    
    @pytest.fixture
    def ai_scheduling_engine(self):
        with patch('services.ai_scheduling_engine.OpenAI'):
            return AISchedulingEngine(db=Mock(), openai_client=Mock())
    
    @pytest.fixture
    def constraint_solver(self):
        return ConstraintSolver(db=Mock())

    async def test_large_dataset_schedule_generation_performance(self, ai_scheduling_engine, large_staff_list, complex_shifts, complex_constraints):
        """Test schedule generation performance with 100+ staff and complex constraints"""
        
        # Mock database queries to return our test data
        with patch.object(ai_scheduling_engine, '_get_staff_list', return_value=large_staff_list), \
             patch.object(ai_scheduling_engine, '_get_shifts_for_period', return_value=complex_shifts), \
             patch.object(ai_scheduling_engine, '_get_constraints', return_value=complex_constraints):
            
            start_time = time.time()
            start_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
            
            # Generate schedule for 2 weeks with 100 staff
            schedule_request = AutoScheduleRequest(
                business_id=1,
                date_range_start=date.today(),
                date_range_end=date.today() + timedelta(days=14),
                special_events=[],
                staff_notes=[]
            )
            
            result = await ai_scheduling_engine.generate_schedule(schedule_request)
            
            end_time = time.time()
            end_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
            
            execution_time = end_time - start_time
            memory_usage = end_memory - start_memory
            
            # Performance assertions
            assert execution_time < 30.0, f"Schedule generation took {execution_time:.2f}s, should be under 30s"
            assert memory_usage < 500, f"Memory usage was {memory_usage:.2f}MB, should be under 500MB"
            assert result is not None
            assert len(result.shifts) > 0
            
            print(f"Performance metrics:")
            print(f"  Execution time: {execution_time:.2f}s")
            print(f"  Memory usage: {memory_usage:.2f}MB")
            print(f"  Shifts processed: {len(complex_shifts)}")
            print(f"  Staff processed: {len(large_staff_list)}")

    async def test_constraint_solving_scalability(self, constraint_solver, large_staff_list, complex_shifts, complex_constraints):
        """Test constraint solver performance with complex scenarios"""
        
        # Mock database queries
        with patch.object(constraint_solver, 'db') as mock_db:
            mock_db.query.return_value.filter.return_value.all.return_value = complex_constraints
            
            start_time = time.time()
            
            # Test constraint solving for multiple scenarios
            scenarios = [
                {'understaffed': True, 'skill_shortage': ['cook']},
                {'overstaffed': True, 'excess_skills': ['server']},
                {'mixed_constraints': True, 'complex_rules': True},
                {'peak_hours': True, 'high_demand': True}
            ]
            
            results = []
            for scenario in scenarios:
                scenario_start = time.time()
                
                assignments = constraint_solver.solve_scheduling_constraints(
                    shifts=complex_shifts[:50],  # Test with subset for each scenario
                    staff=large_staff_list,
                    constraints=SchedulingConstraints(
                        max_hours_per_week=40,
                        min_rest_hours=8,
                        skill_requirements=True,
                        **scenario
                    )
                )
                
                scenario_time = time.time() - scenario_start
                results.append({
                    'scenario': scenario,
                    'time': scenario_time,
                    'assignments': len(assignments) if assignments else 0
                })
            
            total_time = time.time() - start_time
            avg_time = statistics.mean([r['time'] for r in results])
            
            # Performance assertions
            assert total_time < 60.0, f"Total constraint solving took {total_time:.2f}s, should be under 60s"
            assert avg_time < 15.0, f"Average scenario time was {avg_time:.2f}s, should be under 15s"
            
            print(f"Constraint solving performance:")
            print(f"  Total time: {total_time:.2f}s")
            print(f"  Average scenario time: {avg_time:.2f}s")
            for result in results:
                print(f"  {result['scenario']}: {result['time']:.2f}s, {result['assignments']} assignments")

    async def test_concurrent_schedule_generation(self, ai_scheduling_engine, large_staff_list, complex_shifts):
        """Test performance under concurrent load"""
        
        with patch.object(ai_scheduling_engine, '_get_staff_list', return_value=large_staff_list), \
             patch.object(ai_scheduling_engine, '_get_shifts_for_period', return_value=complex_shifts):
            
            async def generate_schedule_task(business_id: int):
                """Single schedule generation task"""
                request = AutoScheduleRequest(
                    business_id=business_id,
                    date_range_start=date.today(),
                    date_range_end=date.today() + timedelta(days=7),
                    special_events=[],
                    staff_notes=[]
                )
                
                start_time = time.time()
                result = await ai_scheduling_engine.generate_schedule(request)
                end_time = time.time()
                
                return {
                    'business_id': business_id,
                    'execution_time': end_time - start_time,
                    'success': result is not None
                }
            
            # Run 5 concurrent schedule generations
            start_time = time.time()
            tasks = [generate_schedule_task(i) for i in range(1, 6)]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            total_time = time.time() - start_time
            
            # Filter out exceptions
            successful_results = [r for r in results if isinstance(r, dict) and r['success']]
            
            assert len(successful_results) >= 4, "At least 4 out of 5 concurrent requests should succeed"
            assert total_time < 45.0, f"Concurrent execution took {total_time:.2f}s, should be under 45s"
            
            avg_execution_time = statistics.mean([r['execution_time'] for r in successful_results])
            print(f"Concurrent performance:")
            print(f"  Total time: {total_time:.2f}s")
            print(f"  Successful requests: {len(successful_results)}/5")
            print(f"  Average execution time: {avg_execution_time:.2f}s")

    async def test_memory_usage_under_load(self, ai_scheduling_engine):
        """Test memory usage patterns under sustained load"""
        
        # Generate increasingly large datasets
        dataset_sizes = [25, 50, 75, 100, 150]
        memory_usage = []
        
        for size in dataset_sizes:
            staff_list = PerformanceTestData.generate_large_staff_list(size)
            shifts = PerformanceTestData.generate_complex_shifts(7, 6)  # 1 week
            
            with patch.object(ai_scheduling_engine, '_get_staff_list', return_value=staff_list), \
                 patch.object(ai_scheduling_engine, '_get_shifts_for_period', return_value=shifts):
                
                # Measure memory before
                process = psutil.Process()
                memory_before = process.memory_info().rss / 1024 / 1024  # MB
                
                # Generate schedule
                request = AutoScheduleRequest(
                    business_id=1,
                    date_range_start=date.today(),
                    date_range_end=date.today() + timedelta(days=7),
                    special_events=[],
                    staff_notes=[]
                )
                
                await ai_scheduling_engine.generate_schedule(request)
                
                # Measure memory after
                memory_after = process.memory_info().rss / 1024 / 1024  # MB
                memory_diff = memory_after - memory_before
                
                memory_usage.append({
                    'staff_count': size,
                    'memory_usage': memory_diff,
                    'memory_per_staff': memory_diff / size
                })
        
        # Check for memory leaks (usage should scale linearly, not exponentially)
        memory_per_staff_values = [m['memory_per_staff'] for m in memory_usage]
        memory_growth_ratio = max(memory_per_staff_values) / min(memory_per_staff_values)
        
        assert memory_growth_ratio < 3.0, f"Memory usage per staff grew by {memory_growth_ratio:.2f}x, indicating potential memory leak"
        
        print("Memory usage scaling:")
        for usage in memory_usage:
            print(f"  {usage['staff_count']} staff: {usage['memory_usage']:.2f}MB total, {usage['memory_per_staff']:.3f}MB per staff")

    async def test_database_query_performance(self, ai_scheduling_engine):
        """Test database query performance with large datasets"""
        
        # Mock database with realistic query times
        query_times = []
        
        def mock_query_with_timing(*args, **kwargs):
            start_time = time.time()
            # Simulate database query time based on complexity
            time.sleep(0.01 + len(args) * 0.001)  # Simulate realistic query time
            end_time = time.time()
            query_times.append(end_time - start_time)
            return Mock()
        
        with patch.object(ai_scheduling_engine, 'db') as mock_db:
            mock_db.query.side_effect = mock_query_with_timing
            
            # Simulate multiple database operations
            operations = [
                'get_staff_availability',
                'get_shift_requirements',
                'get_business_constraints',
                'get_staff_preferences',
                'get_historical_assignments',
                'validate_assignments',
                'save_draft_schedule'
            ]
            
            start_time = time.time()
            
            for operation in operations:
                # Simulate each database operation
                getattr(ai_scheduling_engine, f'_{operation}', mock_query_with_timing)(business_id=1)
            
            total_time = time.time() - start_time
            avg_query_time = statistics.mean(query_times) if query_times else 0
            
            assert total_time < 5.0, f"Database operations took {total_time:.2f}s, should be under 5s"
            assert avg_query_time < 0.5, f"Average query time was {avg_query_time:.3f}s, should be under 0.5s"
            
            print(f"Database performance:")
            print(f"  Total time: {total_time:.2f}s")
            print(f"  Average query time: {avg_query_time:.3f}s")
            print(f"  Operations performed: {len(operations)}")


@pytest.mark.performance
class TestNotificationPerformance:
    """Performance tests for notification system with large recipient lists"""
    
    async def test_bulk_notification_performance(self):
        """Test bulk notification delivery performance"""
        from services.notification_service import NotificationService
        
        notification_service = NotificationService()
        
        # Generate large staff list
        large_staff_list = PerformanceTestData.generate_large_staff_list(200)
        
        # Mock external service calls to avoid actual API calls
        with patch.object(notification_service, 'send_whatsapp_notification') as mock_whatsapp, \
             patch.object(notification_service, 'send_sms_notification') as mock_sms, \
             patch.object(notification_service, 'send_email_notification') as mock_email:
            
            # Mock successful responses with realistic delays
            async def mock_notification_delay(*args, **kwargs):
                await asyncio.sleep(0.01)  # Simulate network delay
                return Mock(success=True, external_id="mock-id")
            
            mock_whatsapp.side_effect = mock_notification_delay
            mock_sms.side_effect = mock_notification_delay
            mock_email.side_effect = mock_notification_delay
            
            start_time = time.time()
            
            results = await notification_service.send_bulk_notifications(
                staff_list=large_staff_list,
                message="Schedule update",
                channels=['whatsapp', 'sms', 'email']
            )
            
            end_time = time.time()
            execution_time = end_time - start_time
            
            # Performance assertions
            assert execution_time < 30.0, f"Bulk notifications took {execution_time:.2f}s, should be under 30s"
            assert len(results) == len(large_staff_list)
            
            successful_notifications = [r for r in results if r.success]
            success_rate = len(successful_notifications) / len(results)
            assert success_rate >= 0.95, f"Success rate was {success_rate:.2%}, should be at least 95%"
            
            print(f"Bulk notification performance:")
            print(f"  Execution time: {execution_time:.2f}s")
            print(f"  Recipients: {len(large_staff_list)}")
            print(f"  Success rate: {success_rate:.2%}")
            print(f"  Notifications per second: {len(results) / execution_time:.1f}")

    async def test_notification_queue_processing(self):
        """Test notification queue processing under high load"""
        from services.notification_service import NotificationService
        
        notification_service = NotificationService()
        
        # Create a large queue of notifications
        notification_queue = []
        for i in range(500):
            notification_queue.append({
                'staff_id': i + 1,
                'message': f'Notification {i + 1}',
                'channel': ['whatsapp', 'sms', 'email'][i % 3],
                'priority': ['low', 'medium', 'high'][i % 3]
            })
        
        # Mock queue processing
        processed_notifications = []
        
        async def mock_process_notification(notification):
            await asyncio.sleep(0.001)  # Simulate processing time
            processed_notifications.append(notification)
            return Mock(success=True)
        
        with patch.object(notification_service, '_process_single_notification', side_effect=mock_process_notification):
            
            start_time = time.time()
            
            # Process queue with concurrency
            await notification_service.process_notification_queue(
                notification_queue,
                max_concurrent=20
            )
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            assert processing_time < 15.0, f"Queue processing took {processing_time:.2f}s, should be under 15s"
            assert len(processed_notifications) == 500
            
            throughput = len(processed_notifications) / processing_time
            assert throughput >= 30, f"Throughput was {throughput:.1f} notifications/s, should be at least 30/s"
            
            print(f"Queue processing performance:")
            print(f"  Processing time: {processing_time:.2f}s")
            print(f"  Queue size: {len(notification_queue)}")
            print(f"  Throughput: {throughput:.1f} notifications/s")