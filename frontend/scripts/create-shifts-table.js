const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function createShiftsTable() {
  console.log('🚀 Creating shifts table and related tables...')

  try {
    // Create shifts table using SQL
    console.log('📅 Creating shifts table...')
    
    // Since exec_sql might not exist, let's try a different approach
    // We'll use the SQL editor or create via direct SQL execution
    
    const createShiftsSQL = `
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
    `

    const createAssignmentsSQL = `
      CREATE TABLE IF NOT EXISTS public.shift_assignments (
        id SERIAL PRIMARY KEY,
        shift_id INTEGER REFERENCES public.shifts(id) ON DELETE CASCADE,
        staff_id INTEGER REFERENCES public.staff(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'assigned',
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        confirmed_at TIMESTAMP WITH TIME ZONE
      );
    `

    const createSickLeaveSQL = `
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
    `

    // Try using the rpc function first
    try {
      await supabase.rpc('exec_sql', { sql: createShiftsSQL })
      console.log('✅ Shifts table created via RPC')
    } catch (rpcError) {
      console.log('RPC method failed, trying alternative approach...')
      
      // Alternative: Try to create via a stored procedure or direct execution
      // For now, let's create a simple test to see if we can insert
      console.log('⚠️ Could not create table via RPC. Please create the table manually.')
      console.log('SQL to execute in Supabase SQL editor:')
      console.log(createShiftsSQL)
      console.log(createAssignmentsSQL)
      console.log(createSickLeaveSQL)
      
      // Let's also try to disable RLS
      console.log('\nAlso run this to disable RLS:')
      console.log('ALTER TABLE public.shifts DISABLE ROW LEVEL SECURITY;')
      console.log('ALTER TABLE public.shift_assignments DISABLE ROW LEVEL SECURITY;')
      console.log('ALTER TABLE public.sick_leave_requests DISABLE ROW LEVEL SECURITY;')
      
      return
    }

    // Create other tables
    await supabase.rpc('exec_sql', { sql: createAssignmentsSQL })
    console.log('✅ Shift assignments table created')

    await supabase.rpc('exec_sql', { sql: createSickLeaveSQL })
    console.log('✅ Sick leave requests table created')

    // Disable RLS
    const disableRLSSQL = `
      ALTER TABLE public.shifts DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.shift_assignments DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.sick_leave_requests DISABLE ROW LEVEL SECURITY;
    `

    await supabase.rpc('exec_sql', { sql: disableRLSSQL })
    console.log('✅ RLS disabled for new tables')

    console.log('\n🎉 All tables created successfully!')
    console.log('You can now run: node scripts/setup-demo-shifts.js')

  } catch (error) {
    console.error('❌ Table creation failed:', error)
  }
}

createShiftsTable()