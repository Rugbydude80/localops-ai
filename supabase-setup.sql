-- LocalOps AI Database Setup
-- Run this SQL in your Supabase SQL Editor

-- Create businesses table
CREATE TABLE IF NOT EXISTS public.businesses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  phone_number VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  owner_name VARCHAR(255),
  subscription_tier VARCHAR(50) DEFAULT 'starter',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create staff table
CREATE TABLE IF NOT EXISTS public.staff (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES public.businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(100) NOT NULL,
  skills JSONB DEFAULT '[]'::jsonb,
  availability JSONB DEFAULT '{}'::jsonb,
  reliability_score DECIMAL(3,1) DEFAULT 5.0,
  is_active BOOLEAN DEFAULT true,
  hired_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_shift_date TIMESTAMP WITH TIME ZONE
);

-- Create emergency_requests table
CREATE TABLE IF NOT EXISTS public.emergency_requests (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES public.businesses(id) ON DELETE CASCADE,
  shift_date TIMESTAMP WITH TIME ZONE NOT NULL,
  shift_start VARCHAR(10) NOT NULL,
  shift_end VARCHAR(10) NOT NULL,
  required_skill VARCHAR(100) NOT NULL,
  urgency VARCHAR(20) DEFAULT 'normal',
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  filled_by INTEGER REFERENCES public.staff(id),
  filled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create shift_coverage table
CREATE TABLE IF NOT EXISTS public.shift_coverage (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES public.emergency_requests(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES public.staff(id) ON DELETE CASCADE,
  response VARCHAR(20) NOT NULL,
  response_time_minutes INTEGER,
  responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create message_logs table
CREATE TABLE IF NOT EXISTS public.message_logs (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES public.staff(id) ON DELETE CASCADE,
  request_id INTEGER REFERENCES public.emergency_requests(id),
  message_type VARCHAR(50) NOT NULL,
  platform VARCHAR(20) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  message_content TEXT NOT NULL,
  external_message_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'sent',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE
);

-- Create shifts table
CREATE TABLE IF NOT EXISTS public.shifts (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES public.businesses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  required_skill VARCHAR(100) NOT NULL,
  required_staff_count INTEGER DEFAULT 1,
  hourly_rate DECIMAL(5,2),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shift_assignments table
CREATE TABLE IF NOT EXISTS public.shift_assignments (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER REFERENCES public.shifts(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES public.staff(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'assigned',
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE
);

-- Create sick_leave_requests table
CREATE TABLE IF NOT EXISTS public.sick_leave_requests (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER REFERENCES public.staff(id) ON DELETE CASCADE,
  shift_id INTEGER REFERENCES public.shifts(id) ON DELETE CASCADE,
  business_id INTEGER REFERENCES public.businesses(id) ON DELETE CASCADE,
  reason VARCHAR(50) DEFAULT 'sick',
  message TEXT,
  reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  replacement_found BOOLEAN DEFAULT false,
  replacement_staff_id INTEGER REFERENCES public.staff(id)
);

-- Disable Row Level Security for all tables (for demo purposes)
ALTER TABLE public.businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_coverage DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sick_leave_requests DISABLE ROW LEVEL SECURITY;

-- Insert demo business
INSERT INTO public.businesses (name, type, phone_number, email, address, owner_name, subscription_tier) 
VALUES ('LocalOps Demo Restaurant', 'restaurant', '+44 20 7123 4567', 'demo@localops.ai', '123 Demo Street, London, SW1A 1AA', 'Demo Owner', 'professional')
ON CONFLICT DO NOTHING;