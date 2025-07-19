"""
Migration 003: Enhanced AI Scheduling System Tables

This migration adds the new tables for the enhanced AI scheduling system:
- shift_templates: Standard daily shift templates
- employee_availability: Employee availability preferences
- weekly_hour_allocations: Weekly hour targets and tracking
- schedule_overrides: Manual overrides to AI schedules
- shift_swap_requests: Employee shift swap requests
- open_shifts: Available shifts for employee pickup
- schedule_analytics: Schedule performance analytics
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003_enhanced_scheduling_tables'
down_revision = '002_enhance_notification_tracking'
branch_labels = None
depends_on = None


def upgrade():
    # Create shift_templates table
    op.create_table(
        'shift_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('start_time', sa.String(length=5), nullable=False),
        sa.Column('end_time', sa.String(length=5), nullable=False),
        sa.Column('break_start', sa.String(length=5), nullable=True),
        sa.Column('break_duration', sa.Integer(), nullable=True),
        sa.Column('required_skills', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('min_staff_count', sa.Integer(), nullable=True),
        sa.Column('max_staff_count', sa.Integer(), nullable=True),
        sa.Column('hourly_rate', sa.Float(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_shift_templates_id'), 'shift_templates', ['id'], unique=False)
    op.create_index(op.f('ix_shift_templates_is_active'), 'shift_templates', ['is_active'], unique=False)

    # Create employee_availability table
    op.create_table(
        'employee_availability',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('staff_id', sa.Integer(), nullable=False),
        sa.Column('day_of_week', sa.Integer(), nullable=False),
        sa.Column('availability_type', sa.String(length=20), nullable=False),
        sa.Column('start_time', sa.String(length=5), nullable=True),
        sa.Column('end_time', sa.String(length=5), nullable=True),
        sa.Column('priority', sa.String(length=20), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['staff_id'], ['staff.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_employee_availability_id'), 'employee_availability', ['id'], unique=False)
    op.create_index(op.f('ix_employee_availability_is_active'), 'employee_availability', ['is_active'], unique=False)

    # Create weekly_hour_allocations table
    op.create_table(
        'weekly_hour_allocations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('staff_id', sa.Integer(), nullable=False),
        sa.Column('week_start', sa.Date(), nullable=False),
        sa.Column('target_hours', sa.Float(), nullable=False),
        sa.Column('allocated_hours', sa.Float(), nullable=True),
        sa.Column('actual_hours', sa.Float(), nullable=True),
        sa.Column('overtime_hours', sa.Float(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['staff_id'], ['staff.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_weekly_hour_allocations_id'), 'weekly_hour_allocations', ['id'], unique=False)
    op.create_index(op.f('ix_weekly_hour_allocations_week_start'), 'weekly_hour_allocations', ['week_start'], unique=False)

    # Create schedule_overrides table
    op.create_table(
        'schedule_overrides',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('draft_id', sa.String(), nullable=False),
        sa.Column('shift_id', sa.Integer(), nullable=False),
        sa.Column('staff_id', sa.Integer(), nullable=False),
        sa.Column('override_type', sa.String(length=20), nullable=False),
        sa.Column('original_assignment_id', sa.Integer(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('overridden_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['draft_id'], ['schedule_drafts.id'], ),
        sa.ForeignKeyConstraint(['original_assignment_id'], ['draft_shift_assignments.id'], ),
        sa.ForeignKeyConstraint(['overridden_by'], ['staff.id'], ),
        sa.ForeignKeyConstraint(['shift_id'], ['shifts.id'], ),
        sa.ForeignKeyConstraint(['staff_id'], ['staff.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_schedule_overrides_id'), 'schedule_overrides', ['id'], unique=False)

    # Create shift_swap_requests table
    op.create_table(
        'shift_swap_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('requester_id', sa.Integer(), nullable=False),
        sa.Column('target_staff_id', sa.Integer(), nullable=False),
        sa.Column('requester_shift_id', sa.Integer(), nullable=False),
        sa.Column('target_shift_id', sa.Integer(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('approved_by', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['approved_by'], ['staff.id'], ),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ),
        sa.ForeignKeyConstraint(['requester_id'], ['staff.id'], ),
        sa.ForeignKeyConstraint(['requester_shift_id'], ['shifts.id'], ),
        sa.ForeignKeyConstraint(['target_shift_id'], ['shifts.id'], ),
        sa.ForeignKeyConstraint(['target_staff_id'], ['staff.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_shift_swap_requests_id'), 'shift_swap_requests', ['id'], unique=False)

    # Create open_shifts table
    op.create_table(
        'open_shifts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('shift_id', sa.Integer(), nullable=False),
        sa.Column('required_skills', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('hourly_rate', sa.Float(), nullable=True),
        sa.Column('pickup_deadline', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('claimed_by', sa.Integer(), nullable=True),
        sa.Column('claimed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ),
        sa.ForeignKeyConstraint(['claimed_by'], ['staff.id'], ),
        sa.ForeignKeyConstraint(['shift_id'], ['shifts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_open_shifts_id'), 'open_shifts', ['id'], unique=False)

    # Create schedule_analytics table
    op.create_table(
        'schedule_analytics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('week_start', sa.Date(), nullable=False),
        sa.Column('total_scheduled_hours', sa.Float(), nullable=True),
        sa.Column('total_labor_cost', sa.Float(), nullable=True),
        sa.Column('coverage_rate', sa.Float(), nullable=True),
        sa.Column('overtime_hours', sa.Float(), nullable=True),
        sa.Column('understaffed_shifts', sa.Integer(), nullable=True),
        sa.Column('employee_satisfaction_score', sa.Float(), nullable=True),
        sa.Column('ai_confidence_average', sa.Float(), nullable=True),
        sa.Column('manual_overrides_count', sa.Integer(), nullable=True),
        sa.Column('shift_swap_requests', sa.Integer(), nullable=True),
        sa.Column('open_shift_pickups', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_schedule_analytics_id'), 'schedule_analytics', ['id'], unique=False)
    op.create_index(op.f('ix_schedule_analytics_week_start'), 'schedule_analytics', ['week_start'], unique=False)


def downgrade():
    # Drop tables in reverse order
    op.drop_index(op.f('ix_schedule_analytics_week_start'), table_name='schedule_analytics')
    op.drop_index(op.f('ix_schedule_analytics_id'), table_name='schedule_analytics')
    op.drop_table('schedule_analytics')

    op.drop_index(op.f('ix_open_shifts_id'), table_name='open_shifts')
    op.drop_table('open_shifts')

    op.drop_index(op.f('ix_shift_swap_requests_id'), table_name='shift_swap_requests')
    op.drop_table('shift_swap_requests')

    op.drop_index(op.f('ix_schedule_overrides_id'), table_name='schedule_overrides')
    op.drop_table('schedule_overrides')

    op.drop_index(op.f('ix_weekly_hour_allocations_week_start'), table_name='weekly_hour_allocations')
    op.drop_index(op.f('ix_weekly_hour_allocations_id'), table_name='weekly_hour_allocations')
    op.drop_table('weekly_hour_allocations')

    op.drop_index(op.f('ix_employee_availability_is_active'), table_name='employee_availability')
    op.drop_index(op.f('ix_employee_availability_id'), table_name='employee_availability')
    op.drop_table('employee_availability')

    op.drop_index(op.f('ix_shift_templates_is_active'), table_name='shift_templates')
    op.drop_index(op.f('ix_shift_templates_id'), table_name='shift_templates')
    op.drop_table('shift_templates') 