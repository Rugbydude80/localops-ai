const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('💰 Adding hourly rates to existing staff...')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function addHourlyRates() {
  try {
    console.log('\n👥 Fetching existing staff...')
    
    const { data: staff, error: fetchError } = await supabase
      .from('staff')
      .select('id, name, role, hourly_rate')

    if (fetchError) {
      console.error('❌ Error fetching staff:', fetchError)
      return
    }

    console.log(`📋 Found ${staff.length} staff members`)

    // Define hourly rates based on role
    const roleRates = {
      'chef': 16.50,
      'manager': 18.75,
      'supervisor': 15.25,
      'bartender': 14.25,
      'server': 11.75,
      'cook': 13.50,
      'cleaner': 10.50,
      'host': 11.25,
      'admin': 20.00,
      'owner': 25.00,
      'superadmin': 25.00
    }

    let updatedCount = 0

    for (const member of staff) {
      // Skip if already has hourly rate
      if (member.hourly_rate && member.hourly_rate > 0) {
        console.log(`   ✓ ${member.name} already has rate: £${member.hourly_rate}/hr`)
        continue
      }

      // Determine rate based on role
      const baseRate = roleRates[member.role] || 12.00
      // Add some variation (±£1)
      const hourlyRate = baseRate + (Math.random() - 0.5) * 2
      const finalRate = Math.round(hourlyRate * 100) / 100

      console.log(`   💰 Setting ${member.name} (${member.role}): £${finalRate}/hr`)

      const { error: updateError } = await supabase
        .from('staff')
        .update({
          hourly_rate: finalRate,
          currency: 'GBP'
        })
        .eq('id', member.id)

      if (updateError) {
        console.error(`❌ Error updating ${member.name}:`, updateError.message)
      } else {
        updatedCount++
      }
    }

    console.log(`\n✅ Updated ${updatedCount} staff members with hourly rates`)

    // Verify the updates
    console.log('\n🧪 Verifying updates...')
    const { data: updatedStaff, error: verifyError } = await supabase
      .from('staff')
      .select('id, name, role, hourly_rate, currency')

    if (verifyError) {
      console.error('❌ Error verifying updates:', verifyError)
    } else {
      console.log('✅ Updated staff rates:')
      updatedStaff.forEach(member => {
        const rate = member.hourly_rate || 0
        console.log(`   ${member.name} (${member.role}): £${rate}/hr`)
      })
    }

    console.log('\n🎉 Hourly rates setup complete!')
    console.log('\n💡 Now you can:')
    console.log('   • View projected pay calculations in shift assignments')
    console.log('   • See total shift costs in the dashboard')
    console.log('   • Track labor costs per shift')

  } catch (error) {
    console.error('❌ Hourly rates setup failed:', error)
  }
}

addHourlyRates()