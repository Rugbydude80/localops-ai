const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixBusinessSetup() {
  try {
    console.log('🔧 Fixing business setup...')
    
    // Check if business exists
    let { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id, name')
      .limit(1)

    let businessId
    if (businessError || !businesses || businesses.length === 0) {
      console.log('📝 Creating business...')
      const { data: newBusiness, error: createError } = await supabase
        .from('businesses')
        .insert({
          name: "LocalOps Demo Restaurant",
          type: 'restaurant',
          phone_number: '+44 20 7123 4567',
          email: 'demo@localops.ai',
          address: '123 Demo Street, London, SW1A 1AA',
          owner_name: 'Demo Owner',
          subscription_tier: 'professional',
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

    // Clear existing staff
    console.log('🧹 Clearing existing staff...')
    await supabase.from('staff').delete().eq('business_id', businessId)

    // Create staff with correct schema
    console.log('👥 Creating staff...')
    const staffData = [
      {
        business_id: businessId,
        name: 'John Chef',
        phone_number: '+44 7700 900001',
        email: 'john@localops.ai',
        role: 'chef',
        skills: ['kitchen', 'grill', 'management'],
        availability: {
          monday: ['09:00-17:00'],
          tuesday: ['09:00-17:00'],
          wednesday: ['09:00-17:00'],
          thursday: ['09:00-17:00'],
          friday: ['09:00-17:00']
        },
        reliability_score: 8.5,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'Jane Server',
        phone_number: '+44 7700 900002',
        email: 'jane@localops.ai',
        role: 'server',
        skills: ['front_of_house', 'customer_service'],
        availability: {
          monday: ['17:00-23:00'],
          tuesday: ['17:00-23:00'],
          wednesday: ['17:00-23:00'],
          thursday: ['17:00-23:00'],
          friday: ['17:00-23:00'],
          saturday: ['12:00-23:00']
        },
        reliability_score: 9.0,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'Bob Bartender',
        phone_number: '+44 7700 900003',
        email: 'bob@localops.ai',
        role: 'bartender',
        skills: ['bar', 'cocktails', 'customer_service'],
        availability: {
          monday: ['18:00-02:00'],
          tuesday: ['18:00-02:00'],
          wednesday: ['18:00-02:00'],
          thursday: ['18:00-02:00'],
          friday: ['18:00-02:00'],
          saturday: ['18:00-02:00']
        },
        reliability_score: 7.5,
        is_active: true
      },
      {
        business_id: businessId,
        name: 'Sarah Manager',
        phone_number: '+44 7700 900004',
        email: 'sarah@localops.ai',
        role: 'manager',
        skills: ['management', 'kitchen', 'front_of_house'],
        availability: {
          monday: ['08:00-18:00'],
          tuesday: ['08:00-18:00'],
          wednesday: ['08:00-18:00'],
          thursday: ['08:00-18:00'],
          friday: ['08:00-18:00'],
          saturday: ['10:00-20:00']
        },
        reliability_score: 9.5,
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

    // Create some sample shifts
    console.log('📅 Creating sample shifts...')
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const shiftsData = [
      {
        business_id: businessId,
        title: 'Morning Kitchen',
        date: tomorrow.toISOString().split('T')[0],
        start_time: '09:00',
        end_time: '17:00',
        required_skill: 'kitchen',
        required_staff_count: 2,
        hourly_rate: 12.50,
        notes: 'Prep for lunch service',
        status: 'scheduled'
      },
      {
        business_id: businessId,
        title: 'Evening Service',
        date: tomorrow.toISOString().split('T')[0],
        start_time: '17:00',
        end_time: '23:00',
        required_skill: 'front_of_house',
        required_staff_count: 3,
        hourly_rate: 10.50,
        notes: 'Dinner service',
        status: 'scheduled'
      },
      {
        business_id: businessId,
        title: 'Bar Service',
        date: tomorrow.toISOString().split('T')[0],
        start_time: '18:00',
        end_time: '02:00',
        required_skill: 'bar',
        required_staff_count: 1,
        hourly_rate: 11.00,
        notes: 'Evening bar service',
        status: 'scheduled'
      }
    ]

    const { data: shifts, error: shiftsError } = await supabase
      .from('shifts')
      .insert(shiftsData)
      .select()

    if (shiftsError) {
      console.error('❌ Error creating shifts:', shiftsError)
      return
    }

    console.log(`✅ Created ${shifts.length} shifts`)

    console.log('🎉 Business setup completed successfully!')
    console.log(`Business ID: ${businessId}`)
    console.log(`Staff count: ${staff.length}`)
    console.log(`Shifts created: ${shifts.length}`)

  } catch (error) {
    console.error('❌ Setup failed:', error)
  }
}

fixBusinessSetup() 