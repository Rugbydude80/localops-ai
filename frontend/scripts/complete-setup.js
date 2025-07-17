const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🚀 Complete LocalOps AI setup for new Supabase instance...')
console.log('URL:', supabaseUrl)
console.log('Key length:', supabaseKey ? supabaseKey.length : 'Missing')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function completeSetup() {
  try {
    console.log('\n🔧 Step 1: Creating all necessary tables...')
    
    // Create all tables in the correct order
    const createTablesSQL = `
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

      -- Disable RLS for all tables
      ALTER TABLE public.businesses DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.emergency_requests DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.shift_coverage DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.message_logs DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.shifts DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.shift_assignments DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.sick_leave_requests DISABLE ROW LEVEL SECURITY;
    `

    // Execute the SQL to create tables
    const { error: sqlError } = await supabase.rpc('exec_sql', { sql: createTablesSQL })
    
    if (sqlError) {
      console.error('❌ Error creating tables via RPC:', sqlError)
      console.log('⚠️  Please run the SQL manually in Supabase SQL editor')
      return
    }

    console.log('✅ All tables created successfully!')

    console.log('\n📊 Step 2: Creating demo business...')
    
    // Create demo business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({
        name: "LocalOps Demo Restaurant",
        type: 'restaurant',
        phone_number: '+44 20 7123 4567',
        email: 'demo@localops.ai',
        address: '123 Demo Street, London, SW1A 1AA',
        owner_name: 'Demo Owner',
        subscription_tier: 'professional'
      })
      .select()
      .single()

    if (businessError) {
      console.error('❌ Error creating business:', businessError)
      return
    }

    const businessId = business.id
    console.log(`✅ Business created with ID: ${businessId}`)

    console.log('\n👥 Step 3: Creating demo staff...')
    
    // Create demo staff
    const staffData = [
      {
        business_id: businessId,
        name: 'Emma Davis',
        phone_number: '+44 7700 900001',
        email: 'emma.davis@localops.ai',
        role: 'chef',
        skills: ['kitchen', 'management'],
        reliability_score: 7.8,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'James Brown',
        phone_number: '+44 7700 900002',
        email: 'james.brown@localops.ai',
        role: 'bartender',
        skills: ['bar', 'front_of_house'],
        reliability_score: 8.9,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'Lisa Garcia',
        phone_number: '+44 7700 900003',
        email: 'lisa.garcia@localops.ai',
        role: 'server',
        skills: ['front_of_house', 'bar'],
        reliability_score: 6.5,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'Mike Taylor',
        phone_number: '+44 7700 900004',
        email: 'mike.taylor@localops.ai',
        role: 'cook',
        skills: ['kitchen'],
        reliability_score: 7.2,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'Sarah Johnson',
        phone_number: '+44 7700 900005',
        email: 'sarah.johnson@localops.ai',
        role: 'manager',
        skills: ['management', 'front_of_house'],
        reliability_score: 9.2,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'Tom Wilson',
        phone_number: '+44 7700 900006',
        email: 'tom.wilson@localops.ai',
        role: 'server',
        skills: ['front_of_house', 'cleaning'],
        reliability_score: 8.5,
        is_active: true
      }
    ]

    const { data: insertedStaff, error: staffError } = await supabase
      .from('staff')
      .insert(staffData)
      .select()

    if (staffError) {
      console.error('❌ Error creating staff:', staffError)
      return
    }

    console.log(`✅ Created ${insertedStaff.length} staff members`)

    console.log('\n📅 Step 4: Creating demo shifts...')
    
    // Create demo shifts for the next 2 weeks
    const shifts = []
    const today = new Date()
    const shiftTemplates = [
      { name: 'Morning Kitchen', skill: 'kitchen', start: '06:00', end: '14:00', staff_needed: 2 },
      { name: 'Lunch Service', skill: 'front_of_house', start: '11:00', end: '16:00', staff_needed: 3 },
      { name: 'Evening Kitchen', skill: 'kitchen', start: '14:00', end: '22:00', staff_needed: 2 },
      { name: 'Bar Service', skill: 'bar', start: '17:00', end: '23:00', staff_needed: 2 },
      { name: 'Dinner Service', skill: 'front_of_house', start: '17:00', end: '23:00', staff_needed: 4 },
      { name: 'Management', skill: 'management', start: '09:00', end: '17:00', staff_needed: 1 }
    ]

    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      const shiftDate = new Date(today)
      shiftDate.setDate(today.getDate() + dayOffset)
      
      // Create 3-4 shifts per day
      const dailyShifts = shiftTemplates.filter(() => Math.random() > 0.3)
      
      for (const template of dailyShifts) {
        const status = ['scheduled', 'filled', 'understaffed'][Math.floor(Math.random() * 3)]
        
        shifts.push({
          business_id: businessId,
          title: template.name,
          date: shiftDate.toISOString().split('T')[0],
          start_time: template.start,
          end_time: template.end,
          required_skill: template.skill,
          required_staff_count: template.staff_needed,
          hourly_rate: 12.50 + Math.random() * 5,
          notes: `${template.name} shift for ${shiftDate.toLocaleDateString()}`,
          status: status
        })
      }
    }

    const { data: insertedShifts, error: shiftsError } = await supabase
      .from('shifts')
      .insert(shifts)
      .select()

    if (shiftsError) {
      console.error('❌ Error creating shifts:', shiftsError)
      return
    }

    console.log(`✅ Created ${insertedShifts.length} shifts`)

    console.log('\n🚨 Step 5: Creating emergency requests...')
    
    // Create emergency requests
    const emergencyRequests = [
      {
        business_id: businessId,
        shift_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        shift_start: '18:00',
        shift_end: '23:00',
        required_skill: 'kitchen',
        urgency: 'high',
        message: 'Kitchen staff called in sick, need immediate replacement',
        status: 'pending'
      },
      {
        business_id: businessId,
        shift_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        shift_start: '12:00',
        shift_end: '18:00',
        required_skill: 'front_of_house',
        urgency: 'normal',
        message: 'Need extra server for busy lunch service',
        status: 'filled'
      },
      {
        business_id: businessId,
        shift_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        shift_start: '17:00',
        shift_end: '23:00',
        required_skill: 'bar',
        urgency: 'high',
        message: 'Bartender emergency - need cover for evening shift',
        status: 'pending'
      }
    ]

    const { data: insertedRequests, error: requestsError } = await supabase
      .from('emergency_requests')
      .insert(emergencyRequests)
      .select()

    if (requestsError) {
      console.error('❌ Error creating emergency requests:', requestsError)
      return
    }

    console.log(`✅ Created ${insertedRequests.length} emergency requests`)

    console.log('\n💬 Step 6: Creating message logs...')
    
    // Create message logs
    const messageLogs = []
    for (let i = 0; i < 20; i++) {
      const randomStaff = insertedStaff[Math.floor(Math.random() * insertedStaff.length)]
      const skills = ['kitchen', 'bar', 'front_of_house', 'management']
      const randomSkill = skills[Math.floor(Math.random() * skills.length)]
      
      messageLogs.push({
        business_id: businessId,
        staff_id: randomStaff.id,
        message_type: 'emergency_request',
        platform: 'whatsapp',
        phone_number: randomStaff.phone_number,
        message_content: `Hi ${randomStaff.name}, we need ${randomSkill} coverage for tomorrow. Can you help? Reply YES/NO.`,
        external_message_id: `demo_${Date.now()}_${i}`,
        status: ['sent', 'delivered', 'read'][Math.floor(Math.random() * 3)]
      })
    }

    const { data: insertedMessages, error: messagesError } = await supabase
      .from('message_logs')
      .insert(messageLogs)

    if (messagesError) {
      console.error('❌ Error creating message logs:', messagesError)
    } else {
      console.log(`✅ Created ${messageLogs.length} message logs`)
    }

    console.log('\n🎉 Complete setup finished successfully!')
    console.log('\n📊 Summary:')
    console.log(`   • Business: ${business.name} (ID: ${businessId})`)
    console.log(`   • Staff: ${insertedStaff.length} members`)
    console.log(`   • Shifts: ${insertedShifts.length} over 2 weeks`)
    console.log(`   • Emergency requests: ${insertedRequests.length}`)
    console.log(`   • Message logs: ${messageLogs.length}`)
    console.log('\n🚀 Ready to demo!')
    console.log('   • http://localhost:3000 - Staff management')
    console.log('   • http://localhost:3000/dashboard - Operations dashboard')
    console.log('   • http://localhost:3000/shifts - Shift calendar')
    console.log('   • http://localhost:3000/enhanced-dashboard - AI features')

  } catch (error) {
    console.error('❌ Setup failed:', error)
  }
}

completeSetup()