-- Complete Multi-Location Setup for LocalOps AI (FIXED VERSION)
-- This script creates all necessary tables and demo data for multi-location functionality
-- Run this SQL in your Supabase SQL Editor

-- ============================================================================
-- 1. CORE MULTI-LOCATION TABLES
-- ============================================================================

-- Create locations table
CREATE TABLE IF NOT EXISTS public.locations (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES public.businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  manager_id INTEGER REFERENCES public.staff(id),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  coordinates JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create staff_transfers table
CREATE TABLE IF NOT EXISTS public.staff_transfers (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER REFERENCES public.staff(id) ON DELETE CASCADE,
  from_location_id INTEGER REFERENCES public.locations(id) ON DELETE CASCADE,
  to_location_id INTEGER REFERENCES public.locations(id) ON DELETE CASCADE,
  transfer_date DATE NOT NULL,
  transfer_type VARCHAR(20) DEFAULT 'temporary',
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  requested_by INTEGER REFERENCES public.staff(id),
  approved_by INTEGER REFERENCES public.staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. INVENTORY SYSTEM TABLES
-- ============================================================================

-- Create suppliers table (needed for inventory)
CREATE TABLE IF NOT EXISTS public.suppliers (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES public.businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(255),
  categories JSONB DEFAULT '[]'::jsonb,
  reliability_score DECIMAL(3,1) DEFAULT 5.0,
  average_delivery_days INTEGER DEFAULT 2,
  is_preferred BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create inventory_items table
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES public.businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  unit VARCHAR(20) DEFAULT 'kg',
  current_stock DECIMAL(10,2) DEFAULT 0,
  minimum_stock DECIMAL(10,2) DEFAULT 0,
  maximum_stock DECIMAL(10,2),
  cost_per_unit DECIMAL(10,2),
  supplier_id INTEGER REFERENCES public.suppliers(id),
  expiry_tracking BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create inventory_transfers table
CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  from_location_id INTEGER REFERENCES public.locations(id) ON DELETE CASCADE,
  to_location_id INTEGER REFERENCES public.locations(id) ON DELETE CASCADE,
  quantity DECIMAL(10,2) NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  requested_by INTEGER REFERENCES public.staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. EMERGENCY RESPONSE TABLES
-- ============================================================================

-- Create emergency_protocols table
CREATE TABLE IF NOT EXISTS public.emergency_protocols (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES public.businesses(id) ON DELETE CASCADE,
  emergency_type VARCHAR(100) NOT NULL,
  protocol_name VARCHAR(255) NOT NULL,
  automated_actions JSONB DEFAULT '[]'::jsonb,
  notification_list JSONB DEFAULT '[]'::jsonb,
  escalation_rules JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create emergency_incidents table
CREATE TABLE IF NOT EXISTS public.emergency_incidents (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES public.businesses(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES public.locations(id),
  emergency_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  description TEXT NOT NULL,
  reported_by INTEGER REFERENCES public.staff(id),
  protocol_id INTEGER REFERENCES public.emergency_protocols(id),
  status VARCHAR(20) DEFAULT 'active',
  actions_taken JSONB DEFAULT '[]'::jsonb,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. CUSTOMER EXPERIENCE TABLES
-- ============================================================================

-- Create customer_reviews table
CREATE TABLE IF NOT EXISTS public.customer_reviews (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES public.businesses(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES public.locations(id),
  platform VARCHAR(50) NOT NULL,
  rating DECIMAL(2,1) NOT NULL,
  review_text TEXT,
  reviewer_name VARCHAR(255),
  review_date TIMESTAMP WITH TIME ZONE NOT NULL,
  sentiment_score DECIMAL(3,2),
  mentioned_staff JSONB DEFAULT '[]'::jsonb,
  service_aspects JSONB DEFAULT '{}'::jsonb,
  response_generated BOOLEAN DEFAULT false,
  external_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create service_metrics table
CREATE TABLE IF NOT EXISTS public.service_metrics (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES public.businesses(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES public.locations(id),
  metric_date DATE NOT NULL,
  hour INTEGER,
  average_wait_time INTEGER,
  service_rating DECIMAL(2,1),
  staff_performance_score DECIMAL(3,2),
  customer_satisfaction DECIMAL(3,2),
  table_turnover_rate DECIMAL(5,2),
  complaint_count INTEGER DEFAULT 0,
  compliment_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. ADDITIONAL SUPPORTING TABLES
-- ============================================================================

-- Create staff_performance_metrics table
CREATE TABLE IF NOT EXISTS public.staff_performance_metrics (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER REFERENCES public.staff(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  customer_rating DECIMAL(2,1),
  punctuality_score DECIMAL(3,2),
  reliability_score DECIMAL(3,2),
  customer_mentions INTEGER DEFAULT 0,
  positive_mentions INTEGER DEFAULT 0,
  negative_mentions INTEGER DEFAULT 0,
  training_completion_rate DECIMAL(3,2),
  skill_improvement_score DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create inventory_predictions table
CREATE TABLE IF NOT EXISTS public.inventory_predictions (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES public.businesses(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  prediction_date DATE NOT NULL,
  predicted_usage DECIMAL(10,2),
  reorder_recommendation DECIMAL(10,2),
  urgency_level VARCHAR(20) DEFAULT 'normal',
  factors JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 6. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Location indexes
CREATE INDEX IF NOT EXISTS idx_locations_business_id ON public.locations(business_id);
CREATE INDEX IF NOT EXISTS idx_locations_is_active ON public.locations(is_active);
CREATE INDEX IF NOT EXISTS idx_locations_manager_id ON public.locations(manager_id);

-- Staff transfer indexes
CREATE INDEX IF NOT EXISTS idx_staff_transfers_staff_id ON public.staff_transfers(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_transfers_from_location ON public.staff_transfers(from_location_id);
CREATE INDEX IF NOT EXISTS idx_staff_transfers_to_location ON public.staff_transfers(to_location_id);
CREATE INDEX IF NOT EXISTS idx_staff_transfers_status ON public.staff_transfers(status);
CREATE INDEX IF NOT EXISTS idx_staff_transfers_date ON public.staff_transfers(transfer_date);

-- Inventory indexes
CREATE INDEX IF NOT EXISTS idx_inventory_items_business_id ON public.inventory_items(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_is_active ON public.inventory_items(is_active);

-- Inventory transfer indexes
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_item_id ON public.inventory_transfers(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_from_location ON public.inventory_transfers(from_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_to_location ON public.inventory_transfers(to_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_status ON public.inventory_transfers(status);

-- Emergency indexes
CREATE INDEX IF NOT EXISTS idx_emergency_incidents_business_id ON public.emergency_incidents(business_id);
CREATE INDEX IF NOT EXISTS idx_emergency_incidents_location_id ON public.emergency_incidents(location_id);
CREATE INDEX IF NOT EXISTS idx_emergency_incidents_status ON public.emergency_incidents(status);
CREATE INDEX IF NOT EXISTS idx_emergency_incidents_created_at ON public.emergency_incidents(created_at);

-- Customer review indexes
CREATE INDEX IF NOT EXISTS idx_customer_reviews_business_id ON public.customer_reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_location_id ON public.customer_reviews(location_id);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_platform ON public.customer_reviews(platform);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_review_date ON public.customer_reviews(review_date);

-- Service metrics indexes
CREATE INDEX IF NOT EXISTS idx_service_metrics_business_id ON public.service_metrics(business_id);
CREATE INDEX IF NOT EXISTS idx_service_metrics_location_id ON public.service_metrics(location_id);
CREATE INDEX IF NOT EXISTS idx_service_metrics_date ON public.service_metrics(metric_date);

-- ============================================================================
-- 7. DISABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_protocols DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_incidents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_performance_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_predictions DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. CHECK EXISTING DATA AND GET VALID IDs
-- ============================================================================

-- Get the first business ID (we'll use this for demo data)
DO $$
DECLARE
    first_business_id INTEGER;
    first_staff_id INTEGER;
    second_staff_id INTEGER;
BEGIN
    -- Get the first business ID
    SELECT id INTO first_business_id FROM public.businesses LIMIT 1;
    
    -- Get the first two staff IDs
    SELECT id INTO first_staff_id FROM public.staff WHERE business_id = first_business_id LIMIT 1;
    SELECT id INTO second_staff_id FROM public.staff WHERE business_id = first_business_id AND id != first_staff_id LIMIT 1;
    
    -- If we don't have enough staff, create some demo staff
    IF first_staff_id IS NULL THEN
        INSERT INTO public.staff (business_id, name, phone_number, email, role, skills, is_active)
        VALUES 
            (first_business_id, 'Demo Manager', '+44 20 7123 4001', 'manager@demo.com', 'manager', '["management", "kitchen"]', true),
            (first_business_id, 'Demo Chef', '+44 20 7123 4002', 'chef@demo.com', 'chef', '["kitchen", "cooking"]', true)
        RETURNING id INTO first_staff_id;
        
        SELECT id INTO second_staff_id FROM public.staff WHERE business_id = first_business_id AND id != first_staff_id LIMIT 1;
    END IF;
    
    -- Store the IDs in a temporary table for use in inserts
    CREATE TEMP TABLE demo_ids AS 
    SELECT 
        first_business_id as business_id,
        first_staff_id as staff_id_1,
        second_staff_id as staff_id_2;
END $$;

-- ============================================================================
-- 9. INSERT DEMO DATA WITH VALID REFERENCES
-- ============================================================================

-- Insert demo suppliers for the first business
INSERT INTO public.suppliers (business_id, name, contact_person, phone, email, categories, reliability_score, is_preferred) 
SELECT 
    demo_ids.business_id,
    'Fresh Foods Ltd',
    'John Smith',
    '+44 20 7123 4001',
    'john@freshfoods.co.uk',
    '["produce", "dairy"]'::jsonb,
    8.5,
    true
FROM demo_ids
WHERE demo_ids.business_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.suppliers (business_id, name, contact_person, phone, email, categories, reliability_score, is_preferred) 
SELECT 
    demo_ids.business_id,
    'Quality Meats',
    'Sarah Johnson',
    '+44 20 7123 4002',
    'sarah@qualitymeats.co.uk',
    '["meat", "poultry"]'::jsonb,
    9.0,
    true
FROM demo_ids
WHERE demo_ids.business_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.suppliers (business_id, name, contact_person, phone, email, categories, reliability_score, is_preferred) 
SELECT 
    demo_ids.business_id,
    'Beverage Supply Co',
    'Mike Wilson',
    '+44 20 7123 4003',
    'mike@beveragesupply.co.uk',
    '["beverages", "alcohol"]'::jsonb,
    7.5,
    false
FROM demo_ids
WHERE demo_ids.business_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Insert demo inventory items
INSERT INTO public.inventory_items (business_id, name, category, unit, current_stock, minimum_stock, cost_per_unit, supplier_id, is_active) 
SELECT 
    demo_ids.business_id,
    'Fresh Tomatoes',
    'produce',
    'kg',
    25.5,
    10.0,
    2.50,
    s.id,
    true
FROM demo_ids, public.suppliers s
WHERE demo_ids.business_id IS NOT NULL 
  AND s.business_id = demo_ids.business_id 
  AND s.name = 'Fresh Foods Ltd'
ON CONFLICT DO NOTHING;

INSERT INTO public.inventory_items (business_id, name, category, unit, current_stock, minimum_stock, cost_per_unit, supplier_id, is_active) 
SELECT 
    demo_ids.business_id,
    'Chicken Breast',
    'meat',
    'kg',
    15.0,
    8.0,
    8.75,
    s.id,
    true
FROM demo_ids, public.suppliers s
WHERE demo_ids.business_id IS NOT NULL 
  AND s.business_id = demo_ids.business_id 
  AND s.name = 'Quality Meats'
ON CONFLICT DO NOTHING;

INSERT INTO public.inventory_items (business_id, name, category, unit, current_stock, minimum_stock, cost_per_unit, supplier_id, is_active) 
SELECT 
    demo_ids.business_id,
    'Red Wine',
    'beverages',
    'bottles',
    48,
    20,
    12.00,
    s.id,
    true
FROM demo_ids, public.suppliers s
WHERE demo_ids.business_id IS NOT NULL 
  AND s.business_id = demo_ids.business_id 
  AND s.name = 'Beverage Supply Co'
ON CONFLICT DO NOTHING;

-- Insert demo locations
INSERT INTO public.locations (business_id, name, address, phone, coordinates) 
SELECT 
    demo_ids.business_id,
    'London Central',
    '123 Oxford Street, London, W1D 1BS',
    '+44 20 7123 4567',
    '{"lat": 51.5154, "lng": -0.1419}'::jsonb
FROM demo_ids
WHERE demo_ids.business_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.locations (business_id, name, address, phone, coordinates) 
SELECT 
    demo_ids.business_id,
    'London Bridge',
    '456 Borough High Street, London, SE1 1AG',
    '+44 20 7123 4568',
    '{"lat": 51.5045, "lng": -0.0865}'::jsonb
FROM demo_ids
WHERE demo_ids.business_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.locations (business_id, name, address, phone, coordinates) 
SELECT 
    demo_ids.business_id,
    'Canary Wharf',
    '789 West India Quay, London, E14 4AB',
    '+44 20 7123 4569',
    '{"lat": 51.5054, "lng": -0.0235}'::jsonb
FROM demo_ids
WHERE demo_ids.business_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Insert demo staff transfers (only if we have valid staff and locations)
INSERT INTO public.staff_transfers (staff_id, from_location_id, to_location_id, transfer_date, transfer_type, reason, status, requested_by)
SELECT 
    demo_ids.staff_id_1,
    l1.id,
    l2.id,
    CURRENT_DATE + INTERVAL '7 days',
    'temporary',
    'Covering staff shortage',
    'approved',
    demo_ids.staff_id_1
FROM demo_ids, public.locations l1, public.locations l2
WHERE demo_ids.staff_id_1 IS NOT NULL 
  AND demo_ids.business_id IS NOT NULL
  AND l1.business_id = demo_ids.business_id 
  AND l1.name = 'London Central'
  AND l2.business_id = demo_ids.business_id 
  AND l2.name = 'London Bridge'
ON CONFLICT DO NOTHING;

INSERT INTO public.staff_transfers (staff_id, from_location_id, to_location_id, transfer_date, transfer_type, reason, status, requested_by)
SELECT 
    demo_ids.staff_id_2,
    l1.id,
    l2.id,
    CURRENT_DATE + INTERVAL '14 days',
    'permanent',
    'Promotion to manager position',
    'pending',
    demo_ids.staff_id_1
FROM demo_ids, public.locations l1, public.locations l2
WHERE demo_ids.staff_id_1 IS NOT NULL 
  AND demo_ids.staff_id_2 IS NOT NULL
  AND demo_ids.business_id IS NOT NULL
  AND l1.business_id = demo_ids.business_id 
  AND l1.name = 'London Bridge'
  AND l2.business_id = demo_ids.business_id 
  AND l2.name = 'Canary Wharf'
ON CONFLICT DO NOTHING;

-- Insert demo inventory transfers
INSERT INTO public.inventory_transfers (item_id, from_location_id, to_location_id, quantity, reason, status, requested_by)
SELECT 
    i.id,
    l1.id,
    l2.id,
    5.0,
    'Stock balancing',
    'completed',
    demo_ids.staff_id_1
FROM demo_ids, public.inventory_items i, public.locations l1, public.locations l2
WHERE demo_ids.staff_id_1 IS NOT NULL 
  AND demo_ids.business_id IS NOT NULL
  AND i.business_id = demo_ids.business_id 
  AND i.name = 'Fresh Tomatoes'
  AND l1.business_id = demo_ids.business_id 
  AND l1.name = 'London Central'
  AND l2.business_id = demo_ids.business_id 
  AND l2.name = 'London Bridge'
ON CONFLICT DO NOTHING;

-- Insert demo emergency protocols
INSERT INTO public.emergency_protocols (business_id, emergency_type, protocol_name, automated_actions, notification_list, escalation_rules)
SELECT 
    demo_ids.business_id,
    'equipment_failure',
    'Kitchen Equipment Failure',
    '["shutdown_equipment", "notify_maintenance"]'::jsonb,
    '["manager", "maintenance_team"]'::jsonb,
    '{"escalate_after_hours": 2}'::jsonb
FROM demo_ids
WHERE demo_ids.business_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.emergency_protocols (business_id, emergency_type, protocol_name, automated_actions, notification_list, escalation_rules)
SELECT 
    demo_ids.business_id,
    'staff_shortage',
    'Emergency Staff Shortage',
    '["notify_available_staff", "activate_backup_list"]'::jsonb,
    '["manager", "hr_team"]'::jsonb,
    '{"escalate_after_hours": 1}'::jsonb
FROM demo_ids
WHERE demo_ids.business_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Insert demo emergency incidents
INSERT INTO public.emergency_incidents (business_id, location_id, emergency_type, severity, description, reported_by, protocol_id, status)
SELECT 
    demo_ids.business_id,
    l.id,
    'equipment_failure',
    'medium',
    'Oven temperature control malfunction',
    demo_ids.staff_id_1,
    ep.id,
    'resolved'
FROM demo_ids, public.locations l, public.emergency_protocols ep
WHERE demo_ids.staff_id_1 IS NOT NULL 
  AND demo_ids.business_id IS NOT NULL
  AND l.business_id = demo_ids.business_id 
  AND l.name = 'London Central'
  AND ep.business_id = demo_ids.business_id 
  AND ep.emergency_type = 'equipment_failure'
ON CONFLICT DO NOTHING;

-- Insert demo customer reviews
INSERT INTO public.customer_reviews (business_id, location_id, platform, rating, review_text, reviewer_name, review_date, sentiment_score)
SELECT 
    demo_ids.business_id,
    l.id,
    'google',
    4.5,
    'Great food and service!',
    'John Smith',
    CURRENT_DATE - INTERVAL '2 days',
    0.8
FROM demo_ids, public.locations l
WHERE demo_ids.business_id IS NOT NULL
  AND l.business_id = demo_ids.business_id 
  AND l.name = 'London Central'
ON CONFLICT DO NOTHING;

INSERT INTO public.customer_reviews (business_id, location_id, platform, rating, review_text, reviewer_name, review_date, sentiment_score)
SELECT 
    demo_ids.business_id,
    l.id,
    'tripadvisor',
    4.0,
    'Good atmosphere, friendly staff',
    'Sarah Johnson',
    CURRENT_DATE - INTERVAL '5 days',
    0.6
FROM demo_ids, public.locations l
WHERE demo_ids.business_id IS NOT NULL
  AND l.business_id = demo_ids.business_id 
  AND l.name = 'London Central'
ON CONFLICT DO NOTHING;

INSERT INTO public.customer_reviews (business_id, location_id, platform, rating, review_text, reviewer_name, review_date, sentiment_score)
SELECT 
    demo_ids.business_id,
    l.id,
    'google',
    5.0,
    'Excellent experience!',
    'Mike Wilson',
    CURRENT_DATE - INTERVAL '1 day',
    0.9
FROM demo_ids, public.locations l
WHERE demo_ids.business_id IS NOT NULL
  AND l.business_id = demo_ids.business_id 
  AND l.name = 'London Bridge'
ON CONFLICT DO NOTHING;

-- Insert demo service metrics
INSERT INTO public.service_metrics (business_id, location_id, metric_date, average_wait_time, service_rating, customer_satisfaction, table_turnover_rate, complaint_count, compliment_count)
SELECT 
    demo_ids.business_id,
    l.id,
    CURRENT_DATE - INTERVAL '1 day',
    15,
    4.5,
    0.85,
    2.3,
    2,
    8
FROM demo_ids, public.locations l
WHERE demo_ids.business_id IS NOT NULL
  AND l.business_id = demo_ids.business_id 
  AND l.name = 'London Central'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_metrics (business_id, location_id, metric_date, average_wait_time, service_rating, customer_satisfaction, table_turnover_rate, complaint_count, compliment_count)
SELECT 
    demo_ids.business_id,
    l.id,
    CURRENT_DATE - INTERVAL '1 day',
    12,
    4.8,
    0.92,
    2.1,
    1,
    12
FROM demo_ids, public.locations l
WHERE demo_ids.business_id IS NOT NULL
  AND l.business_id = demo_ids.business_id 
  AND l.name = 'London Bridge'
ON CONFLICT DO NOTHING;

-- Insert demo staff performance metrics
INSERT INTO public.staff_performance_metrics (staff_id, metric_date, customer_rating, punctuality_score, reliability_score, customer_mentions, positive_mentions, training_completion_rate)
SELECT 
    demo_ids.staff_id_1,
    CURRENT_DATE - INTERVAL '1 day',
    4.7,
    0.95,
    0.92,
    3,
    3,
    0.85
FROM demo_ids
WHERE demo_ids.staff_id_1 IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.staff_performance_metrics (staff_id, metric_date, customer_rating, punctuality_score, reliability_score, customer_mentions, positive_mentions, training_completion_rate)
SELECT 
    demo_ids.staff_id_2,
    CURRENT_DATE - INTERVAL '1 day',
    4.5,
    0.88,
    0.89,
    2,
    2,
    0.90
FROM demo_ids
WHERE demo_ids.staff_id_2 IS NOT NULL
ON CONFLICT DO NOTHING;

-- Insert demo inventory predictions
INSERT INTO public.inventory_predictions (business_id, item_id, prediction_date, predicted_usage, reorder_recommendation, urgency_level, factors)
SELECT 
    demo_ids.business_id,
    i.id,
    CURRENT_DATE + INTERVAL '7 days',
    30.0,
    15.0,
    'normal',
    '{"historical_usage": 28.5, "seasonal_factor": 1.05}'::jsonb
FROM demo_ids, public.inventory_items i
WHERE demo_ids.business_id IS NOT NULL
  AND i.business_id = demo_ids.business_id 
  AND i.name = 'Fresh Tomatoes'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. CLEANUP AND VALIDATION
-- ============================================================================

-- Drop the temporary table
DROP TABLE IF EXISTS demo_ids;

-- Show summary of what was created
SELECT 'Setup Complete!' as status;

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================

-- The multi-location feature is now ready to use!
-- Visit http://localhost:3000/enhanced-dashboard and click on "Multi-Location"
-- You should see demo locations with full functionality 