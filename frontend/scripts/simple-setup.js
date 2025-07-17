const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function simpleSetup() {
  console.log('🚀 Simple LocalOps AI setup...')

  try {
    // First, let's create some demo shifts manually without relying on the shifts table
    // We'll use the existing emergency_requests table to simulate shifts
    
    console.log('📝 Creating demo data using existing tables...')
    
    // Get the business ID
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id')
      .limit(1)

    if (!businesses || businesses.length === 0) {
      console.error('❌ No business found')
      return
    }

    const businessId = businesses[0].id
    console.log(`Using business ID: ${businessId}`)

    // Create enhanced staff data
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

    // Clear existing staff
    await supabase
      .from('staff')
      .delete()
      .eq('business_id', businessId)

    // Insert new staff
    const { data: insertedStaff, error: staffError } = await supabase
      .from('staff')
      .insert(staffData)
      .select()

    if (staffError) {
      console.error('❌ Error inserting staff:', staffError)
      return
    }

    console.log(`✅ Inserted ${insertedStaff.length} staff members`)

    // Create more emergency requests to simulate shifts
    const today = new Date()
    const emergencyRequests = []

    for (let i = 0; i < 10; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      
      const skills = ['kitchen', 'bar', 'front_of_house', 'management']
      const urgencies = ['low', 'normal', 'high']
      const statuses = ['pending', 'filled', 'pending']
      
      emergencyRequests.push({
        business_id: businessId,
        shift_date: date.toISOString(),
        shift_start: ['06:00', '12:00', '18:00'][i % 3],
        shift_end: ['14:00', '18:00', '23:00'][i % 3],
        required_skill: skills[i % skills.length],
        urgency: urgencies[i % urgencies.length],
        message: `Need ${skills[i % skills.length]} staff for ${date.toDateString()}`,
        status: statuses[i % statuses.length]
      })
    }

    // Clear existing emergency requests
    await supabase
      .from('emergency_requests')
      .delete()
      .eq('business_id', businessId)

    // Insert new emergency requests
    const { data: insertedRequests, error: requestsError } = await supabase
      .from('emergency_requests')
      .insert(emergencyRequests)
      .select()

    if (requestsError) {
      console.error('❌ Error inserting emergency requests:', requestsError)
      return
    }

    console.log(`✅ Inserted ${insertedRequests.length} emergency requests`)

    // Create message logs
    const messageLogs = []
    for (let i = 0; i < 15; i++) {
      const randomStaff = insertedStaff[Math.floor(Math.random() * insertedStaff.length)]
      messageLogs.push({
        business_id: businessId,
        staff_id: randomStaff.id,
        message_type: 'emergency_request',
        platform: 'whatsapp',
        phone_number: randomStaff.phone_number,
        message_content: `Hi ${randomStaff.name}, we need coverage for tomorrow. Can you help?`,
        external_message_id: `demo_${Date.now()}_${i}`,
        status: ['sent', 'delivered', 'read'][Math.floor(Math.random() * 3)]
      })
    }

    const { data: insertedMessages, error: messagesError } = await supabase
      .from('message_logs')
      .insert(messageLogs)

    if (messagesError) {
      console.error('❌ Error inserting message logs:', messagesError)
    } else {
      console.log(`✅ Inserted ${messageLogs.length} message logs`)
    }

    console.log('\n🎉 Simple demo setup complete!')
    console.log('\n📊 Summary:')
    console.log(`   • ${insertedStaff.length} staff members with realistic data`)
    console.log(`   • ${insertedRequests.length} emergency requests (simulating shifts)`)
    console.log(`   • ${messageLogs.length} WhatsApp message logs`)
    console.log('\n🚀 You can now demo the application!')
    console.log('   • Visit http://localhost:3000 for staff management')
    console.log('   • Visit http://localhost:3000/dashboard for operations overview')
    console.log('   • Click on staff members to edit their details')
    console.log('   • Create emergency coverage requests')
    console.log('   • See WhatsApp messaging simulation in action')

  } catch (error) {
    console.error('❌ Setup failed:', error)
  }
}

simpleSetup()