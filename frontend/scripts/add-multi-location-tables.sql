-- Add Multi-Location Tables to LocalOps AI
-- Run this SQL in your Supabase SQL Editor

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

-- Create inventory_transfers table
CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id SERIAL PRIMARY KEY,
  item_id INTEGER, -- Will reference inventory_items when that table is created
  from_location_id INTEGER REFERENCES public.locations(id) ON DELETE CASCADE,
  to_location_id INTEGER REFERENCES public.locations(id) ON DELETE CASCADE,
  quantity DECIMAL(10,2) NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  requested_by INTEGER REFERENCES public.staff(id),
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
  protocol_id INTEGER, -- Will reference emergency_protocols when that table is created
  status VARCHAR(20) DEFAULT 'active',
  actions_taken JSONB DEFAULT '[]'::jsonb,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
  average_wait_time INTEGER, -- in minutes
  service_rating DECIMAL(2,1),
  customer_satisfaction_score DECIMAL(3,2),
  table_turnover_rate DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable Row Level Security for new tables
ALTER TABLE public.locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_incidents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_metrics DISABLE ROW LEVEL SECURITY;

-- Insert demo locations for the demo business
INSERT INTO public.locations (business_id, name, address, phone, coordinates) 
VALUES 
  (1, 'London Central', '123 Oxford Street, London, W1D 1BS', '+44 20 7123 4567', '{"lat": 51.5154, "lng": -0.1419}'),
  (1, 'London Bridge', '456 Borough High Street, London, SE1 1AG', '+44 20 7123 4568', '{"lat": 51.5045, "lng": -0.0865}'),
  (1, 'Canary Wharf', '789 West India Quay, London, E14 4AB', '+44 20 7123 4569', '{"lat": 51.5054, "lng": -0.0235}')
ON CONFLICT DO NOTHING;

-- Insert demo staff transfers
INSERT INTO public.staff_transfers (staff_id, from_location_id, to_location_id, transfer_date, transfer_type, reason, status, requested_by)
VALUES 
  (1, 1, 2, CURRENT_DATE + INTERVAL '7 days', 'temporary', 'Covering staff shortage', 'approved', 1),
  (2, 2, 3, CURRENT_DATE + INTERVAL '14 days', 'permanent', 'Promotion to manager position', 'pending', 1)
ON CONFLICT DO NOTHING;

-- Insert demo customer reviews
INSERT INTO public.customer_reviews (business_id, location_id, platform, rating, review_text, reviewer_name, review_date, sentiment_score)
VALUES 
  (1, 1, 'google', 4.5, 'Great food and service!', 'John Smith', CURRENT_DATE - INTERVAL '2 days', 0.8),
  (1, 1, 'tripadvisor', 4.0, 'Good atmosphere, friendly staff', 'Sarah Johnson', CURRENT_DATE - INTERVAL '5 days', 0.6),
  (1, 2, 'google', 5.0, 'Excellent experience!', 'Mike Wilson', CURRENT_DATE - INTERVAL '1 day', 0.9),
  (1, 3, 'facebook', 4.2, 'Nice place, would recommend', 'Emma Davis', CURRENT_DATE - INTERVAL '3 days', 0.7)
ON CONFLICT DO NOTHING;

-- Insert demo service metrics
INSERT INTO public.service_metrics (business_id, location_id, metric_date, average_wait_time, service_rating, customer_satisfaction_score, table_turnover_rate)
VALUES 
  (1, 1, CURRENT_DATE - INTERVAL '1 day', 15, 4.5, 0.85, 2.3),
  (1, 2, CURRENT_DATE - INTERVAL '1 day', 12, 4.8, 0.92, 2.1),
  (1, 3, CURRENT_DATE - INTERVAL '1 day', 18, 4.2, 0.78, 2.5)
ON CONFLICT DO NOTHING; 