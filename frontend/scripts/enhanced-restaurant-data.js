const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🚀 Setting up Enhanced Restaurant Demo Data...')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupEnhancedRestaurantData() {
  try {
    console.log('\n🔍 Checking for existing business...')
    
    // Get or create business
    let { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .limit(1)

    let businessId
    if (businessError || !businesses || businesses.length === 0) {
      console.log('📝 Creating demo restaurant business...')
      const { data: newBusiness, error: createError } = await supabase
        .from('businesses')
        .insert({
          name: "The Local Pub & Kitchen",
          type: 'restaurant',
          phone_number: '+44 20 7123 4567',
          email: 'manager@localpubkitchen.co.uk',
          address: '123 High Street, London, SW1A 1AA',
          owner_name: 'Sarah Johnson',
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

    console.log('\n👥 Creating enhanced restaurant staff...')
    
    // Clear existing staff
    await supabase.from('staff').delete().eq('business_id', businessId)
    
    // Create realistic restaurant staff with detailed roles and availability
    const staffData = [
      {
        business_id: businessId,
        name: 'Chef Michael',
        phone_number: '+44 7700 900001',
        email: 'chef.michael@localpubkitchen.co.uk',
        role: 'head_chef',
        skills: ['kitchen', 'management', 'food_safety'],
        reliability_score: 9.2,
        is_active: true,
        availability: {
          monday: ['06:00-16:00'],
          tuesday: ['06:00-16:00'],
          wednesday: ['06:00-16:00'],
          thursday: ['06:00-16:00'],
          friday: ['06:00-16:00'],
          saturday: ['06:00-16:00'],
          sunday: ['06:00-16:00']
        }
      },
      {
        business_id: businessId,
        name: 'Chef Emma',
        phone_number: '+44 7700 900002',
        email: 'chef.emma@localpubkitchen.co.uk',
        role: 'sous_chef',
        skills: ['kitchen', 'food_safety'],
        reliability_score: 8.8,
        is_active: true,
        availability: {
          monday: ['14:00-22:00'],
          tuesday: ['14:00-22:00'],
          wednesday: ['14:00-22:00'],
          thursday: ['14:00-22:00'],
          friday: ['14:00-22:00'],
          saturday: ['14:00-22:00'],
          sunday: ['14:00-22:00']
        }
      },
      {
        business_id: businessId,
        name: 'Chef David',
        phone_number: '+44 7700 900003',
        email: 'chef.david@localpubkitchen.co.uk',
        role: 'line_cook',
        skills: ['kitchen'],
        reliability_score: 7.5,
        is_active: true,
        availability: {
          monday: ['10:00-18:00'],
          tuesday: ['10:00-18:00'],
          wednesday: ['10:00-18:00'],
          thursday: ['10:00-18:00'],
          friday: ['10:00-18:00'],
          saturday: ['10:00-18:00'],
          sunday: ['10:00-18:00']
        }
      },
      {
        business_id: businessId,
        name: 'Manager Sarah',
        phone_number: '+44 7700 900004',
        email: 'manager.sarah@localpubkitchen.co.uk',
        role: 'manager',
        skills: ['management', 'front_of_house', 'bar'],
        reliability_score: 9.5,
        is_active: true,
        availability: {
          monday: ['09:00-17:00'],
          tuesday: ['09:00-17:00'],
          wednesday: ['09:00-17:00'],
          thursday: ['09:00-17:00'],
          friday: ['09:00-17:00'],
          saturday: ['09:00-17:00'],
          sunday: ['09:00-17:00']
        }
      },
      {
        business_id: businessId,
        name: 'Bartender James',
        phone_number: '+44 7700 900005',
        email: 'bartender.james@localpubkitchen.co.uk',
        role: 'bartender',
        skills: ['bar', 'front_of_house'],
        reliability_score: 8.9,
        is_active: true,
        availability: {
          monday: ['16:00-00:00'],
          tuesday: ['16:00-00:00'],
          wednesday: ['16:00-00:00'],
          thursday: ['16:00-00:00'],
          friday: ['16:00-00:00'],
          saturday: ['16:00-00:00'],
          sunday: ['16:00-00:00']
        }
      },
      {
        business_id: businessId,
        name: 'Bartender Lisa',
        phone_number: '+44 7700 900006',
        email: 'bartender.lisa@localpubkitchen.co.uk',
        role: 'bartender',
        skills: ['bar', 'front_of_house'],
        reliability_score: 8.2,
        is_active: true,
        availability: {
          monday: ['12:00-20:00'],
          tuesday: ['12:00-20:00'],
          wednesday: ['12:00-20:00'],
          thursday: ['12:00-20:00'],
          friday: ['12:00-20:00'],
          saturday: ['12:00-20:00'],
          sunday: ['12:00-20:00']
        }
      },
      {
        business_id: businessId,
        name: 'Server Tom',
        phone_number: '+44 7700 900007',
        email: 'server.tom@localpubkitchen.co.uk',
        role: 'server',
        skills: ['front_of_house'],
        reliability_score: 8.7,
        is_active: true,
        availability: {
          monday: ['11:00-19:00'],
          tuesday: ['11:00-19:00'],
          wednesday: ['11:00-19:00'],
          thursday: ['11:00-19:00'],
          friday: ['11:00-19:00'],
          saturday: ['11:00-19:00'],
          sunday: ['11:00-19:00']
        }
      },
      {
        business_id: businessId,
        name: 'Server Anna',
        phone_number: '+44 7700 900008',
        email: 'server.anna@localpubkitchen.co.uk',
        role: 'server',
        skills: ['front_of_house'],
        reliability_score: 7.8,
        is_active: true,
        availability: {
          monday: ['17:00-23:00'],
          tuesday: ['17:00-23:00'],
          wednesday: ['17:00-23:00'],
          thursday: ['17:00-23:00'],
          friday: ['17:00-23:00'],
          saturday: ['17:00-23:00'],
          sunday: ['17:00-23:00']
        }
      },
      {
        business_id: businessId,
        name: 'Server Mark',
        phone_number: '+44 7700 900009',
        email: 'server.mark@localpubkitchen.co.uk',
        role: 'server',
        skills: ['front_of_house'],
        reliability_score: 8.1,
        is_active: true,
        availability: {
          monday: ['12:00-20:00'],
          tuesday: ['12:00-20:00'],
          wednesday: ['12:00-20:00'],
          thursday: ['12:00-20:00'],
          friday: ['12:00-20:00'],
          saturday: ['12:00-20:00'],
          sunday: ['12:00-20:00']
        }
      },
      {
        business_id: businessId,
        name: 'Server Rachel',
        phone_number: '+44 7700 900010',
        email: 'server.rachel@localpubkitchen.co.uk',
        role: 'server',
        skills: ['front_of_house'],
        reliability_score: 8.4,
        is_active: true,
        availability: {
          monday: ['18:00-00:00'],
          tuesday: ['18:00-00:00'],
          wednesday: ['18:00-00:00'],
          thursday: ['18:00-00:00'],
          friday: ['18:00-00:00'],
          saturday: ['18:00-00:00'],
          sunday: ['18:00-00:00']
        }
      },
      {
        business_id: businessId,
        name: 'Kitchen Porter Alex',
        phone_number: '+44 7700 900011',
        email: 'porter.alex@localpubkitchen.co.uk',
        role: 'kitchen_porter',
        skills: ['kitchen', 'cleaning'],
        reliability_score: 7.2,
        is_active: true,
        availability: {
          monday: ['08:00-16:00'],
          tuesday: ['08:00-16:00'],
          wednesday: ['08:00-16:00'],
          thursday: ['08:00-16:00'],
          friday: ['08:00-16:00'],
          saturday: ['08:00-16:00'],
          sunday: ['08:00-16:00']
        }
      },
      {
        business_id: businessId,
        name: 'Kitchen Porter Maria',
        phone_number: '+44 7700 900012',
        email: 'porter.maria@localpubkitchen.co.uk',
        role: 'kitchen_porter',
        skills: ['kitchen', 'cleaning'],
        reliability_score: 7.8,
        is_active: true,
        availability: {
          monday: ['16:00-00:00'],
          tuesday: ['16:00-00:00'],
          wednesday: ['16:00-00:00'],
          thursday: ['16:00-00:00'],
          friday: ['16:00-00:00'],
          saturday: ['16:00-00:00'],
          sunday: ['16:00-00:00']
        }
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

    console.log('\n📅 Creating 4 weeks of restaurant shifts...')
    
    // Clear existing shifts
    await supabase.from('shifts').delete().eq('business_id', businessId)
    
    // Standard restaurant shift patterns
    const shiftTemplates = [
      // Kitchen shifts
      { name: 'Kitchen Prep', skill: 'kitchen', start: '06:00', end: '14:00', staff_needed: 2, hourly_rate: 15.00 },
      { name: 'Lunch Kitchen', skill: 'kitchen', start: '10:00', end: '18:00', staff_needed: 2, hourly_rate: 15.00 },
      { name: 'Dinner Kitchen', skill: 'kitchen', start: '14:00', end: '22:00', staff_needed: 2, hourly_rate: 15.00 },
      { name: 'Late Kitchen', skill: 'kitchen', start: '18:00', end: '00:00', staff_needed: 1, hourly_rate: 15.00 },
      
      // Front of house shifts
      { name: 'Lunch Service', skill: 'front_of_house', start: '11:00', end: '16:00', staff_needed: 3, hourly_rate: 12.50 },
      { name: 'Dinner Service', skill: 'front_of_house', start: '17:00', end: '23:00', staff_needed: 4, hourly_rate: 12.50 },
      { name: 'Late Service', skill: 'front_of_house', start: '20:00', end: '00:00', staff_needed: 2, hourly_rate: 12.50 },
      
      // Bar shifts
      { name: 'Bar Setup', skill: 'bar', start: '12:00', end: '20:00', staff_needed: 1, hourly_rate: 15.00 },
      { name: 'Bar Service', skill: 'bar', start: '16:00', end: '00:00', staff_needed: 2, hourly_rate: 15.00 },
      
      // Management shifts
      { name: 'Management', skill: 'management', start: '09:00', end: '17:00', staff_needed: 1, hourly_rate: 20.00 }
    ]

    const shifts = []
    const today = new Date()
    
    // Create shifts for 4 weeks
    for (let dayOffset = 0; dayOffset < 28; dayOffset++) {
      const shiftDate = new Date(today)
      shiftDate.setDate(today.getDate() + dayOffset)
      const dayOfWeek = shiftDate.getDay() // 0 = Sunday, 1 = Monday, etc.
      
      // Different shift patterns for different days
      let dailyShifts = []
      
      if (dayOfWeek === 0) { // Sunday - quieter
        dailyShifts = [
          { name: 'Kitchen Prep', skill: 'kitchen', start: '08:00', end: '16:00', staff_needed: 1, hourly_rate: 15.00 },
          { name: 'Sunday Service', skill: 'front_of_house', start: '12:00', end: '18:00', staff_needed: 2, hourly_rate: 12.50 },
          { name: 'Sunday Bar', skill: 'bar', start: '12:00', end: '18:00', staff_needed: 1, hourly_rate: 15.00 }
        ]
      } else if (dayOfWeek === 6) { // Saturday - busiest
        dailyShifts = [
          { name: 'Kitchen Prep', skill: 'kitchen', start: '06:00', end: '14:00', staff_needed: 2, hourly_rate: 15.00 },
          { name: 'Lunch Kitchen', skill: 'kitchen', start: '10:00', end: '18:00', staff_needed: 2, hourly_rate: 15.00 },
          { name: 'Dinner Kitchen', skill: 'kitchen', start: '14:00', end: '22:00', staff_needed: 2, hourly_rate: 15.00 },
          { name: 'Late Kitchen', skill: 'kitchen', start: '18:00', end: '00:00', staff_needed: 1, hourly_rate: 15.00 },
          { name: 'Lunch Service', skill: 'front_of_house', start: '11:00', end: '16:00', staff_needed: 3, hourly_rate: 12.50 },
          { name: 'Dinner Service', skill: 'front_of_house', start: '17:00', end: '23:00', staff_needed: 4, hourly_rate: 12.50 },
          { name: 'Late Service', skill: 'front_of_house', start: '20:00', end: '00:00', staff_needed: 2, hourly_rate: 12.50 },
          { name: 'Bar Setup', skill: 'bar', start: '12:00', end: '20:00', staff_needed: 1, hourly_rate: 15.00 },
          { name: 'Bar Service', skill: 'bar', start: '16:00', end: '00:00', staff_needed: 2, hourly_rate: 15.00 },
          { name: 'Management', skill: 'management', start: '09:00', end: '17:00', staff_needed: 1, hourly_rate: 20.00 }
        ]
      } else { // Weekdays
        dailyShifts = [
          { name: 'Kitchen Prep', skill: 'kitchen', start: '06:00', end: '14:00', staff_needed: 2, hourly_rate: 15.00 },
          { name: 'Lunch Kitchen', skill: 'kitchen', start: '10:00', end: '18:00', staff_needed: 2, hourly_rate: 15.00 },
          { name: 'Dinner Kitchen', skill: 'kitchen', start: '14:00', end: '22:00', staff_needed: 2, hourly_rate: 15.00 },
          { name: 'Lunch Service', skill: 'front_of_house', start: '11:00', end: '16:00', staff_needed: 3, hourly_rate: 12.50 },
          { name: 'Dinner Service', skill: 'front_of_house', start: '17:00', end: '23:00', staff_needed: 4, hourly_rate: 12.50 },
          { name: 'Bar Setup', skill: 'bar', start: '12:00', end: '20:00', staff_needed: 1, hourly_rate: 15.00 },
          { name: 'Bar Service', skill: 'bar', start: '16:00', end: '00:00', staff_needed: 2, hourly_rate: 15.00 },
          { name: 'Management', skill: 'management', start: '09:00', end: '17:00', staff_needed: 1, hourly_rate: 20.00 }
        ]
      }
      
      for (const template of dailyShifts) {
        const status = ['scheduled', 'open'][Math.floor(Math.random() * 2)]
        
        shifts.push({
          business_id: businessId,
          title: template.name,
          date: shiftDate.toISOString().split('T')[0],
          start_time: template.start,
          end_time: template.end,
          required_skill: template.skill,
          required_staff_count: template.staff_needed,
          hourly_rate: template.hourly_rate,
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

    console.log(`✅ Created ${insertedShifts.length} shifts over 4 weeks`)

    console.log('\n🔧 Creating scheduling constraints...')
    
    // Clear existing constraints
    await supabase.from('scheduling_constraints').delete().eq('business_id', businessId)
    
    // Create business constraints
    const constraints = [
      {
        business_id: businessId,
        constraint_type: 'max_hours',
        constraint_value: { max_weekly_hours: 40, max_daily_hours: 8 },
        priority: 'high',
        is_active: true
      },
      {
        business_id: businessId,
        constraint_type: 'min_rest',
        constraint_value: { min_rest_hours: 11, min_rest_between_shifts: 8 },
        priority: 'high',
        is_active: true
      },
      {
        business_id: businessId,
        constraint_type: 'skill_match',
        constraint_value: { require_skill_match: true, allow_skill_upgrade: true },
        priority: 'critical',
        is_active: true
      },
      {
        business_id: businessId,
        constraint_type: 'fair_distribution',
        constraint_value: { max_consecutive_days: 6, min_days_off: 1 },
        priority: 'medium',
        is_active: true
      },
      {
        business_id: businessId,
        constraint_type: 'labor_cost',
        constraint_value: { max_hourly_rate: 20, target_labor_percentage: 25 },
        priority: 'medium',
        is_active: true
      }
    ]

    const { data: insertedConstraints, error: constraintsError } = await supabase
      .from('scheduling_constraints')
      .insert(constraints)
      .select()

    if (constraintsError) {
      console.error('❌ Error creating constraints:', constraintsError)
      return
    }

    console.log(`✅ Created ${insertedConstraints.length} scheduling constraints`)

    console.log('\n📊 Creating staff preferences...')
    
    // Clear existing preferences
    await supabase.from('staff_preferences').delete().eq('staff_id', businessId)
    
    // Create some staff preferences
    const preferences = [
      {
        staff_id: insertedStaff[0].id, // Chef Michael
        preference_type: 'shift_time',
        preference_value: { preferred_start: '06:00', preferred_end: '16:00' },
        priority: 'high',
        effective_date: new Date().toISOString().split('T')[0],
        is_active: true
      },
      {
        staff_id: insertedStaff[1].id, // Chef Emma
        preference_type: 'day_off',
        preference_value: { preferred_days_off: ['monday'] },
        priority: 'medium',
        effective_date: new Date().toISOString().split('T')[0],
        is_active: true
      },
      {
        staff_id: insertedStaff[3].id, // Manager Sarah
        preference_type: 'max_hours',
        preference_value: { max_weekly_hours: 45 },
        priority: 'high',
        effective_date: new Date().toISOString().split('T')[0],
        is_active: true
      }
    ]

    const { data: insertedPreferences, error: preferencesError } = await supabase
      .from('staff_preferences')
      .insert(preferences)
      .select()

    if (preferencesError) {
      console.error('❌ Error creating preferences:', preferencesError)
      return
    }

    console.log(`✅ Created ${insertedPreferences.length} staff preferences`)

    console.log('\n🎯 Creating some initial shift assignments...')
    
    // Create some initial assignments for the first week
    const assignments = []
    const firstWeekShifts = insertedShifts.filter(shift => {
      const shiftDate = new Date(shift.date)
      const weekStart = new Date(today)
      const weekEnd = new Date(today)
      weekEnd.setDate(today.getDate() + 7)
      return shiftDate >= weekStart && shiftDate <= weekEnd
    })

    // Assign some staff to shifts based on skills and availability
    for (const shift of firstWeekShifts.slice(0, 20)) { // Assign first 20 shifts
      const suitableStaff = insertedStaff.filter(staff => 
        staff.skills.includes(shift.required_skill) && staff.is_active
      )
      
      if (suitableStaff.length > 0) {
        const assignedStaff = suitableStaff[Math.floor(Math.random() * suitableStaff.length)]
        assignments.push({
          shift_id: shift.id,
          staff_id: assignedStaff.id,
          status: 'assigned',
          assigned_at: new Date().toISOString()
        })
      }
    }

    if (assignments.length > 0) {
      const { data: insertedAssignments, error: assignmentsError } = await supabase
        .from('shift_assignments')
        .insert(assignments)
        .select()

      if (assignmentsError) {
        console.error('❌ Error creating assignments:', assignmentsError)
      } else {
        console.log(`✅ Created ${insertedAssignments.length} initial shift assignments`)
      }
    }

    console.log('\n✅ Enhanced restaurant demo data setup complete!')
    console.log(`📊 Summary:`)
    console.log(`   - Business: The Local Pub & Kitchen`)
    console.log(`   - Staff: ${insertedStaff.length} members (2 chefs, 1 manager, 2 bartenders, 4 servers, 2 kitchen porters)`)
    console.log(`   - Shifts: ${insertedShifts.length} shifts over 4 weeks`)
    console.log(`   - Constraints: ${insertedConstraints.length} scheduling rules`)
    console.log(`   - Preferences: ${insertedPreferences.length} staff preferences`)
    console.log(`   - Initial assignments: ${assignments.length} shifts assigned`)
    
    console.log('\n🎯 Ready for AI scheduling! The system now has:')
    console.log('   - Realistic restaurant staff with proper skills and availability')
    console.log('   - Standard restaurant shift patterns (kitchen, front of house, bar)')
    console.log('   - 4 weeks of shifts to schedule')
    console.log('   - Business constraints and staff preferences')
    console.log('   - Average 2 chefs and 3-4 front of house staff per shift')

  } catch (error) {
    console.error('❌ Setup failed:', error)
  }
}

setupEnhancedRestaurantData() 