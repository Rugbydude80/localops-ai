const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupDatabase() {
  console.log('🚀 Setting up LocalOps AI database...')

  try {
    // Create businesses table
    const { error: businessError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS businesses (
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
      `
    })

    if (businessError) {
      console.log('Creating businesses table via SQL...')
      // Fallback: Create table using direct SQL
    }

    // Create staff table
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS staff (
          id SERIAL PRIMARY KEY,
          business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
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
      `
    })

    // Create emergency_requests table
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS emergency_requests (
          id SERIAL PRIMARY KEY,
          business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
          shift_date TIMESTAMP WITH TIME ZONE NOT NULL,
          shift_start VARCHAR(10) NOT NULL,
          shift_end VARCHAR(10) NOT NULL,
          required_skill VARCHAR(100) NOT NULL,
          urgency VARCHAR(20) DEFAULT 'normal',
          message TEXT,
          status VARCHAR(20) DEFAULT 'pending',
          filled_by INTEGER REFERENCES staff(id),
          filled_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE
        );
      `
    })

    // Create shift_coverage table
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS shift_coverage (
          id SERIAL PRIMARY KEY,
          request_id INTEGER REFERENCES emergency_requests(id) ON DELETE CASCADE,
          staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
          response VARCHAR(20) NOT NULL,
          response_time_minutes INTEGER,
          responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    })

    // Create message_logs table
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS message_logs (
          id SERIAL PRIMARY KEY,
          business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
          staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
          request_id INTEGER REFERENCES emergency_requests(id),
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
      `
    })

    // Create shifts table
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS shifts (
          id SERIAL PRIMARY KEY,
          business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
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
    })

    // Create shift_assignments table
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS shift_assignments (
          id SERIAL PRIMARY KEY,
          shift_id INTEGER REFERENCES shifts(id) ON DELETE CASCADE,
          staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
          status VARCHAR(20) DEFAULT 'assigned',
          assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          confirmed_at TIMESTAMP WITH TIME ZONE
        );
      `
    })

    // Create sick_leave_requests table
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS sick_leave_requests (
          id SERIAL PRIMARY KEY,
          staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
          shift_id INTEGER REFERENCES shifts(id) ON DELETE CASCADE,
          business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
          reason VARCHAR(50) DEFAULT 'sick',
          message TEXT,
          reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          replacement_found BOOLEAN DEFAULT false,
          replacement_staff_id INTEGER REFERENCES staff(id)
        );
      `
    })

    console.log('✅ Database tables created successfully!')

    // Insert sample data
    console.log('📝 Creating sample data...')

    // Create sample business
    const { data: business, error: businessInsertError } = await supabase
      .from('businesses')
      .insert({
        name: "Milano's Kitchen",
        type: 'italian_restaurant',
        phone_number: '+44 20 7123 4567',
        email: 'marco@milanos.co.uk',
        address: '123 High Street, London, SW1A 1AA',
        owner_name: 'Marco Rossi',
        subscription_tier: 'professional'
      })
      .select()
      .single()

    if (businessInsertError) {
      console.error('Error creating business:', businessInsertError)
      return
    }

    const businessId = business.id

    // Create sample staff
    const staffMembers = [
      {
        business_id: businessId,
        name: 'Sarah Johnson',
        phone_number: '+44 7700 900001',
        email: 'sarah@milanos.co.uk',
        role: 'head_chef',
        skills: ['kitchen', 'management'],
        reliability_score: 9.2
      },
      {
        business_id: businessId,
        name: 'Tom Wilson',
        phone_number: '+44 7700 900002',
        email: 'tom@milanos.co.uk',
        role: 'sous_chef',
        skills: ['kitchen'],
        reliability_score: 8.5
      },
      {
        business_id: businessId,
        name: 'Emma Davis',
        phone_number: '+44 7700 900003',
        email: 'emma@milanos.co.uk',
        role: 'server',
        skills: ['front_of_house'],
        reliability_score: 7.8
      },
      {
        business_id: businessId,
        name: 'James Brown',
        phone_number: '+44 7700 900004',
        email: 'james@milanos.co.uk',
        role: 'bartender',
        skills: ['bar', 'front_of_house'],
        reliability_score: 8.9
      },
      {
        business_id: businessId,
        name: 'Lisa Garcia',
        phone_number: '+44 7700 900005',
        email: 'lisa@milanos.co.uk',
        role: 'server',
        skills: ['front_of_house', 'bar'],
        reliability_score: 6.5
      },
      {
        business_id: businessId,
        name: 'Mike Taylor',
        phone_number: '+44 7700 900006',
        email: 'mike@milanos.co.uk',
        role: 'line_cook',
        skills: ['kitchen'],
        reliability_score: 7.2
      }
    ]

    const { error: staffError } = await supabase
      .from('staff')
      .insert(staffMembers)

    if (staffError) {
      console.error('Error creating staff:', staffError)
      return
    }

    // Create sample emergency requests
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const dayAfter = new Date()
    dayAfter.setDate(dayAfter.getDate() + 2)

    const sampleRequests = [
      {
        business_id: businessId,
        shift_date: tomorrow.toISOString(),
        shift_start: '18:00',
        shift_end: '23:00',
        required_skill: 'kitchen',
        urgency: 'high',
        message: 'Head chef called in sick, need experienced kitchen staff',
        status: 'pending'
      },
      {
        business_id: businessId,
        shift_date: dayAfter.toISOString(),
        shift_start: '12:00',
        shift_end: '16:00',
        required_skill: 'front_of_house',
        urgency: 'normal',
        message: 'Lunch service coverage needed',
        status: 'filled'
      }
    ]

    const { error: requestsError } = await supabase
      .from('emergency_requests')
      .insert(sampleRequests)

    if (requestsError) {
      console.error('Error creating emergency requests:', requestsError)
      return
    }

    console.log('✅ Sample data created successfully!')
    console.log(`   Business: Milano's Kitchen (ID: ${businessId})`)
    console.log(`   Staff members: ${staffMembers.length}`)
    console.log(`   Emergency requests: ${sampleRequests.length}`)
    console.log('')
    console.log('🌐 Ready to run: npm run dev')

  } catch (error) {
    console.error('❌ Database setup failed:', error)
  }
}

setupDatabase()