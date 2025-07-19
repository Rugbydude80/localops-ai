-- Complete Multi-Location Setup for LocalOps AI
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
-- 8. DEMO DATA FOR MULTIPLE BUSINESSES
-- ============================================================================

-- Insert demo suppliers for business 1
INSERT INTO public.suppliers (business_id, name, contact_person, phone, email, categories, reliability_score, is_preferred) 
VALUES 
  (1, 'Fresh Foods Ltd', 'John Smith', '+44 20 7123 4001', 'john@freshfoods.co.uk', '["produce", "dairy"]', 8.5, true),
  (1, 'Quality Meats', 'Sarah Johnson', '+44 20 7123 4002', 'sarah@qualitymeats.co.uk', '["meat", "poultry"]', 9.0, true),
  (1, 'Beverage Supply Co', 'Mike Wilson', '+44 20 7123 4003', 'mike@beveragesupply.co.uk', '["beverages", "alcohol"]', 7.5, false)
ON CONFLICT DO NOTHING;

-- Insert demo inventory items for business 1
INSERT INTO public.inventory_items (business_id, name, category, unit, current_stock, minimum_stock, cost_per_unit, supplier_id, is_active) 
VALUES 
  (1, 'Fresh Tomatoes', 'produce', 'kg', 25.5, 10.0, 2.50, 1, true),
  (1, 'Chicken Breast', 'meat', 'kg', 15.0, 8.0, 8.75, 2, true),
  (1, 'Red Wine', 'beverages', 'bottles', 48, 20, 12.00, 3, true),
  (1, 'Milk', 'dairy', 'liters', 30.0, 15.0, 1.20, 1, true),
  (1, 'Beef Mince', 'meat', 'kg', 12.5, 6.0, 9.50, 2, true)
ON CONFLICT DO NOTHING;

-- Insert demo locations for business 1 (assuming business_id = 1 exists)
INSERT INTO public.locations (business_id, name, address, phone, coordinates) 
VALUES 
  (1, 'London Central', '123 Oxford Street, London, W1D 1BS', '+44 20 7123 4567', '{"lat": 51.5154, "lng": -0.1419}'),
  (1, 'London Bridge', '456 Borough High Street, London, SE1 1AG', '+44 20 7123 4568', '{"lat": 51.5045, "lng": -0.0865}'),
  (1, 'Canary Wharf', '789 West India Quay, London, E14 4AB', '+44 20 7123 4569', '{"lat": 51.5054, "lng": -0.0235}')
ON CONFLICT DO NOTHING;

-- Insert demo staff transfers (assuming staff_id 1 and 2 exist)
INSERT INTO public.staff_transfers (staff_id, from_location_id, to_location_id, transfer_date, transfer_type, reason, status, requested_by)
VALUES 
  (1, 1, 2, CURRENT_DATE + INTERVAL '7 days', 'temporary', 'Covering staff shortage', 'approved', 1),
  (2, 2, 3, CURRENT_DATE + INTERVAL '14 days', 'permanent', 'Promotion to manager position', 'pending', 1)
ON CONFLICT DO NOTHING;

-- Insert demo inventory transfers
INSERT INTO public.inventory_transfers (item_id, from_location_id, to_location_id, quantity, reason, status, requested_by)
VALUES 
  (1, 1, 2, 5.0, 'Stock balancing', 'completed', 1),
  (2, 2, 3, 3.0, 'Special event preparation', 'pending', 1)
ON CONFLICT DO NOTHING;

-- Insert demo emergency protocols
INSERT INTO public.emergency_protocols (business_id, emergency_type, protocol_name, automated_actions, notification_list, escalation_rules)
VALUES 
  (1, 'equipment_failure', 'Kitchen Equipment Failure', '["shutdown_equipment", "notify_maintenance"]', '["manager", "maintenance_team"]', '{"escalate_after_hours": 2}'),
  (1, 'staff_shortage', 'Emergency Staff Shortage', '["notify_available_staff", "activate_backup_list"]', '["manager", "hr_team"]', '{"escalate_after_hours": 1}'),
  (1, 'health_incident', 'Health and Safety Incident', '["isolate_area", "call_emergency_services"]', '["manager", "first_aider", "emergency_services"]', '{"escalate_immediately": true}')
ON CONFLICT DO NOTHING;

-- Insert demo emergency incidents
INSERT INTO public.emergency_incidents (business_id, location_id, emergency_type, severity, description, reported_by, protocol_id, status)
VALUES 
  (1, 1, 'equipment_failure', 'medium', 'Oven temperature control malfunction', 1, 1, 'resolved'),
  (1, 2, 'staff_shortage', 'high', 'Multiple staff called in sick', 1, 2, 'active')
ON CONFLICT DO NOTHING;

-- Insert demo customer reviews
INSERT INTO public.customer_reviews (business_id, location_id, platform, rating, review_text, reviewer_name, review_date, sentiment_score)
VALUES 
  (1, 1, 'google', 4.5, 'Great food and service!', 'John Smith', CURRENT_DATE - INTERVAL '2 days', 0.8),
  (1, 1, 'tripadvisor', 4.0, 'Good atmosphere, friendly staff', 'Sarah Johnson', CURRENT_DATE - INTERVAL '5 days', 0.6),
  (1, 2, 'google', 5.0, 'Excellent experience!', 'Mike Wilson', CURRENT_DATE - INTERVAL '1 day', 0.9),
  (1, 3, 'facebook', 4.2, 'Nice place, would recommend', 'Emma Davis', CURRENT_DATE - INTERVAL '3 days', 0.7),
  (1, 2, 'google', 4.8, 'Amazing food quality', 'David Brown', CURRENT_DATE - INTERVAL '4 days', 0.85),
  (1, 3, 'tripadvisor', 3.8, 'Good but a bit slow', 'Lisa Green', CURRENT_DATE - INTERVAL '6 days', 0.4)
ON CONFLICT DO NOTHING;

-- Insert demo service metrics
INSERT INTO public.service_metrics (business_id, location_id, metric_date, average_wait_time, service_rating, customer_satisfaction, table_turnover_rate, complaint_count, compliment_count)
VALUES 
  (1, 1, CURRENT_DATE - INTERVAL '1 day', 15, 4.5, 0.85, 2.3, 2, 8),
  (1, 2, CURRENT_DATE - INTERVAL '1 day', 12, 4.8, 0.92, 2.1, 1, 12),
  (1, 3, CURRENT_DATE - INTERVAL '1 day', 18, 4.2, 0.78, 2.5, 3, 6),
  (1, 1, CURRENT_DATE - INTERVAL '2 days', 14, 4.6, 0.88, 2.2, 1, 9),
  (1, 2, CURRENT_DATE - INTERVAL '2 days', 11, 4.9, 0.94, 2.0, 0, 15),
  (1, 3, CURRENT_DATE - INTERVAL '2 days', 16, 4.3, 0.82, 2.4, 2, 7)
ON CONFLICT DO NOTHING;

-- Insert demo staff performance metrics
INSERT INTO public.staff_performance_metrics (staff_id, metric_date, customer_rating, punctuality_score, reliability_score, customer_mentions, positive_mentions, training_completion_rate)
VALUES 
  (1, CURRENT_DATE - INTERVAL '1 day', 4.7, 0.95, 0.92, 3, 3, 0.85),
  (2, CURRENT_DATE - INTERVAL '1 day', 4.5, 0.88, 0.89, 2, 2, 0.90),
  (1, CURRENT_DATE - INTERVAL '2 days', 4.6, 0.93, 0.91, 2, 2, 0.85),
  (2, CURRENT_DATE - INTERVAL '2 days', 4.4, 0.90, 0.87, 1, 1, 0.90)
ON CONFLICT DO NOTHING;

-- Insert demo inventory predictions
INSERT INTO public.inventory_predictions (business_id, item_id, prediction_date, predicted_usage, reorder_recommendation, urgency_level, factors)
VALUES 
  (1, 1, CURRENT_DATE + INTERVAL '7 days', 30.0, 15.0, 'normal', '{"historical_usage": 28.5, "seasonal_factor": 1.05}'),
  (1, 2, CURRENT_DATE + INTERVAL '7 days', 20.0, 12.0, 'high', '{"historical_usage": 18.0, "special_events": ["weekend_rush"]}'),
  (1, 3, CURRENT_DATE + INTERVAL '7 days', 60, 25, 'normal', '{"historical_usage": 55, "weekend_factor": 1.1}')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 9. VALIDATION QUERIES (Optional - can be run to verify setup)
-- ============================================================================

-- Uncomment these lines to verify the setup worked correctly:
-- SELECT 'Locations' as table_name, COUNT(*) as record_count FROM public.locations
-- UNION ALL
-- SELECT 'Staff Transfers', COUNT(*) FROM public.staff_transfers
-- UNION ALL
-- SELECT 'Inventory Items', COUNT(*) FROM public.inventory_items
-- UNION ALL
-- SELECT 'Customer Reviews', COUNT(*) FROM public.customer_reviews
-- UNION ALL
-- SELECT 'Service Metrics', COUNT(*) FROM public.service_metrics;

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================

-- The multi-location feature is now ready to use!
-- Visit http://localhost:3000/enhanced-dashboard and click on "Multi-Location"
-- You should see 3 demo locations with full functionality 