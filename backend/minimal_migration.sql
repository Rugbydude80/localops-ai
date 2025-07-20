-- =====================================================
-- MINIMAL DUAL ADMIN ARCHITECTURE MIGRATION
-- SynqForge Platform Admin Tables
-- =====================================================

-- This script creates all necessary tables for the dual admin architecture
-- while preserving existing data and ensuring compatibility

-- =====================================================
-- 1. PLATFORM ADMIN TABLES
-- =====================================================

-- Audit Logs Table - Comprehensive audit trail
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(50),
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(255),
    severity VARCHAR(20) DEFAULT 'info',
    workspace_id VARCHAR(50),
    user_type VARCHAR(20)
);

-- Security Events Table - Security incident tracking
CREATE TABLE IF NOT EXISTS security_events (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event_type VARCHAR(50) NOT NULL,
    user_id INTEGER,
    user_email VARCHAR(255),
    ip_address VARCHAR(45),
    details TEXT,
    severity VARCHAR(20) DEFAULT 'warning',
    resolved INTEGER DEFAULT 0
);

-- Support Tickets Table - Customer support system
CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    workspace_id INTEGER,
    user_id INTEGER,
    user_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'open',
    category VARCHAR(50),
    assigned_to INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    response_time_minutes INTEGER,
    satisfaction_rating INTEGER
);

-- Support Ticket Responses Table
CREATE TABLE IF NOT EXISTS support_responses (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER,
    user_id INTEGER,
    user_email VARCHAR(255) NOT NULL,
    response TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Impersonation Logs Table - Admin impersonation audit
CREATE TABLE IF NOT EXISTS impersonation_logs (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER,
    admin_email VARCHAR(255) NOT NULL,
    target_user_id INTEGER,
    target_email VARCHAR(255) NOT NULL,
    workspace_id INTEGER,
    reason TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Infrastructure Metrics Table - System monitoring
CREATE TABLE IF NOT EXISTS infrastructure_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    metric_unit VARCHAR(20),
    component VARCHAR(50),
    severity VARCHAR(20) DEFAULT 'info',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details TEXT
);

-- AI Model Status Table - AI model health tracking
CREATE TABLE IF NOT EXISTS ai_model_status (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50),
    status VARCHAR(20) DEFAULT 'operational',
    accuracy DECIMAL(5,2),
    last_trained TIMESTAMP,
    training_duration_minutes INTEGER,
    performance_metrics TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platform Analytics Table - Platform-wide metrics
CREATE TABLE IF NOT EXISTS platform_analytics (
    id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,2) NOT NULL,
    workspace_id INTEGER,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(metric_date, metric_name, workspace_id)
);

-- System Configuration Table - Configuration management
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    config_type VARCHAR(20) DEFAULT 'string',
    description TEXT,
    is_sensitive BOOLEAN DEFAULT FALSE,
    updated_by INTEGER,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- IP Whitelist Table - Security access control
CREATE TABLE IF NOT EXISTS ip_whitelist (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    description TEXT,
    added_by INTEGER,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP
);

-- =====================================================
-- 2. ADD FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Add foreign key constraints to existing tables if they don't exist
DO $$ 
BEGIN
    -- Audit logs foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'audit_logs_user_id_fkey') THEN
        ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES staff(id) ON DELETE SET NULL;
    END IF;
    
    -- Security events foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'security_events_user_id_fkey') THEN
        ALTER TABLE security_events ADD CONSTRAINT security_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES staff(id) ON DELETE SET NULL;
    END IF;
    
    -- Support tickets foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'support_tickets_workspace_id_fkey') THEN
        ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES businesses(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'support_tickets_user_id_fkey') THEN
        ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES staff(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'support_tickets_assigned_to_fkey') THEN
        ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES staff(id) ON DELETE SET NULL;
    END IF;
    
    -- Support responses foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'support_responses_ticket_id_fkey') THEN
        ALTER TABLE support_responses ADD CONSTRAINT support_responses_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'support_responses_user_id_fkey') THEN
        ALTER TABLE support_responses ADD CONSTRAINT support_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES staff(id) ON DELETE SET NULL;
    END IF;
    
    -- Impersonation logs foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'impersonation_logs_admin_user_id_fkey') THEN
        ALTER TABLE impersonation_logs ADD CONSTRAINT impersonation_logs_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES staff(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'impersonation_logs_target_user_id_fkey') THEN
        ALTER TABLE impersonation_logs ADD CONSTRAINT impersonation_logs_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES staff(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'impersonation_logs_workspace_id_fkey') THEN
        ALTER TABLE impersonation_logs ADD CONSTRAINT impersonation_logs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES businesses(id) ON DELETE SET NULL;
    END IF;
    
    -- Platform analytics foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'platform_analytics_workspace_id_fkey') THEN
        ALTER TABLE platform_analytics ADD CONSTRAINT platform_analytics_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES businesses(id) ON DELETE CASCADE;
    END IF;
    
    -- System config foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'system_config_updated_by_fkey') THEN
        ALTER TABLE system_config ADD CONSTRAINT system_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES staff(id) ON DELETE SET NULL;
    END IF;
    
    -- IP whitelist foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ip_whitelist_added_by_fkey') THEN
        ALTER TABLE ip_whitelist ADD CONSTRAINT ip_whitelist_added_by_fkey FOREIGN KEY (added_by) REFERENCES staff(id) ON DELETE SET NULL;
    END IF;
    
END $$;

-- =====================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_type ON audit_logs(user_type);

-- Security events indexes
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON security_events(resolved);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);

-- Support tickets indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_workspace_id ON support_tickets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);

-- Support responses indexes
CREATE INDEX IF NOT EXISTS idx_support_responses_ticket_id ON support_responses(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_responses_created_at ON support_responses(created_at);

-- Impersonation logs indexes
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_admin_user_id ON impersonation_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_target_user_id ON impersonation_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_started_at ON impersonation_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_workspace_id ON impersonation_logs(workspace_id);

-- Infrastructure metrics indexes
CREATE INDEX IF NOT EXISTS idx_infrastructure_metrics_timestamp ON infrastructure_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_infrastructure_metrics_component ON infrastructure_metrics(component);
CREATE INDEX IF NOT EXISTS idx_infrastructure_metrics_metric_name ON infrastructure_metrics(metric_name);

-- AI model status indexes
CREATE INDEX IF NOT EXISTS idx_ai_model_status_model_name ON ai_model_status(model_name);
CREATE INDEX IF NOT EXISTS idx_ai_model_status_status ON ai_model_status(status);
CREATE INDEX IF NOT EXISTS idx_ai_model_status_last_trained ON ai_model_status(last_trained);

-- Platform analytics indexes
CREATE INDEX IF NOT EXISTS idx_platform_analytics_metric_date ON platform_analytics(metric_date);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_metric_name ON platform_analytics(metric_name);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_workspace_id ON platform_analytics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_category ON platform_analytics(category);

-- System config indexes
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);
CREATE INDEX IF NOT EXISTS idx_system_config_type ON system_config(config_type);

-- IP whitelist indexes
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_ip_address ON ip_whitelist(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_is_active ON ip_whitelist(is_active);
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_expires_at ON ip_whitelist(expires_at);

-- =====================================================
-- 4. CREATE DATABASE VIEWS FOR COMMON QUERIES
-- =====================================================

-- Recent security events view
CREATE OR REPLACE VIEW recent_security_events AS
SELECT 
    se.*,
    s.name as staff_name
FROM security_events se
LEFT JOIN staff s ON se.user_id = s.id
WHERE se.timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY se.timestamp DESC;

-- Support ticket summary view
CREATE OR REPLACE VIEW support_ticket_summary AS
SELECT 
    st.*,
    b.name as workspace_name,
    s.name as staff_name,
    COUNT(sr.id) as response_count
FROM support_tickets st
LEFT JOIN businesses b ON st.workspace_id = b.id
LEFT JOIN staff s ON st.user_id = s.id
LEFT JOIN support_responses sr ON st.id = sr.ticket_id
GROUP BY st.id, b.name, s.name;

-- Platform health dashboard view
CREATE OR REPLACE VIEW platform_health_dashboard AS
SELECT 
    'audit_logs' as component,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours') as last_24h
FROM audit_logs
UNION ALL
SELECT 
    'security_events' as component,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours') as last_24h
FROM security_events
UNION ALL
SELECT 
    'support_tickets' as component,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours') as last_24h
FROM support_tickets;

-- Workspace analytics summary view
CREATE OR REPLACE VIEW workspace_analytics_summary AS
SELECT 
    b.id as workspace_id,
    b.name as workspace_name,
    b.subscription_tier,
    COUNT(s.id) as total_staff,
    COUNT(s.id) FILTER (WHERE s.is_active = true) as active_staff,
    COUNT(st.id) as total_support_tickets,
    COUNT(st.id) FILTER (WHERE st.status = 'open') as open_tickets,
    MAX(st.created_at) as last_support_activity
FROM businesses b
LEFT JOIN staff s ON b.id = s.business_id
LEFT JOIN support_tickets st ON b.id = st.workspace_id
WHERE b.is_active = true
GROUP BY b.id, b.name, b.subscription_tier;

-- =====================================================
-- 5. INSERT DEFAULT SYSTEM CONFIGURATION
-- =====================================================

INSERT INTO system_config (config_key, config_value, config_type, description) VALUES
('platform_name', 'SynqForge', 'string', 'Platform name'),
('max_workspaces', '10000', 'integer', 'Maximum number of workspaces'),
('default_subscription_tier', 'starter', 'string', 'Default subscription tier for new workspaces'),
('session_timeout_minutes', '15', 'integer', 'Session timeout in minutes for platform admins'),
('audit_log_retention_days', '365', 'integer', 'Number of days to retain audit logs'),
('security_alert_threshold', '5', 'integer', 'Number of failed login attempts before security alert'),
('ai_model_retrain_interval_hours', '168', 'integer', 'Hours between AI model retraining'),
('support_response_time_target_minutes', '240', 'integer', 'Target response time for support tickets in minutes'),
('platform_admin_email_domain', 'synqforge.com', 'string', 'Email domain for platform admin accounts'),
('enable_2fa_platform_admin', 'true', 'boolean', 'Enable 2FA for platform admin accounts'),
('enable_ip_whitelist', 'false', 'boolean', 'Enable IP whitelist for admin access'),
('max_failed_login_attempts', '5', 'integer', 'Maximum failed login attempts before lockout'),
('audit_log_export_enabled', 'true', 'boolean', 'Enable audit log export functionality'),
('compliance_reporting_enabled', 'true', 'boolean', 'Enable compliance reporting features')
ON CONFLICT (config_key) DO NOTHING;

-- =====================================================
-- 6. INSERT SAMPLE AI MODEL STATUS DATA
-- =====================================================

INSERT INTO ai_model_status (model_name, model_version, status, accuracy, last_trained, training_duration_minutes, performance_metrics) VALUES
('scheduling_engine', 'v1.2.0', 'operational', 94.5, CURRENT_TIMESTAMP - INTERVAL '7 days', 120, '{"precision": 0.945, "recall": 0.932, "f1_score": 0.938}'),
('constraint_solver', 'v1.1.5', 'operational', 91.2, CURRENT_TIMESTAMP - INTERVAL '14 days', 90, '{"precision": 0.912, "recall": 0.898, "f1_score": 0.905}'),
('notification_classifier', 'v1.0.8', 'operational', 89.7, CURRENT_TIMESTAMP - INTERVAL '21 days', 60, '{"precision": 0.897, "recall": 0.885, "f1_score": 0.891}'),
('demand_predictor', 'v1.3.2', 'operational', 87.3, CURRENT_TIMESTAMP - INTERVAL '10 days', 180, '{"mae": 0.087, "rmse": 0.123, "r2_score": 0.873}'),
('staff_recommender', 'v1.1.0', 'operational', 92.1, CURRENT_TIMESTAMP - INTERVAL '5 days', 75, '{"precision": 0.921, "recall": 0.915, "f1_score": 0.918}')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 7. INSERT SAMPLE INFRASTRUCTURE METRICS
-- =====================================================

INSERT INTO infrastructure_metrics (metric_name, metric_value, metric_unit, component, severity, details) VALUES
('cpu_usage', 45.2, 'percent', 'api_server', 'info', '{"cores": 8, "load_average": [1.2, 1.1, 0.9]}'),
('memory_usage', 67.8, 'percent', 'api_server', 'info', '{"total_gb": 16, "used_gb": 10.8, "available_gb": 5.2}'),
('disk_usage', 23.4, 'percent', 'database', 'info', '{"total_gb": 500, "used_gb": 117, "available_gb": 383}'),
('database_connections', 12, 'count', 'database', 'info', '{"max_connections": 100, "active_connections": 12, "idle_connections": 88}'),
('api_response_time', 145, 'milliseconds', 'api_gateway', 'info', '{"p50": 120, "p95": 180, "p99": 250}'),
('error_rate', 0.12, 'percent', 'api_gateway', 'info', '{"total_requests": 15420, "error_requests": 18}'),
('queue_depth', 3, 'count', 'task_queue', 'info', '{"pending_tasks": 3, "processing_tasks": 8, "completed_tasks": 1247}'),
('cache_hit_rate', 89.5, 'percent', 'redis_cache', 'info', '{"hits": 89234, "misses": 10456, "total": 99690}')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 8. INSERT SAMPLE PLATFORM ANALYTICS DATA
-- =====================================================

-- Insert sample analytics data for today and yesterday
INSERT INTO platform_analytics (metric_date, metric_name, metric_value, category) VALUES
(CURRENT_DATE, 'daily_revenue', 1500, 'revenue'),
(CURRENT_DATE, 'new_subscriptions', 2, 'subscriptions'),
(CURRENT_DATE, 'cancellations', 1, 'subscriptions'),
(CURRENT_DATE, 'active_users', 1200, 'users'),
(CURRENT_DATE, 'support_tickets', 8, 'support'),
(CURRENT_DATE, 'security_events', 3, 'security'),
(CURRENT_DATE - INTERVAL '1 day', 'daily_revenue', 1475, 'revenue'),
(CURRENT_DATE - INTERVAL '1 day', 'new_subscriptions', 3, 'subscriptions'),
(CURRENT_DATE - INTERVAL '1 day', 'cancellations', 0, 'subscriptions'),
(CURRENT_DATE - INTERVAL '1 day', 'active_users', 1185, 'users'),
(CURRENT_DATE - INTERVAL '1 day', 'support_tickets', 6, 'support'),
(CURRENT_DATE - INTERVAL '1 day', 'security_events', 2, 'security')
ON CONFLICT (metric_date, metric_name, workspace_id) DO NOTHING;

-- =====================================================
-- 9. CREATE SAMPLE SUPPORT TICKETS
-- =====================================================

INSERT INTO support_tickets (ticket_number, workspace_id, user_id, user_email, subject, description, priority, status, category) VALUES
('TICK-2024-001', 1, 17, 'sarah.johnson@localops.ai', 'Scheduling Issue', 'The auto-scheduling feature is not working correctly for our weekend shifts.', 'high', 'open', 'scheduling'),
('TICK-2024-002', 1, 17, 'sarah.johnson@localops.ai', 'Staff Management', 'Need help setting up new staff member with proper permissions.', 'medium', 'open', 'staff_management'),
('TICK-2024-003', 1, 17, 'sarah.johnson@localops.ai', 'Reporting Question', 'How can I generate custom reports for our monthly staff performance?', 'low', 'resolved', 'reporting'),
('TICK-2024-004', 1, 17, 'sarah.johnson@localops.ai', 'Integration Request', 'Looking to integrate with our POS system for automatic sales data.', 'medium', 'open', 'integrations')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 10. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail of all platform and workspace admin actions';
COMMENT ON TABLE security_events IS 'Security events and incidents for monitoring and alerting';
COMMENT ON TABLE support_tickets IS 'Customer support ticket management system';
COMMENT ON TABLE support_responses IS 'Support ticket responses and internal notes';
COMMENT ON TABLE impersonation_logs IS 'Log of admin user impersonation sessions for security auditing';
COMMENT ON TABLE infrastructure_metrics IS 'System infrastructure monitoring metrics';
COMMENT ON TABLE ai_model_status IS 'AI model health and performance monitoring';
COMMENT ON TABLE platform_analytics IS 'Platform-wide analytics and metrics';
COMMENT ON TABLE system_config IS 'System configuration settings for platform administration';
COMMENT ON TABLE ip_whitelist IS 'IP address whitelist for enhanced security access control';

COMMENT ON VIEW recent_security_events IS 'View of recent security events with user information';
COMMENT ON VIEW support_ticket_summary IS 'Summary view of support tickets with workspace and user details';
COMMENT ON VIEW platform_health_dashboard IS 'Dashboard view of platform health metrics';
COMMENT ON VIEW workspace_analytics_summary IS 'Summary analytics for all workspaces';

-- =====================================================
-- 11. GRANT PERMISSIONS (if using RLS)
-- =====================================================

-- Enable Row Level Security on new tables
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE impersonation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE infrastructure_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_whitelist ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for platform admin access
-- Note: These policies assume you have a 'current_user_role' setting
-- You may need to adjust based on your actual authentication setup

-- Platform admin can access all data
CREATE POLICY "platform_admin_full_access" ON audit_logs FOR ALL USING (true);
CREATE POLICY "platform_admin_full_access" ON security_events FOR ALL USING (true);
CREATE POLICY "platform_admin_full_access" ON support_tickets FOR ALL USING (true);
CREATE POLICY "platform_admin_full_access" ON support_responses FOR ALL USING (true);
CREATE POLICY "platform_admin_full_access" ON impersonation_logs FOR ALL USING (true);
CREATE POLICY "platform_admin_full_access" ON infrastructure_metrics FOR ALL USING (true);
CREATE POLICY "platform_admin_full_access" ON ai_model_status FOR ALL USING (true);
CREATE POLICY "platform_admin_full_access" ON platform_analytics FOR ALL USING (true);
CREATE POLICY "platform_admin_full_access" ON system_config FOR ALL USING (true);
CREATE POLICY "platform_admin_full_access" ON ip_whitelist FOR ALL USING (true);

-- =====================================================
-- 12. VERIFICATION QUERIES
-- =====================================================

-- Verify all tables were created successfully
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'audit_logs',
    'security_events', 
    'support_tickets',
    'support_responses',
    'impersonation_logs',
    'infrastructure_metrics',
    'ai_model_status',
    'platform_analytics',
    'system_config',
    'ip_whitelist'
)
ORDER BY table_name;

-- Verify indexes were created
SELECT 
    indexname,
    tablename
FROM pg_indexes 
WHERE tablename IN (
    'audit_logs',
    'security_events', 
    'support_tickets',
    'support_responses',
    'impersonation_logs',
    'infrastructure_metrics',
    'ai_model_status',
    'platform_analytics',
    'system_config',
    'ip_whitelist'
)
ORDER BY tablename, indexname;

-- Verify views were created
SELECT 
    viewname,
    definition
FROM pg_views 
WHERE viewname IN (
    'recent_security_events',
    'support_ticket_summary',
    'platform_health_dashboard',
    'workspace_analytics_summary'
)
ORDER BY viewname;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- This migration script has successfully created all necessary tables,
-- indexes, views, and sample data for the SynqForge dual admin architecture.
-- 
-- The following features are now available:
-- 1. Comprehensive audit logging system
-- 2. Security event monitoring and alerting
-- 3. Customer support ticket management
-- 4. Infrastructure and AI model monitoring
-- 5. Platform analytics and reporting
-- 6. System configuration management
-- 7. IP whitelist security controls
-- 8. User impersonation audit trails
--
-- All existing data has been preserved and the new tables are ready for use. 