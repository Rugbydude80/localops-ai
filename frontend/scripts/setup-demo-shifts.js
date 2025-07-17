const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration')
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing')
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'Set' : 'Missing')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupDemoShifts() {
  console.log('🚀 Setting up demo shifts and enhanced staff data...')

  try {
    // Disable RLS for all tables to allow demo data insertion
    console.log('🔓 Disabling Row Level Security for demo...')
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
        ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
        ALTER TABLE emergency_requests DISABLE ROW LEVEL SECURITY;
        ALTER TABLE shift_coverage DISABLE ROW LEVEL SECURITY;
        ALTER TABLE message_logs DISABLE ROW LEVEL SECURITY;
        ALTER TABLE shifts DISABLE ROW LEVEL SECURITY;
        ALTER TABLE shift_assignments DISABLE ROW LEVEL SECURITY;
        ALTER TABLE sick_leave_requests DISABLE ROW LEVEL SECURITY;
      `
    })

    // Get the business ID from existing businesses
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .limit(1)

    if (businessError || !businesses || businesses.length === 0) {
      console.error('❌ No business found. Please run setup-database.js first')
      return
    }

    const businessId = businesses[0].id
    console.log(`Using business ID: ${businessId}`)

    // Check if shifts table exists
    console.log('🔍 Checking if shifts table exists...')
    const { data: tableCheck, error: tableError } = await supabase
      .from('shifts')
      .select('count', { count: 'exact', head: true })

    if (tableError) {
      console.error('❌ Shifts table does not exist or is not accessible:', tableError)
      console.log('Please ensure the shifts table is created in your database')
      return
    }

    console.log('✅ Shifts table exists and is accessible')

    // First, let's add more comprehensive staff data
    const staffData = [
      {
        business_id: businessId,
        name: 'Emma Davis',
        phone_number: '+44 7700 900001',
        email: 'emma.davis@restaurant.com',
        role: 'chef',
        skills: ['kitchen', 'management'],
        reliability_score: 7.8,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'James Brown',
        phone_number: '+44 7700 900002',
        email: 'james.brown@restaurant.com',
        role: 'bartender',
        skills: ['bar', 'front_of_house'],
        reliability_score: 8.9,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'Lisa Garcia',
        phone_number: '+44 7700 900003',
        email: 'lisa.garcia@restaurant.com',
        role: 'server',
        skills: ['front_of_house', 'bar'],
        reliability_score: 6.5,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'Mike Taylor',
        phone_number: '+44 7700 900004',
        email: 'mike.taylor@restaurant.com',
        role: 'cook',
        skills: ['kitchen'],
        reliability_score: 7.2,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'Sarah Johnson',
        phone_number: '+44 7700 900005',
        email: 'sarah.johnson@restaurant.com',
        role: 'manager',
        skills: ['management', 'front_of_house'],
        reliability_score: 9.2,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'Tom Wilson',
        phone_number: '+44 7700 900006',
        email: 'tom.wilson@restaurant.com',
        role: 'server',
        skills: ['front_of_house', 'cleaning'],
        reliability_score: 8.5,
        is_active: true
      }
    ]

    // Clear existing staff and insert new data
    console.log('📝 Updating staff data...')
    const { error: deleteStaffError } = await supabase
      .from('staff')
      .delete()
      .eq('business_id', businessId)

    if (deleteStaffError) {
      console.log('Note: Could not clear existing staff:', deleteStaffError.message)
    }

    const { data: insertedStaff, error: staffError } = await supabase
      .from('staff')
      .insert(staffData)
      .select()

    if (staffError) {
      console.error('❌ Error inserting staff:', staffError)
      return
    }

    console.log(`✅ Inserted ${insertedStaff.length} staff members`)

    // Generate shifts for the next 2 weeks
    const shifts = []
    const today = new Date()
    const skills = ['kitchen', 'bar', 'front_of_house', 'management']
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
      
      // Skip some shifts randomly to create variety
      const shiftsToday = shiftTemplates.filter(() => Math.random() > 0.2)
      
      for (const template of shiftsToday) {
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

    console.log('📅 Inserting shifts...')
    console.log(`Generated ${shifts.length} shifts`)
    
    // Try inserting one shift first to debug
    console.log('Testing single shift insertion...')
    const testShift = {
      business_id: businessId,
      title: 'Test Shift',
      date: '2025-07-18',
      start_time: '09:00',
      end_time: '17:00',
      required_skill: 'kitchen',
      required_staff_count: 1,
      hourly_rate: 15.00,
      notes: 'Test shift',
      status: 'scheduled'
    }
    
    console.log('Attempting to insert test shift:', JSON.stringify(testShift, null, 2))
    
    const { data: testResult, error: testError } = await supabase
      .from('shifts')
      .insert([testShift])
      .select()

    if (testError) {
      console.error('❌ Error inserting test shift:', testError)
      console.error('Error details:', JSON.stringify(testError, null, 2))
      return
    }

    console.log('✅ Test shift inserted successfully:', testResult)
    
    // Now try inserting all shifts in smaller batches
    const batchSize = 10
    let insertedShifts = []
    
    for (let i = 0; i < shifts.length; i += batchSize) {
      const batch = shifts.slice(i, i + batchSize)
      console.log(`Inserting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(shifts.length/batchSize)}...`)
      
      const { data: batchResult, error: batchError } = await supabase
        .from('shifts')
        .insert(batch)
        .select()

      if (batchError) {
        console.error(`❌ Error inserting batch ${Math.floor(i/batchSize) + 1}:`, batchError)
        console.error('Batch data sample:', JSON.stringify(batch[0], null, 2))
        return
      }
      
      insertedShifts = insertedShifts.concat(batchResult || [])
    }

    console.log(`✅ Inserted ${insertedShifts.length} shifts`)

    // Create some shift assignments
    console.log('👥 Creating shift assignments...')
    const assignments = []
    
    for (const shift of insertedShifts.slice(0, 20)) { // Assign staff to first 20 shifts
      const qualifiedStaff = insertedStaff.filter(staff => 
        staff.skills.includes(shift.required_skill)
      )
      
      if (qualifiedStaff.length > 0) {
        const staffToAssign = Math.min(
          shift.required_staff_count, 
          qualifiedStaff.length,
          Math.floor(Math.random() * shift.required_staff_count) + 1
        )
        
        for (let i = 0; i < staffToAssign; i++) {
          const randomStaff = qualifiedStaff[Math.floor(Math.random() * qualifiedStaff.length)]
          
          // Avoid duplicate assignments
          if (!assignments.some(a => a.shift_id === shift.id && a.staff_id === randomStaff.id)) {
            assignments.push({
              shift_id: shift.id,
              staff_id: randomStaff.id,
              status: Math.random() > 0.1 ? 'assigned' : 'called_in_sick'
            })
          }
        }
      }
    }

    if (assignments.length > 0) {
      const { error: assignmentsError } = await supabase
        .from('shift_assignments')
        .insert(assignments)

      if (assignmentsError) {
        console.error('❌ Error creating assignments:', assignmentsError)
      } else {
        console.log(`✅ Created ${assignments.length} shift assignments`)
      }
    }

    // Create some emergency requests
    console.log('🚨 Creating emergency requests...')
    const emergencyRequests = [
      {
        business_id: businessId,
        shift_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        shift_start: '18:00',
        shift_end: '23:00',
        required_skill: 'kitchen',
        urgency: 'high',
        message: 'Kitchen staff called in sick, need immediate replacement',
        status: 'pending'
      },
      {
        business_id: businessId,
        shift_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // Day after tomorrow
        shift_start: '12:00',
        shift_end: '18:00',
        required_skill: 'front_of_house',
        urgency: 'normal',
        message: 'Need extra server for busy lunch service',
        status: 'filled'
      }
    ]

    const { error: emergencyError } = await supabase
      .from('emergency_requests')
      .insert(emergencyRequests)

    if (emergencyError) {
      console.error('❌ Error creating emergency requests:', emergencyError)
    } else {
      console.log(`✅ Created ${emergencyRequests.length} emergency requests`)
    }

    // Create some message logs to show WhatsApp activity
    console.log('💬 Creating message logs...')
    const messageLogs = []
    
    for (let i = 0; i < 10; i++) {
      const randomStaff = insertedStaff[Math.floor(Math.random() * insertedStaff.length)]
      messageLogs.push({
        business_id: businessId,
        staff_id: randomStaff.id,
        message_type: 'emergency_request',
        platform: 'whatsapp',
        phone_number: randomStaff.phone_number,
        message_content: `Hi ${randomStaff.name}, we need ${skills[Math.floor(Math.random() * skills.length)]} coverage for tomorrow. Can you help?`,
        external_message_id: `demo_${Date.now()}_${i}`,
        status: ['sent', 'delivered', 'read'][Math.floor(Math.random() * 3)]
      })
    }

    const { error: messageError } = await supabase
      .from('message_logs')
      .insert(messageLogs)

    if (messageError) {
      console.error('❌ Error creating message logs:', messageError)
    } else {
      console.log(`✅ Created ${messageLogs.length} message logs`)
    }

    console.log('\n🎉 Demo data setup complete!')
    console.log('\n📊 Summary:')
    console.log(`   • ${insertedStaff.length} staff members`)
    console.log(`   • ${insertedShifts.length} shifts over 2 weeks`)
    console.log(`   • ${assignments.length} shift assignments`)
    console.log(`   • ${emergencyRequests.length} emergency requests`)
    console.log(`   • ${messageLogs.length} message logs`)
    console.log('\n🚀 You can now demo the full LocalOps AI experience!')
    console.log('   • Visit http://localhost:3000 for staff management')
    console.log('   • Visit http://localhost:3000/dashboard for operations overview')
    console.log('   • Visit http://localhost:3000/shifts for shift calendar')

  } catch (error) {
    console.error('❌ Setup failed:', error)
  }
}

// Run the setup
setupDemoShifts()