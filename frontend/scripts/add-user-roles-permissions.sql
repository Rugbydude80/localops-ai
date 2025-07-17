-- Add user roles and permissions system
-- Run this SQL in your Supabase SQL Editor

-- Create user_roles table for role hierarchy
CREATE TABLE IF NOT EXISTS public.user_roles (
  id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) UNIQUE NOT NULL,
  role_level INTEGER NOT NULL, -- Higher number = more permissions
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default roles with hierarchy levels
INSERT INTO public.user_roles (role_name, role_level, description) VALUES
('superadmin', 100, 'Full system access - can manage everything including other admins'),
('admin', 80, 'Business administration - can manage all staff and operations'),
('manager', 60, 'Department management - can assign shifts to all staff'),
('supervisor', 40, 'Team supervision - can assign shifts to junior staff only'),
('staff', 20, 'Regular staff - can only manage own availability and assignments')
ON CONFLICT (role_name) DO NOTHING;

-- Add user_role and permissions to staff table
ALTER TABLE public.staff 
ADD COLUMN IF NOT EXISTS user_role VARCHAR(50) DEFAULT 'staff' REFERENCES public.user_roles(role_name),
ADD COLUMN IF NOT EXISTS can_assign_shifts BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_staff BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_view_all_shifts BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS reports_to INTEGER REFERENCES public.staff(id),
ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'GBP';

-- Create permissions table for granular control
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) REFERENCES public.user_roles(role_name),
  permission_name VARCHAR(100) NOT NULL,
  permission_value BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role_name, permission_name)
);

-- Insert default permissions for each role
INSERT INTO public.role_permissions (role_name, permission_name, permission_value) VALUES
-- Superadmin permissions (can do everything)
('superadmin', 'assign_any_shift', true),
('superadmin', 'manage_all_staff', true),
('superadmin', 'view_all_data', true),
('superadmin', 'manage_business_settings', true),
('superadmin', 'manage_user_roles', true),
('superadmin', 'delete_shifts', true),
('superadmin', 'manage_payroll', true),

-- Admin permissions
('admin', 'assign_any_shift', true),
('admin', 'manage_all_staff', true),
('admin', 'view_all_data', true),
('admin', 'manage_business_settings', true),
('admin', 'delete_shifts', true),
('admin', 'manage_payroll', true),

-- Manager permissions
('manager', 'assign_any_shift', true),
('manager', 'manage_department_staff', true),
('manager', 'view_department_data', true),
('manager', 'create_shifts', true),
('manager', 'approve_time_off', true),

-- Supervisor permissions
('supervisor', 'assign_junior_shifts', true),
('supervisor', 'view_team_data', true),
('supervisor', 'create_shifts', true),

-- Staff permissions (basic)
('staff', 'view_own_shifts', true),
('staff', 'manage_own_availability', true),
('staff', 'request_time_off', true),
('staff', 'assign_self_to_shifts', true)
ON CONFLICT (role_name, permission_name) DO NOTHING;

-- Create shift assignment permissions table
CREATE TABLE IF NOT EXISTS public.shift_assignment_permissions (
  id SERIAL PRIMARY KEY,
  assigner_id INTEGER REFERENCES public.staff(id),
  assignee_id INTEGER REFERENCES public.staff(id),
  shift_id INTEGER REFERENCES public.shifts(id),
  permission_type VARCHAR(50) NOT NULL, -- 'assign', 'unassign', 'modify'
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  granted_by INTEGER REFERENCES public.staff(id)
);

-- Update existing staff to have proper roles
UPDATE public.staff 
SET user_role = 'admin', 
    can_assign_shifts = true, 
    can_manage_staff = true, 
    can_view_all_shifts = true
WHERE role IN ('manager', 'owner', 'admin');

UPDATE public.staff 
SET user_role = 'manager', 
    can_assign_shifts = true, 
    can_view_all_shifts = true
WHERE role = 'supervisor';

UPDATE public.staff 
SET user_role = 'staff'
WHERE user_role IS NULL OR user_role = 'staff';

-- Create function to check if user can assign shift to another user
CREATE OR REPLACE FUNCTION can_assign_shift_to_user(
  assigner_staff_id INTEGER,
  assignee_staff_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  assigner_role_level INTEGER;
  assignee_role_level INTEGER;
  assigner_role VARCHAR(50);
  assignee_role VARCHAR(50);
BEGIN
  -- Get assigner role info
  SELECT ur.role_level, s.user_role 
  INTO assigner_role_level, assigner_role
  FROM public.staff s
  JOIN public.user_roles ur ON s.user_role = ur.role_name
  WHERE s.id = assigner_staff_id;
  
  -- Get assignee role info
  SELECT ur.role_level, s.user_role 
  INTO assignee_role_level, assignee_role
  FROM public.staff s
  JOIN public.user_roles ur ON s.user_role = ur.role_name
  WHERE s.id = assignee_staff_id;
  
  -- Self-assignment is always allowed for staff
  IF assigner_staff_id = assignee_staff_id THEN
    RETURN TRUE;
  END IF;
  
  -- Superadmin and admin can assign anyone
  IF assigner_role IN ('superadmin', 'admin') THEN
    RETURN TRUE;
  END IF;
  
  -- Manager can assign anyone except admin/superadmin
  IF assigner_role = 'manager' AND assignee_role NOT IN ('admin', 'superadmin') THEN
    RETURN TRUE;
  END IF;
  
  -- Supervisor can assign staff only
  IF assigner_role = 'supervisor' AND assignee_role = 'staff' THEN
    RETURN TRUE;
  END IF;
  
  -- Staff can only assign themselves
  IF assigner_role = 'staff' AND assigner_staff_id = assignee_staff_id THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(staff_id INTEGER)
RETURNS TABLE(permission_name VARCHAR(100), permission_value BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT rp.permission_name, rp.permission_value
  FROM public.staff s
  JOIN public.role_permissions rp ON s.user_role = rp.role_name
  WHERE s.id = staff_id;
END;
$$ LANGUAGE plpgsql;

-- Add audit trail for shift assignments
CREATE TABLE IF NOT EXISTS public.shift_assignment_audit (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER REFERENCES public.shifts(id),
  staff_id INTEGER REFERENCES public.staff(id),
  action VARCHAR(50) NOT NULL, -- 'assigned', 'unassigned', 'modified'
  performed_by INTEGER REFERENCES public.staff(id),
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trigger to log shift assignment changes
CREATE OR REPLACE FUNCTION log_shift_assignment_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.shift_assignment_audit (
      shift_id, staff_id, action, performed_by, new_status
    ) VALUES (
      NEW.shift_id, NEW.staff_id, 'assigned', NEW.staff_id, NEW.status
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.shift_assignment_audit (
      shift_id, staff_id, action, performed_by, old_status, new_status
    ) VALUES (
      NEW.shift_id, NEW.staff_id, 'modified', NEW.staff_id, OLD.status, NEW.status
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.shift_assignment_audit (
      shift_id, staff_id, action, performed_by, old_status
    ) VALUES (
      OLD.shift_id, OLD.staff_id, 'unassigned', OLD.staff_id, OLD.status
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS shift_assignment_audit_trigger ON public.shift_assignments;
CREATE TRIGGER shift_assignment_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.shift_assignments
  FOR EACH ROW EXECUTE FUNCTION log_shift_assignment_changes();

-- Add current user context (you'll need to set this in your application)
CREATE TABLE IF NOT EXISTS public.current_user_context (
  session_id VARCHAR(255) PRIMARY KEY,
  staff_id INTEGER REFERENCES public.staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

-- Create a default superadmin user (update this with real data)
INSERT INTO public.staff (
  business_id, name, phone_number, email, role, user_role, 
  can_assign_shifts, can_manage_staff, can_view_all_shifts, skills
) VALUES (
  1, 'System Administrator', '+44 20 7000 0000', 'admin@localops.ai', 'superadmin', 'superadmin',
  true, true, true, '["management", "admin"]'::jsonb
) ON CONFLICT DO NOTHING;

-- Create function to calculate projected pay for a shift
CREATE OR REPLACE FUNCTION calculate_shift_pay(
  staff_id_param INTEGER,
  shift_start TIMESTAMP WITH TIME ZONE,
  shift_end TIMESTAMP WITH TIME ZONE
) RETURNS DECIMAL(10,2) AS $
DECLARE
  hourly_rate_value DECIMAL(10,2);
  shift_hours DECIMAL(10,2);
  total_pay DECIMAL(10,2);
BEGIN
  -- Get the staff member's hourly rate
  SELECT hourly_rate INTO hourly_rate_value
  FROM public.staff
  WHERE id = staff_id_param;
  
  -- Calculate shift duration in hours
  shift_hours := EXTRACT(EPOCH FROM (shift_end - shift_start)) / 3600.0;
  
  -- Calculate total pay
  total_pay := hourly_rate_value * shift_hours;
  
  RETURN COALESCE(total_pay, 0.00);
END;
$ LANGUAGE plpgsql;

-- Create view for shifts with projected pay
CREATE OR REPLACE VIEW public.shifts_with_pay AS
SELECT 
  s.*,
  sa.staff_id,
  st.name as staff_name,
  st.hourly_rate,
  st.currency,
  calculate_shift_pay(sa.staff_id, s.start_time, s.end_time) as projected_pay,
  EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0 as shift_hours
FROM public.shifts s
LEFT JOIN public.shift_assignments sa ON s.id = sa.shift_id
LEFT JOIN public.staff st ON sa.staff_id = st.id;

COMMENT ON TABLE public.user_roles IS 'Defines the role hierarchy and permission levels';
COMMENT ON TABLE public.role_permissions IS 'Granular permissions for each role';
COMMENT ON FUNCTION can_assign_shift_to_user IS 'Checks if one user can assign shifts to another based on role hierarchy';
COMMENT ON TABLE public.shift_assignment_audit IS 'Audit trail for all shift assignment changes';
COMMENT ON FUNCTION calculate_shift_pay IS 'Calculates projected pay for a shift based on staff hourly rate and shift duration';
COMMENT ON VIEW public.shifts_with_pay IS 'View that includes projected pay calculations for all shifts';