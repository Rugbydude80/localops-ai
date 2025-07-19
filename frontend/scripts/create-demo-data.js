const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function createDemoData() {
  try {
    console.log('🎭 Creating comprehensive demo data for LocalOps AI...')
    
    // Get or create business
    let { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id, name')
      .limit(1)

    let businessId
    if (businessError || !businesses || businesses.length === 0) {
      console.log('📝 Creating demo business...')
      const { data: newBusiness, error: createError } = await supabase
        .from('businesses')
        .insert({
          name: "The Grand Bistro",
          type: 'fine_dining',
          phone_number: '+44 20 7123 4567',
          email: 'demo@thegrandbistro.co.uk',
          address: '123 Mayfair Street, London, W1K 1AB',
          owner_name: 'Chef Marco Rossi',
          subscription_tier: 'enterprise',
          is_active: true
        })
        .select()
        .single()

      if (createError) {
        console.error('❌ Error creating business:', createError)
        return
      }
      businessId = newBusiness.id
      console.log(`✅ Business created with ID: ${businessId}`)
    } else {
      businessId = businesses[0].id
      console.log(`✅ Using existing business ID: ${businessId}`)
    }

    // Clear existing data
    console.log('🧹 Clearing existing data...')
    await supabase.from('shifts').delete().eq('business_id', businessId)
    await supabase.from('staff').delete().eq('business_id', businessId)
    await supabase.from('emergency_requests').delete().eq('business_id', businessId)
    await supabase.from('message_logs').delete().eq('business_id', businessId)

    // Create comprehensive staff data
    console.log('👥 Creating demo staff...')
    const staffData = [
      {
        business_id: businessId,
        name: 'Chef Marco Rossi',
        phone_number: '+44 7700 900001',
        email: 'marco@thegrandbistro.co.uk',
        role: 'head_chef',
        skills: ['kitchen', 'management', 'menu_planning', 'food_safety'],
        availability: {
          monday: ['08:00-18:00'],
          tuesday: ['08:00-18:00'],
          wednesday: ['08:00-18:00'],
          thursday: ['08:00-18:00'],
          friday: ['08:00-18:00'],
          saturday: ['10:00-16:00']
        },
        reliability_score: 9.8,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'Sarah Johnson',
        phone_number: '+44 7700 900002',
        email: 'sarah@thegrandbistro.co.uk',
        role: 'sous_chef',
        skills: ['kitchen', 'grill', 'pastry', 'food_safety'],
        availability: {
          monday: ['10:00-20:00'],
          tuesday: ['10:00-20:00'],
          wednesday: ['10:00-20:00'],
          thursday: ['10:00-20:00'],
          friday: ['10:00-20:00'],
          saturday: ['12:00-22:00']
        },
        reliability_score: 9.2,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'James Wilson',
        phone_number: '+44 7700 900003',
        email: 'james@thegrandbistro.co.uk',
        role: 'server',
        skills: ['front_of_house', 'customer_service', 'wine_knowledge'],
        availability: {
          monday: ['17:00-23:00'],
          tuesday: ['17:00-23:00'],
          wednesday: ['17:00-23:00'],
          thursday: ['17:00-23:00'],
          friday: ['17:00-23:00'],
          saturday: ['17:00-23:00']
        },
        reliability_score: 8.9,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'Emma Davis',
        phone_number: '+44 7700 900004',
        email: 'emma@thegrandbistro.co.uk',
        role: 'server',
        skills: ['front_of_house', 'customer_service', 'allergies'],
        availability: {
          monday: ['17:00-23:00'],
          tuesday: ['17:00-23:00'],
          wednesday: ['17:00-23:00'],
          thursday: ['17:00-23:00'],
          friday: ['17:00-23:00'],
          saturday: ['17:00-23:00']
        },
        reliability_score: 9.1,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'Michael Brown',
        phone_number: '+44 7700 900005',
        email: 'michael@thegrandbistro.co.uk',
        role: 'bartender',
        skills: ['bar', 'cocktails', 'wine_service', 'customer_service'],
        availability: {
          monday: ['18:00-02:00'],
          tuesday: ['18:00-02:00'],
          wednesday: ['18:00-02:00'],
          thursday: ['18:00-02:00'],
          friday: ['18:00-02:00'],
          saturday: ['18:00-02:00']
        },
        reliability_score: 8.7,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'Lisa Chen',
        phone_number: '+44 7700 900006',
        email: 'lisa@thegrandbistro.co.uk',
        role: 'hostess',
        skills: ['front_of_house', 'reservations', 'customer_service'],
        availability: {
          monday: ['16:00-22:00'],
          tuesday: ['16:00-22:00'],
          wednesday: ['16:00-22:00'],
          thursday: ['16:00-22:00'],
          friday: ['16:00-22:00'],
          saturday: ['16:00-22:00']
        },
        reliability_score: 9.0,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'David Thompson',
        phone_number: '+44 7700 900007',
        email: 'david@thegrandbistro.co.uk',
        role: 'kitchen_porter',
        skills: ['kitchen', 'cleaning', 'dishwashing'],
        availability: {
          monday: ['14:00-22:00'],
          tuesday: ['14:00-22:00'],
          wednesday: ['14:00-22:00'],
          thursday: ['14:00-22:00'],
          friday: ['14:00-22:00'],
          saturday: ['14:00-22:00']
        },
        reliability_score: 7.8,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'Anna Rodriguez',
        phone_number: '+44 7700 900008',
        email: 'anna@thegrandbistro.co.uk',
        role: 'server',
        skills: ['front_of_house', 'customer_service', 'spanish'],
        availability: {
          monday: ['17:00-23:00'],
          tuesday: ['17:00-23:00'],
          wednesday: ['17:00-23:00'],
          thursday: ['17:00-23:00'],
          friday: ['17:00-23:00'],
          saturday: ['17:00-23:00']
        },
        reliability_score: 8.5,
        is_active: true
      }
    ]

    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .insert(staffData)
      .select()

    if (staffError) {
      console.error('❌ Error creating staff:', staffError)
      return
    }

    console.log(`✅ Created ${staff.length} staff members`)

    // Create shifts for the next 2 weeks
    console.log('📅 Creating comprehensive shift schedule...')
    const shiftsData = []
    const today = new Date()
    
    for (let day = 0; day < 14; day++) {
      const shiftDate = new Date(today)
      shiftDate.setDate(today.getDate() + day)
      const dateStr = shiftDate.toISOString().split('T')[0]
      const dayOfWeek = shiftDate.getDay()
      
      // Skip Sundays (day 0)
      if (dayOfWeek === 0) continue
      
      // Morning prep shift
      shiftsData.push({
        business_id: businessId,
        title: 'Morning Prep',
        date: dateStr,
        start_time: '08:00',
        end_time: '16:00',
        required_skill: 'kitchen',
        required_staff_count: 2,
        hourly_rate: 12.50,
        notes: 'Morning prep and lunch service',
        status: 'scheduled'
      })
      
      // Lunch service
      shiftsData.push({
        business_id: businessId,
        title: 'Lunch Service',
        date: dateStr,
        start_time: '11:00',
        end_time: '16:00',
        required_skill: 'front_of_house',
        required_staff_count: 3,
        hourly_rate: 10.50,
        notes: 'Lunch service',
        status: 'scheduled'
      })
      
      // Dinner service
      shiftsData.push({
        business_id: businessId,
        title: 'Dinner Service',
        date: dateStr,
        start_time: '17:00',
        end_time: '23:00',
        required_skill: 'front_of_house',
        required_staff_count: 4,
        hourly_rate: 10.50,
        notes: 'Dinner service',
        status: 'scheduled'
      })
      
      // Bar service
      shiftsData.push({
        business_id: businessId,
        title: 'Bar Service',
        date: dateStr,
        start_time: '18:00',
        end_time: '02:00',
        required_skill: 'bar',
        required_staff_count: 1,
        hourly_rate: 11.00,
        notes: 'Evening bar service',
        status: 'scheduled'
      })
      
      // Kitchen dinner
      shiftsData.push({
        business_id: businessId,
        title: 'Kitchen Dinner',
        date: dateStr,
        start_time: '16:00',
        end_time: '23:00',
        required_skill: 'kitchen',
        required_staff_count: 2,
        hourly_rate: 12.50,
        notes: 'Dinner kitchen service',
        status: 'scheduled'
      })
      
      // Weekend special shifts
      if (dayOfWeek === 6) { // Saturday
        shiftsData.push({
          business_id: businessId,
          title: 'Weekend Brunch',
          date: dateStr,
          start_time: '10:00',
          end_time: '16:00',
          required_skill: 'front_of_house',
          required_staff_count: 3,
          hourly_rate: 11.00,
          notes: 'Weekend brunch service',
          status: 'scheduled'
        })
      }
    }

    const { data: shifts, error: shiftsError } = await supabase
      .from('shifts')
      .insert(shiftsData)
      .select()

    if (shiftsError) {
      console.error('❌ Error creating shifts:', shiftsError)
      return
    }

    console.log(`✅ Created ${shifts.length} shifts`)

    // Create some emergency requests for demo
    console.log('🚨 Creating emergency requests...')
    const emergencyData = [
      {
        business_id: businessId,
        shift_date: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        shift_start: '17:00',
        shift_end: '23:00',
        required_skill: 'front_of_house',
        urgency: 'high',
        message: 'Server called in sick - need immediate coverage',
        status: 'pending'
      },
      {
        business_id: businessId,
        shift_date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        shift_start: '18:00',
        shift_end: '02:00',
        required_skill: 'bar',
        urgency: 'normal',
        message: 'Bartender requested time off',
        status: 'pending'
      }
    ]

    const { data: emergencies, error: emergencyError } = await supabase
      .from('emergency_requests')
      .insert(emergencyData)
      .select()

    if (emergencyError) {
      console.error('❌ Error creating emergency requests:', emergencyError)
    } else {
      console.log(`✅ Created ${emergencies.length} emergency requests`)
    }

    // Create message logs for communication analytics
    console.log('💬 Creating message logs...')
    const messageData = []
    const messageTypes = ['emergency_request', 'shift_reminder', 'schedule_update']
    const platforms = ['whatsapp', 'sms', 'email']
    const statuses = ['sent', 'delivered', 'read']
    
    for (let i = 0; i < 50; i++) {
      const randomDate = new Date(today.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      messageData.push({
        business_id: businessId,
        staff_id: staff[Math.floor(Math.random() * staff.length)].id,
        message_type: messageTypes[Math.floor(Math.random() * messageTypes.length)],
        platform: platforms[Math.floor(Math.random() * platforms.length)],
        phone_number: '+44 7700 900000',
        message_content: 'Demo message for analytics',
        status: statuses[Math.floor(Math.random() * statuses.length)],
        sent_at: randomDate.toISOString()
      })
    }

    const { data: messages, error: messageError } = await supabase
      .from('message_logs')
      .insert(messageData)
      .select()

    if (messageError) {
      console.error('❌ Error creating message logs:', messageError)
    } else {
      console.log(`✅ Created ${messages.length} message logs`)
    }

    // Create some shift assignments to show coverage
    console.log('📋 Creating shift assignments...')
    const assignmentData = []
    
    // Assign staff to some shifts
    shifts.slice(0, 20).forEach((shift, index) => {
      const staffMember = staff[index % staff.length]
      if (shift.required_skill === 'kitchen' && staffMember.skills.includes('kitchen')) {
        assignmentData.push({
          shift_id: shift.id,
          staff_id: staffMember.id,
          status: 'assigned',
          assigned_at: new Date().toISOString()
        })
      } else if (shift.required_skill === 'front_of_house' && staffMember.skills.includes('front_of_house')) {
        assignmentData.push({
          shift_id: shift.id,
          staff_id: staffMember.id,
          status: 'assigned',
          assigned_at: new Date().toISOString()
        })
      } else if (shift.required_skill === 'bar' && staffMember.skills.includes('bar')) {
        assignmentData.push({
          shift_id: shift.id,
          staff_id: staffMember.id,
          status: 'assigned',
          assigned_at: new Date().toISOString()
        })
      }
    })

    if (assignmentData.length > 0) {
      const { data: assignments, error: assignmentError } = await supabase
        .from('shift_assignments')
        .insert(assignmentData)
        .select()

      if (assignmentError) {
        console.error('❌ Error creating assignments:', assignmentError)
      } else {
        console.log(`✅ Created ${assignments.length} shift assignments`)
      }
    }

    console.log('\n🎉 Demo data creation completed!')
    console.log('📊 Summary:')
    console.log(`   Business: The Grand Bistro (ID: ${businessId})`)
    console.log(`   Staff: ${staff.length} members`)
    console.log(`   Shifts: ${shifts.length} shifts over 2 weeks`)
    console.log(`   Emergency Requests: ${emergencies?.length || 0}`)
    console.log(`   Message Logs: ${messages?.length || 0}`)
    console.log(`   Assignments: ${assignmentData.length}`)
    console.log('\n🚀 Ready for demo! Features to showcase:')
    console.log('   • AI-powered scheduling')
    console.log('   • Staff management and availability')
    console.log('   • Emergency coverage requests')
    console.log('   • Communication analytics')
    console.log('   • Real-time metrics')
    console.log('   • Drag-and-drop shift management')

  } catch (error) {
    console.error('❌ Demo data creation failed:', error)
  }
}

createDemoData() 