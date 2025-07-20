"""Add SumUp POS integration tables

Revision ID: 004
Revises: 003
Create Date: 2025-01-17 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    # Create sumup_integrations table
    op.create_table('sumup_integrations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=True),
        sa.Column('is_entitled', sa.Boolean(), nullable=True),
        sa.Column('access_token', sa.String(length=500), nullable=True),
        sa.Column('refresh_token', sa.String(length=500), nullable=True),
        sa.Column('token_expires_at', sa.DateTime(), nullable=True),
        sa.Column('merchant_id', sa.String(length=100), nullable=True),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('sync_frequency_hours', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sumup_integrations_business_id'), 'sumup_integrations', ['business_id'], unique=False)
    op.create_index(op.f('ix_sumup_integrations_is_enabled'), 'sumup_integrations', ['is_enabled'], unique=False)
    op.create_index(op.f('ix_sumup_integrations_is_entitled'), 'sumup_integrations', ['is_entitled'], unique=False)

    # Create sumup_locations table
    op.create_table('sumup_locations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('sumup_location_id', sa.String(length=100), nullable=False),
        sa.Column('sumup_location_name', sa.String(length=200), nullable=True),
        sa.Column('localops_location_id', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ),
        sa.ForeignKeyConstraint(['localops_location_id'], ['locations.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sumup_locations_business_id'), 'sumup_locations', ['business_id'], unique=False)
    op.create_index(op.f('ix_sumup_locations_is_active'), 'sumup_locations', ['is_active'], unique=False)
    op.create_index(op.f('ix_sumup_locations_sumup_location_id'), 'sumup_locations', ['sumup_location_id'], unique=False)

    # Create sales_data table
    op.create_table('sales_data',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('sumup_transaction_id', sa.String(length=100), nullable=False),
        sa.Column('sumup_location_id', sa.String(length=100), nullable=False),
        sa.Column('sale_time', sa.DateTime(), nullable=False),
        sa.Column('sale_value', sa.Float(), nullable=False),
        sa.Column('payment_type', sa.String(length=50), nullable=True),
        sa.Column('items', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('staff_id', sa.Integer(), nullable=True),
        sa.Column('shift_id', sa.Integer(), nullable=True),
        sa.Column('customer_count', sa.Integer(), nullable=True),
        sa.Column('tip_amount', sa.Float(), nullable=True),
        sa.Column('discount_amount', sa.Float(), nullable=True),
        sa.Column('tax_amount', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ),
        sa.ForeignKeyConstraint(['shift_id'], ['shifts.id'], ),
        sa.ForeignKeyConstraint(['staff_id'], ['staff.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sales_data_business_id'), 'sales_data', ['business_id'], unique=False)
    op.create_index(op.f('ix_sales_data_sale_time'), 'sales_data', ['sale_time'], unique=False)
    op.create_index(op.f('ix_sales_data_sumup_transaction_id'), 'sales_data', ['sumup_transaction_id'], unique=False)

    # Create sales_items table
    op.create_table('sales_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sale_id', sa.Integer(), nullable=False),
        sa.Column('item_sku', sa.String(length=100), nullable=True),
        sa.Column('item_name', sa.String(length=200), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('unit_price', sa.Float(), nullable=False),
        sa.Column('total_price', sa.Float(), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['sale_id'], ['sales_data.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sales_items_item_sku'), 'sales_items', ['item_sku'], unique=False)
    op.create_index(op.f('ix_sales_items_sale_id'), 'sales_items', ['sale_id'], unique=False)

    # Create integration_logs table
    op.create_table('integration_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('integration_type', sa.String(length=50), nullable=False),
        sa.Column('operation', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('details', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('error_code', sa.String(length=100), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_integration_logs_business_id'), 'integration_logs', ['business_id'], unique=False)
    op.create_index(op.f('ix_integration_logs_created_at'), 'integration_logs', ['created_at'], unique=False)
    op.create_index(op.f('ix_integration_logs_integration_type'), 'integration_logs', ['integration_type'], unique=False)
    op.create_index(op.f('ix_integration_logs_operation'), 'integration_logs', ['operation'], unique=False)
    op.create_index(op.f('ix_integration_logs_status'), 'integration_logs', ['status'], unique=False)

    # Create sales_analytics table
    op.create_table('sales_analytics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('hour', sa.Integer(), nullable=False),
        sa.Column('total_sales', sa.Float(), nullable=True),
        sa.Column('transaction_count', sa.Integer(), nullable=True),
        sa.Column('average_transaction_value', sa.Float(), nullable=True),
        sa.Column('customer_count', sa.Integer(), nullable=True),
        sa.Column('top_selling_items', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('peak_hour', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ),
        sa.ForeignKeyConstraint(['location_id'], ['locations.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sales_analytics_business_id'), 'sales_analytics', ['business_id'], unique=False)
    op.create_index(op.f('ix_sales_analytics_date'), 'sales_analytics', ['date'], unique=False)
    op.create_index(op.f('ix_sales_analytics_hour'), 'sales_analytics', ['hour'], unique=False)

    # Create staff_sales_performance table
    op.create_table('staff_sales_performance',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('staff_id', sa.Integer(), nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('total_sales', sa.Float(), nullable=True),
        sa.Column('transaction_count', sa.Integer(), nullable=True),
        sa.Column('average_transaction_value', sa.Float(), nullable=True),
        sa.Column('customer_count', sa.Integer(), nullable=True),
        sa.Column('items_sold', sa.Integer(), nullable=True),
        sa.Column('performance_score', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ),
        sa.ForeignKeyConstraint(['staff_id'], ['staff.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_staff_sales_performance_business_id'), 'staff_sales_performance', ['business_id'], unique=False)
    op.create_index(op.f('ix_staff_sales_performance_date'), 'staff_sales_performance', ['date'], unique=False)
    op.create_index(op.f('ix_staff_sales_performance_staff_id'), 'staff_sales_performance', ['staff_id'], unique=False)

    # Create bolt_on_subscriptions table
    op.create_table('bolt_on_subscriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('bolt_on_type', sa.String(length=50), nullable=False),
        sa.Column('subscription_status', sa.String(length=50), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('monthly_price', sa.Float(), nullable=True),
        sa.Column('features_enabled', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_bolt_on_subscriptions_business_id'), 'bolt_on_subscriptions', ['business_id'], unique=False)
    op.create_index(op.f('ix_bolt_on_subscriptions_bolt_on_type'), 'bolt_on_subscriptions', ['bolt_on_type'], unique=False)
    op.create_index(op.f('ix_bolt_on_subscriptions_subscription_status'), 'bolt_on_subscriptions', ['subscription_status'], unique=False)


def downgrade():
    # Drop tables in reverse order
    op.drop_index(op.f('ix_bolt_on_subscriptions_subscription_status'), table_name='bolt_on_subscriptions')
    op.drop_index(op.f('ix_bolt_on_subscriptions_bolt_on_type'), table_name='bolt_on_subscriptions')
    op.drop_index(op.f('ix_bolt_on_subscriptions_business_id'), table_name='bolt_on_subscriptions')
    op.drop_table('bolt_on_subscriptions')

    op.drop_index(op.f('ix_staff_sales_performance_staff_id'), table_name='staff_sales_performance')
    op.drop_index(op.f('ix_staff_sales_performance_date'), table_name='staff_sales_performance')
    op.drop_index(op.f('ix_staff_sales_performance_business_id'), table_name='staff_sales_performance')
    op.drop_table('staff_sales_performance')

    op.drop_index(op.f('ix_sales_analytics_hour'), table_name='sales_analytics')
    op.drop_index(op.f('ix_sales_analytics_date'), table_name='sales_analytics')
    op.drop_index(op.f('ix_sales_analytics_business_id'), table_name='sales_analytics')
    op.drop_table('sales_analytics')

    op.drop_index(op.f('ix_integration_logs_status'), table_name='integration_logs')
    op.drop_index(op.f('ix_integration_logs_operation'), table_name='integration_logs')
    op.drop_index(op.f('ix_integration_logs_integration_type'), table_name='integration_logs')
    op.drop_index(op.f('ix_integration_logs_created_at'), table_name='integration_logs')
    op.drop_index(op.f('ix_integration_logs_business_id'), table_name='integration_logs')
    op.drop_table('integration_logs')

    op.drop_index(op.f('ix_sales_items_sale_id'), table_name='sales_items')
    op.drop_index(op.f('ix_sales_items_item_sku'), table_name='sales_items')
    op.drop_table('sales_items')

    op.drop_index(op.f('ix_sales_data_sumup_transaction_id'), table_name='sales_data')
    op.drop_index(op.f('ix_sales_data_sale_time'), table_name='sales_data')
    op.drop_index(op.f('ix_sales_data_business_id'), table_name='sales_data')
    op.drop_table('sales_data')

    op.drop_index(op.f('ix_sumup_locations_sumup_location_id'), table_name='sumup_locations')
    op.drop_index(op.f('ix_sumup_locations_is_active'), table_name='sumup_locations')
    op.drop_index(op.f('ix_sumup_locations_business_id'), table_name='sumup_locations')
    op.drop_table('sumup_locations')

    op.drop_index(op.f('ix_sumup_integrations_is_entitled'), table_name='sumup_integrations')
    op.drop_index(op.f('ix_sumup_integrations_is_enabled'), table_name='sumup_integrations')
    op.drop_index(op.f('ix_sumup_integrations_business_id'), table_name='sumup_integrations')
    op.drop_table('sumup_integrations') 