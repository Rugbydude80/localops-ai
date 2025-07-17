const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🚀 Setting up LocalOps AI demo data...')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupDemoData() {
  try {
    console.log('\n🔍 Checking for existing business...')
    
    // Get or create business
    let { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .limit(1)

    let businessId
    if (businessError || !businesses || businesses.length === 0) {
      console.log('📝 Creating demo business...')
      const { data: newBusiness, error: createError } = await supabase
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

      if (createError) {
        console.error('❌ Error creating business:', createError)
        return
      }
      businessId = newBusiness.id
    } else {
      businessId = businesses[0].id
    }

    console.log(`✅ Using business ID: ${businessId}`)

    console.log('\n👥 Creating demo staff...')
    
    // Clear existing staff
    await supabase.from('staff').delete().eq('business_id', businessId)
    
    // Create demo staff with hourly rates
    const staffData = [
      {
        business_id: businessId,
        name: 'Emma Davis',
        phone_number: '+44 7700 900001',
        email: 'emma.davis@localops.ai',
        role: 'chef',
        skills: ['kitchen', 'management'],
        reliability_score: 7.8,
        is_active: true,
        hourly_rate: 16.50,
        currency: 'GBP'
      },
      {
        business_id: businessId,
        name: 'James Brown',
        phone_number: '+44 7700 900002',
        email: 'james.brown@localops.ai',
        role: 'bartender',
        skills: ['bar', 'front_of_house'],
        reliability_score: 8.9,
        is_active: true,
        hourly_rate: 14.25,
        currency: 'GBP'
      },
      {
        business_id: businessId,
        name: 'Lisa Garcia',
        phone_number: '+44 7700 900003',
        email: 'lisa.garcia@localops.ai',
        role: 'server',
        skills: ['front_of_house', 'bar'],
        reliability_score: 6.5,
        is_active: true,
        hourly_rate: 11.75,
        currency: 'GBP'
      },
      {
        business_id: businessId,
        name: 'Mike Taylor',
        phone_number: '+44 7700 900004',
        email: 'mike.taylor@localops.ai',
        role: 'cook',
        skills: ['kitchen'],
        reliability_score: 7.2,
        is_active: true,
        hourly_rate: 13.50,
        currency: 'GBP'
      },
      {
        business_id: businessId,
        name: 'Sarah Johnson',
        phone_number: '+44 7700 900005',
        email: 'sarah.johnson@localops.ai',
        role: 'manager',
        skills: ['management', 'front_of_house'],
        reliability_score: 9.2,
        is_active: true,
        hourly_rate: 18.75,
        currency: 'GBP'
      },
      {
        business_id: businessId,
        name: 'Tom Wilson',
        phone_number: '+44 7700 900006',
        email: 'tom.wilson@localops.ai',
        role: 'server',
        skills: ['front_of_house', 'cleaning'],
        reliability_score: 8.5,
        is_active: true,
        hourly_rate: 12.25,
        currency: 'GBP'
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

    console.log('\n📅 Creating demo shifts...')
    
    // Clear existing shifts
    await supabase.from('shifts').delete().eq('business_id', businessId)
    
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

    console.log('\n🚨 Creating emergency requests...')
    
    // Clear existing emergency requests
    await supabase.from('emergency_requests').delete().eq('business_id', businessId)
    
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

    console.log('\n💬 Creating message logs...')
    
    // Clear existing message logs
    await supabase.from('message_logs').delete().eq('business_id', businessId)
    
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

    console.log('\n🎉 Demo data setup complete!')
    console.log('\n📊 Summary:')
    console.log(`   • Business: LocalOps Demo Restaurant (ID: ${businessId})`)
    console.log(`   • Staff: ${insertedStaff.length} members`)
    console.log(`   • Shifts: ${insertedShifts.length} over 2 weeks`)
    console.log(`   • Emergency requests: ${insertedRequests.length}`)
    console.log(`   • Message logs: ${messageLogs.length}`)
    console.log('\n🚀 Ready to demo!')
    console.log('   • http://localhost:3000 - Staff management')
    console.log('   • http://localhost:3000/dashboard - Operations dashboard')
    console.log('   • http://localhost:3000/shifts - Shift calendar')
    console.log('   • http://localhost:3000/enhanced-dashboard - AI features')
    console.log('\n💡 Demo features:')
    console.log('   • Click on staff members to edit their details')
    console.log('   • Create emergency coverage requests')
    console.log('   • See WhatsApp messaging simulation in browser console')
    console.log('   • Report sick leave to trigger automatic replacement search')

  } catch (error) {
    console.error('❌ Demo data setup failed:', error)
  }
}

setupDemoData()