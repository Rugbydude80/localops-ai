-- Migration 005: Platform Admin Tables
-- Creates tables for platform owner administration and audit logging

-- Create audit_logs table for comprehensive activity tracking
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id INTEGER REFERENCES public.staff(id),
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),  -- business, user, system, etc.
    resource_id VARCHAR(50),
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(255),
    severity VARCHAR(20) DEFAULT 'info',  -- info, warning, error, critical
    workspace_id VARCHAR(50),
    user_type VARCHAR(20)  -- platform_admin, workspace_admin
);

-- Create security_events table for security monitoring
CREATE TABLE IF NOT EXISTS public.security_events (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,  -- login_failed, permission_denied, etc.
    user_id INTEGER REFERENCES public.staff(id),
    user_email VARCHAR(255),
    ip_address VARCHAR(45),
    details JSONB DEFAULT '{}',
    severity VARCHAR(20) DEFAULT 'warning',
    resolved INTEGER DEFAULT 0  -- 0 = unresolved, 1 = resolved
);

-- Create platform_config table for platform-wide settings
CREATE TABLE IF NOT EXISTS public.platform_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create support_tickets table for customer support
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES public.businesses(id),
    user_id INTEGER REFERENCES public.staff(id),
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',  -- low, medium, high, critical
    status VARCHAR(20) DEFAULT 'open',  -- open, in_progress, resolved, closed
    assigned_to INTEGER REFERENCES public.staff(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create support_ticket_responses table for ticket conversations
CREATE TABLE IF NOT EXISTS public.support_ticket_responses (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES public.staff(id),
    response TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,  -- Internal notes vs customer responses
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create infrastructure_monitoring table for system health
CREATE TABLE IF NOT EXISTS public.infrastructure_monitoring (
    id SERIAL PRIMARY KEY,
    component_name VARCHAR(100) NOT NULL,  -- api_gateway, database, ai_models, etc.
    status VARCHAR(20) NOT NULL,  -- operational, warning, error, maintenance
    uptime_percentage DECIMAL(5,2),
    response_time_ms INTEGER,
    error_rate DECIMAL(5,4),
    last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    details JSONB DEFAULT '{}'
);

-- Create user_impersonation_logs table for admin impersonation tracking
CREATE TABLE IF NOT EXISTS public.user_impersonation_logs (
    id SERIAL PRIMARY KEY,
    impersonator_id INTEGER REFERENCES public.staff(id),
    impersonated_user_id INTEGER REFERENCES public.staff(id),
    workspace_id INTEGER REFERENCES public.businesses(id),
    reason TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    actions_performed JSONB DEFAULT '[]'
);

-- Create platform_analytics table for aggregated metrics
CREATE TABLE IF NOT EXISTS public.platform_analytics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    total_businesses INTEGER DEFAULT 0,
    active_businesses INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0.00,
    new_subscriptions INTEGER DEFAULT 0,
    cancellations INTEGER DEFAULT 0,
    churn_rate DECIMAL(5,4) DEFAULT 0.0000,
    avg_session_duration INTEGER DEFAULT 0,  -- in seconds
    total_api_calls INTEGER DEFAULT 0,
    error_rate DECIMAL(5,4) DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON public.audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_type ON public.audit_logs(user_type);

CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON public.security_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON public.security_events(resolved);

CREATE INDEX IF NOT EXISTS idx_support_tickets_workspace_id ON public.support_tickets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON public.support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at);

CREATE INDEX IF NOT EXISTS idx_infrastructure_monitoring_component ON public.infrastructure_monitoring(component_name);
CREATE INDEX IF NOT EXISTS idx_infrastructure_monitoring_status ON public.infrastructure_monitoring(status);

CREATE INDEX IF NOT EXISTS idx_platform_analytics_date ON public.platform_analytics(date);

-- Insert default platform configuration
INSERT INTO public.platform_config (config_key, config_value, description) VALUES
('subscription_tiers', '{"starter": {"price": 29.99, "features": ["basic_scheduling", "staff_management"]}, "professional": {"price": 59.99, "features": ["ai_scheduling", "smart_communication", "training"]}, "enterprise": {"price": 108.99, "features": ["all_features", "multi_location", "priority_support"]}}', 'Subscription tier pricing and features'),
('security_settings', '{"max_login_attempts": 5, "session_timeout_minutes": 15, "require_2fa_platform_admin": true, "ip_whitelist": []}', 'Security configuration settings'),
('system_limits', '{"max_staff_per_business": 100, "max_locations_per_business": 10, "max_api_calls_per_minute": 1000}', 'System usage limits'),
('notification_settings', '{"email_notifications": true, "slack_integration": false, "webhook_urls": []}', 'Platform notification settings')
ON CONFLICT (config_key) DO NOTHING;

-- Insert default infrastructure monitoring entries
INSERT INTO public.infrastructure_monitoring (component_name, status, uptime_percentage, response_time_ms, error_rate) VALUES
('api_gateway', 'operational', 99.9, 150, 0.001),
('database', 'operational', 99.5, 50, 0.0005),
('ai_models', 'operational', 99.8, 2000, 0.002),
('payment_system', 'operational', 99.9, 300, 0.001),
('email_service', 'operational', 99.7, 500, 0.003)
ON CONFLICT DO NOTHING;

-- Create function to update platform analytics
CREATE OR REPLACE FUNCTION update_platform_analytics()
RETURNS void AS $$
BEGIN
    INSERT INTO public.platform_analytics (
        date,
        total_businesses,
        active_businesses,
        total_revenue,
        new_subscriptions,
        cancellations
    )
    SELECT 
        CURRENT_DATE,
        COUNT(*) as total_businesses,
        COUNT(*) FILTER (WHERE is_active = true) as active_businesses,
        SUM(CASE 
            WHEN subscription_tier = 'starter' THEN 29.99
            WHEN subscription_tier = 'professional' THEN 59.99
            WHEN subscription_tier = 'enterprise' THEN 108.99
            ELSE 0
        END) as total_revenue,
        0 as new_subscriptions,  -- Would be calculated from actual data
        0 as cancellations       -- Would be calculated from actual data
    FROM public.businesses
    ON CONFLICT (date) DO UPDATE SET
        total_businesses = EXCLUDED.total_businesses,
        active_businesses = EXCLUDED.active_businesses,
        total_revenue = EXCLUDED.total_revenue,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create function to log platform admin actions
CREATE OR REPLACE FUNCTION log_platform_action(
    p_user_id INTEGER,
    p_user_email VARCHAR(255),
    p_action VARCHAR(100),
    p_resource_type VARCHAR(50),
    p_resource_id VARCHAR(50),
    p_details JSONB DEFAULT '{}',
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_workspace_id VARCHAR(50) DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.audit_logs (
        user_id,
        user_email,
        action,
        resource_type,
        resource_id,
        details,
        ip_address,
        workspace_id,
        user_type,
        severity
    ) VALUES (
        p_user_id,
        p_user_email,
        p_action,
        p_resource_type,
        p_resource_id,
        p_details,
        p_ip_address,
        p_workspace_id,
        'platform_admin',
        'info'
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    p_event_type VARCHAR(50),
    p_user_id INTEGER DEFAULT NULL,
    p_user_email VARCHAR(255) DEFAULT NULL,
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_details JSONB DEFAULT '{}',
    p_severity VARCHAR(20) DEFAULT 'warning'
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.security_events (
        event_type,
        user_id,
        user_email,
        ip_address,
        details,
        severity
    ) VALUES (
        p_event_type,
        p_user_id,
        p_user_email,
        p_ip_address,
        p_details,
        p_severity
    );
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_platform_config_updated_at 
    BEFORE UPDATE ON public.platform_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at 
    BEFORE UPDATE ON public.support_tickets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust based on your RLS setup)
-- ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.infrastructure_monitoring ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.audit_logs IS 'Comprehensive audit trail for all platform and workspace actions';
COMMENT ON TABLE public.security_events IS 'Security event tracking for threat detection and compliance';
COMMENT ON TABLE public.platform_config IS 'Platform-wide configuration settings';
COMMENT ON TABLE public.support_tickets IS 'Customer support ticket management';
COMMENT ON TABLE public.infrastructure_monitoring IS 'System health and performance monitoring';
COMMENT ON TABLE public.user_impersonation_logs IS 'Admin impersonation tracking for security compliance';
COMMENT ON TABLE public.platform_analytics IS 'Daily aggregated platform metrics and analytics'; 