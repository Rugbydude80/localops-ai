const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function createUserAccount() {
  console.log('🚀 Creating user account for Chris...')
  
  try {
    // Create Chris as a staff member
    const { data, error } = await supabase
      .from('staff')
      .insert({
        business_id: 1,
        name: 'Chris James Robertson',
        phone_number: '+44 7700 900007',
        email: 'chris@localops.ai',
        role: 'manager',
        skills: ['management', 'kitchen', 'front_of_house'],
        reliability_score: 9.5,
        max_weekly_hours: 45,
        contract_type: 'full_time',
        unavailable_times: [],
        is_active: true
      })
      .select()
      .single()
    
    if (error) {
      console.error('❌ Error creating user:', error)
      return
    }
    
    console.log('✅ User account created:', data.name, '(ID:', data.id + ')')
    
    // Assign Chris to some upcoming shifts for testing
    const { data: shifts } = await supabase
      .from('shifts')
      .select('id, title, date, start_time')
      .eq('business_id', 1)
      .gte('date', new Date().toISOString().split('T')[0])
      .limit(5)
    
    if (shifts && shifts.length > 0) {
      console.log('📅 Assigning to shifts...')
      for (const shift of shifts) {
        const { error: assignError } = await supabase
          .from('shift_assignments')
          .upsert({
            shift_id: shift.id,
            staff_id: data.id,
            status: 'assigned'
          }, { onConflict: 'shift_id,staff_id' })
        
        if (!assignError) {
          console.log('   ✅', shift.title, 'on', shift.date, 'at', shift.start_time)
        }
      }
      
      // Update shift statuses to 'filled' for assigned shifts
      const shiftIds = shifts.map(s => s.id)
      await supabase
        .from('shifts')
        .update({ status: 'filled' })
        .in('id', shiftIds)
      
      console.log('✅ Updated shift statuses to filled')
    }
    
    console.log('\n🎉 Setup complete!')
    console.log('📱 Your details:')
    console.log('   Name: Chris James Robertson')
    console.log('   Role: Manager')
    console.log('   Phone: +44 7700 900007')
    console.log('   Email: chris@localops.ai')
    console.log('   Skills: Management, Kitchen, Front of House')
    console.log('\n🚀 You can now:')
    console.log('   • View your assigned shifts in the calendar')
    console.log('   • Report sick leave to trigger automatic coverage')
    console.log('   • Test the WhatsApp notification system')
    
  } catch (error) {
    console.error('❌ Setup failed:', error)
  }
}

createUserAccount()