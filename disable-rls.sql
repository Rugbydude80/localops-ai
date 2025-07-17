-- Disable Row Level Security for development
-- WARNING: This makes your tables publicly accessible
-- Only use this for development/testing

ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE shift_coverage DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs DISABLE ROW LEVEL SECURITY;

-- Alternatively, if you want to keep RLS enabled but allow all access:
-- CREATE POLICY "Allow all access" ON businesses FOR ALL USING (true);
-- CREATE POLICY "Allow all access" ON staff FOR ALL USING (true);
-- CREATE POLICY "Allow all access" ON emergency_requests FOR ALL USING (true);
-- CREATE POLICY "Allow all access" ON shift_coverage FOR ALL USING (true);
-- CREATE POLICY "Allow all access" ON message_logs FOR ALL USING (true);