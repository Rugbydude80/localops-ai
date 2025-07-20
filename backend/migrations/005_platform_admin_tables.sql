-- Migration 005: Platform Admin Tables
-- Creates tables for platform administration, audit logging, and security

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER REFERENCES staff(id),
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(50),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(255),
    severity VARCHAR(20) DEFAULT 'info',
    workspace_id VARCHAR(50),
    user_type VARCHAR(20)
);

-- Security Events Table
CREATE TABLE IF NOT EXISTS security_events (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event_type VARCHAR(50) NOT NULL,
    user_id INTEGER REFERENCES staff(id),
    user_email VARCHAR(255),
    ip_address VARCHAR(45),
    details JSONB,
    severity VARCHAR(20) DEFAULT 'warning',
    resolved INTEGER DEFAULT 0
);

-- Support Tickets Table
CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    workspace_id INTEGER REFERENCES businesses(id),
    user_id INTEGER REFERENCES staff(id),
    user_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'open',
    category VARCHAR(50),
    assigned_to INTEGER REFERENCES staff(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    response_time_minutes INTEGER,
    satisfaction_rating INTEGER
);

-- Support Ticket Responses Table
CREATE TABLE IF NOT EXISTS support_responses (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES staff(id),
    user_email VARCHAR(255) NOT NULL,
    response TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Impersonation Logs Table
CREATE TABLE IF NOT EXISTS impersonation_logs (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER REFERENCES staff(id),
    admin_email VARCHAR(255) NOT NULL,
    target_user_id INTEGER REFERENCES staff(id),
    target_email VARCHAR(255) NOT NULL,
    workspace_id INTEGER REFERENCES businesses(id),
    reason TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Infrastructure Monitoring Table
CREATE TABLE IF NOT EXISTS infrastructure_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    metric_unit VARCHAR(20),
    component VARCHAR(50),
    severity VARCHAR(20) DEFAULT 'info',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details JSONB
);

-- AI Model Status Table
CREATE TABLE IF NOT EXISTS ai_model_status (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50),
    status VARCHAR(20) DEFAULT 'operational',
    accuracy DECIMAL(5,2),
    last_trained TIMESTAMP,
    training_duration_minutes INTEGER,
    performance_metrics JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platform Analytics Table
CREATE TABLE IF NOT EXISTS platform_analytics (
    id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,2) NOT NULL,
    workspace_id INTEGER REFERENCES businesses(id),
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(metric_date, metric_name, workspace_id)
);

-- System Configuration Table
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    config_type VARCHAR(20) DEFAULT 'string',
    description TEXT,
    is_sensitive BOOLEAN DEFAULT FALSE,
    updated_by INTEGER REFERENCES staff(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- IP Whitelist Table
CREATE TABLE IF NOT EXISTS ip_whitelist (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    description TEXT,
    added_by INTEGER REFERENCES staff(id),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON audit_logs(workspace_id);

CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON security_events(resolved);

CREATE INDEX IF NOT EXISTS idx_support_tickets_workspace_id ON support_tickets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at);

CREATE INDEX IF NOT EXISTS idx_impersonation_logs_admin_user_id ON impersonation_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_target_user_id ON impersonation_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_started_at ON impersonation_logs(started_at);

CREATE INDEX IF NOT EXISTS idx_infrastructure_metrics_timestamp ON infrastructure_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_infrastructure_metrics_component ON infrastructure_metrics(component);

CREATE INDEX IF NOT EXISTS idx_ai_model_status_model_name ON ai_model_status(model_name);
CREATE INDEX IF NOT EXISTS idx_ai_model_status_status ON ai_model_status(status);

CREATE INDEX IF NOT EXISTS idx_platform_analytics_metric_date ON platform_analytics(metric_date);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_metric_name ON platform_analytics(metric_name);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_workspace_id ON platform_analytics(workspace_id);

-- Insert default system configuration
INSERT INTO system_config (config_key, config_value, config_type, description) VALUES
('platform_name', 'SynqForge', 'string', 'Platform name'),
('max_workspaces', '10000', 'integer', 'Maximum number of workspaces'),
('default_subscription_tier', 'starter', 'string', 'Default subscription tier for new workspaces'),
('session_timeout_minutes', '15', 'integer', 'Session timeout in minutes for platform admins'),
('audit_log_retention_days', '365', 'integer', 'Number of days to retain audit logs'),
('security_alert_threshold', '5', 'integer', 'Number of failed login attempts before security alert'),
('ai_model_retrain_interval_hours', '168', 'integer', 'Hours between AI model retraining'),
('support_response_time_target_minutes', '240', 'integer', 'Target response time for support tickets in minutes')
ON CONFLICT (config_key) DO NOTHING;

-- Insert sample AI model status
INSERT INTO ai_model_status (model_name, model_version, status, accuracy, last_trained) VALUES
('scheduling_engine', 'v1.2.0', 'operational', 94.5, CURRENT_TIMESTAMP - INTERVAL '7 days'),
('constraint_solver', 'v1.1.5', 'operational', 91.2, CURRENT_TIMESTAMP - INTERVAL '14 days'),
('notification_classifier', 'v1.0.8', 'operational', 89.7, CURRENT_TIMESTAMP - INTERVAL '21 days')
ON CONFLICT DO NOTHING;

-- Create views for common queries
CREATE OR REPLACE VIEW recent_security_events AS
SELECT 
    se.*,
    s.first_name,
    s.last_name
FROM security_events se
LEFT JOIN staff s ON se.user_id = s.id
WHERE se.timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY se.timestamp DESC;

CREATE OR REPLACE VIEW support_ticket_summary AS
SELECT 
    st.*,
    b.name as workspace_name,
    s.first_name,
    s.last_name,
    COUNT(sr.id) as response_count
FROM support_tickets st
LEFT JOIN businesses b ON st.workspace_id = b.id
LEFT JOIN staff s ON st.user_id = s.id
LEFT JOIN support_responses sr ON st.id = sr.ticket_id
GROUP BY st.id, b.name, s.first_name, s.last_name;

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

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail of all platform and workspace admin actions';
COMMENT ON TABLE security_events IS 'Security events and incidents for monitoring and alerting';
COMMENT ON TABLE support_tickets IS 'Customer support ticket management system';
COMMENT ON TABLE impersonation_logs IS 'Log of admin user impersonation sessions for security auditing';
COMMENT ON TABLE infrastructure_metrics IS 'System infrastructure monitoring metrics';
COMMENT ON TABLE ai_model_status IS 'AI model health and performance monitoring';
COMMENT ON TABLE platform_analytics IS 'Platform-wide analytics and metrics';
COMMENT ON TABLE system_config IS 'System configuration settings for platform administration';
COMMENT ON TABLE ip_whitelist IS 'IP address whitelist for enhanced security access control'; 