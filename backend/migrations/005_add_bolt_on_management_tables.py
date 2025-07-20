"""Add bolt-on management tables

Revision ID: 005
Revises: 004
Create Date: 2025-01-19 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    # Create bolt_on_management table for platform owner control
    op.create_table('bolt_on_management',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('bolt_on_type', sa.String(50), nullable=False),
        sa.Column('is_platform_enabled', sa.Boolean(), default=True),
        sa.Column('monthly_price', sa.Float(), default=29.99),
        sa.Column('required_plan', sa.String(50), default='professional'),
        sa.Column('description', sa.Text()),
        sa.Column('features', sa.JSON()),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create bolt_on_audit_log table for tracking all admin actions
    op.create_table('bolt_on_audit_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('bolt_on_type', sa.String(50), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),  # enable, disable, price_change, etc.
        sa.Column('performed_by', sa.Integer(), nullable=False),  # staff_id who performed action
        sa.Column('old_value', sa.JSON()),
        sa.Column('new_value', sa.JSON()),
        sa.Column('reason', sa.Text()),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Add indexes for performance
    op.create_index('idx_bolt_on_management_type', 'bolt_on_management', ['bolt_on_type'])
    op.create_index('idx_bolt_on_audit_business', 'bolt_on_audit_log', ['business_id'])
    op.create_index('idx_bolt_on_audit_type', 'bolt_on_audit_log', ['bolt_on_type'])
    op.create_index('idx_bolt_on_audit_created', 'bolt_on_audit_log', ['created_at'])
    
    # Insert default SumUp bolt-on configuration
    op.execute("""
        INSERT INTO bolt_on_management (bolt_on_type, is_platform_enabled, monthly_price, required_plan, description, features)
        VALUES (
            'sumup_sync',
            true,
            29.99,
            'professional',
            'SumUp POS Integration - Automated sales data sync and analytics',
            '["Automated sales data sync", "Staff performance analytics", "Demand-driven scheduling", "Inventory insights", "Revenue optimization"]'
        )
    """)


def downgrade():
    op.drop_index('idx_bolt_on_audit_created', table_name='bolt_on_audit_log')
    op.drop_index('idx_bolt_on_audit_type', table_name='bolt_on_audit_log')
    op.drop_index('idx_bolt_on_audit_business', table_name='bolt_on_audit_log')
    op.drop_index('idx_bolt_on_management_type', table_name='bolt_on_management')
    op.drop_table('bolt_on_audit_log')
    op.drop_table('bolt_on_management') 