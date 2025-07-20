-- Create scheduling_constraints table in Supabase
-- Execute this SQL in your Supabase SQL editor

-- Create the scheduling_constraints table
CREATE TABLE IF NOT EXISTS scheduling_constraints (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id),
    constraint_type VARCHAR NOT NULL,
    constraint_value JSON NOT NULL,
    priority VARCHAR DEFAULT 'medium',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_constraints_business_type_active 
ON scheduling_constraints (business_id, constraint_type, is_active);

-- Create index for priority-based queries
CREATE INDEX IF NOT EXISTS idx_constraints_priority 
ON scheduling_constraints (priority, is_active);

-- Create index for date-based queries
CREATE INDEX IF NOT EXISTS idx_constraints_created_at 
ON scheduling_constraints (created_at);

-- Insert some sample constraints for business_id = 1
INSERT INTO scheduling_constraints (business_id, constraint_type, constraint_value, priority, is_active) VALUES
(1, 'max_hours_per_week', '{"hours": 40}', 'high', true),
(1, 'min_rest_between_shifts', '{"hours": 8}', 'medium', true),
(1, 'skill_match_required', '{"required": true}', 'critical', true),
(1, 'fair_distribution', '{"enabled": true}', 'medium', true),
(1, 'max_consecutive_shifts', '{"max_shifts": 5}', 'medium', true);

-- Verify the table was created
SELECT 
    'scheduling_constraints table created successfully' as status,
    COUNT(*) as constraint_count
FROM scheduling_constraints; 