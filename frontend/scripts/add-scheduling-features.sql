-- Add advanced scheduling features to LocalOps AI
-- Run this SQL in your Supabase SQL Editor

-- Add columns to staff table for scheduling constraints
ALTER TABLE public.staff 
ADD COLUMN IF NOT EXISTS max_weekly_hours INTEGER DEFAULT 40,
ADD COLUMN IF NOT EXISTS unavailable_times JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS contract_type VARCHAR(20) DEFAULT 'full_time';

-- Create staff_availability table for tracking time off
CREATE TABLE IF NOT EXISTS public.staff_availability (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER REFERENCES public.staff(id) ON DELETE CASCADE,
  business_id INTEGER REFERENCES public.businesses(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  availability_type VARCHAR(20) NOT NULL, -- 'holiday', 'sick_leave', 'unavailable', 'available'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reason TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_by INTEGER REFERENCES public.staff(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Create weekly_hours_tracking table
CREATE TABLE IF NOT EXISTS public.weekly_hours_tracking (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER REFERENCES public.staff(id) ON DELETE CASCADE,
  business_id INTEGER REFERENCES public.businesses(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  scheduled_hours DECIMAL(5,2) DEFAULT 0,
  actual_hours DECIMAL(5,2) DEFAULT 0,
  overtime_hours DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(staff_id, week_start_date)
);

-- Create shift_requirements table for detailed shift needs
CREATE TABLE IF NOT EXISTS public.shift_requirements (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER REFERENCES public.shifts(id) ON DELETE CASCADE,
  required_skill VARCHAR(100) NOT NULL,
  required_count INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 1, -- 1=high, 2=medium, 3=low
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS for new tables
ALTER TABLE public.staff_availability DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_hours_tracking DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_requirements DISABLE ROW LEVEL SECURITY;

-- Insert some demo availability data
INSERT INTO public.staff_availability (staff_id, business_id, start_date, end_date, availability_type, status, reason) VALUES
(1, 1, '2025-07-20', '2025-07-22', 'holiday', 'approved', 'Family vacation'),
(2, 1, '2025-07-18', '2025-07-18', 'sick_leave', 'approved', 'Flu symptoms'),
(3, 1, '2025-07-25', '2025-07-27', 'holiday', 'pending', 'Weekend getaway'),
(4, 1, '2025-07-19', '2025-07-19', 'unavailable', 'approved', 'Medical appointment'),
(5, 1, '2025-07-21', '2025-07-23', 'holiday', 'approved', 'Annual leave');

-- Update staff with realistic scheduling constraints
UPDATE public.staff SET 
  max_weekly_hours = 40,
  unavailable_times = '[
    {"day": "sunday", "reason": "religious", "all_day": true},
    {"day": "monday", "start_time": "00:00", "end_time": "09:00", "reason": "school_run"}
  ]'::jsonb,
  contract_type = 'full_time'
WHERE id = 1;

UPDATE public.staff SET 
  max_weekly_hours = 35,
  unavailable_times = '[
    {"day": "tuesday", "start_time": "14:00", "end_time": "16:00", "reason": "therapy"},
    {"day": "saturday", "start_time": "22:00", "end_time": "23:59", "reason": "transport"}
  ]'::jsonb,
  contract_type = 'part_time'
WHERE id = 2;

UPDATE public.staff SET 
  max_weekly_hours = 25,
  unavailable_times = '[
    {"day": "monday", "all_day": true, "reason": "university"},
    {"day": "wednesday", "all_day": true, "reason": "university"},
    {"day": "friday", "start_time": "09:00", "end_time": "13:00", "reason": "lectures"}
  ]'::jsonb,
  contract_type = 'student'
WHERE id = 3;

UPDATE public.staff SET 
  max_weekly_hours = 40,
  unavailable_times = '[
    {"day": "sunday", "start_time": "00:00", "end_time": "12:00", "reason": "family_time"}
  ]'::jsonb,
  contract_type = 'full_time'
WHERE id = 4;

UPDATE public.staff SET 
  max_weekly_hours = 45,
  unavailable_times = '[]'::jsonb,
  contract_type = 'full_time'
WHERE id = 5;

UPDATE public.staff SET 
  max_weekly_hours = 30,
  unavailable_times = '[
    {"day": "thursday", "start_time": "18:00", "end_time": "20:00", "reason": "evening_class"},
    {"day": "sunday", "start_time": "10:00", "end_time": "14:00", "reason": "volunteer_work"}
  ]'::jsonb,
  contract_type = 'part_time'
WHERE id = 6;