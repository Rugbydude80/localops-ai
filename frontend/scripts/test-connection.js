const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔍 Testing Supabase connection...')
console.log('URL:', supabaseUrl ? 'Set' : 'Missing')
console.log('Key:', supabaseKey ? 'Set (length: ' + supabaseKey.length + ')' : 'Missing')

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  try {
    // Test 1: Check businesses table
    console.log('\n📊 Testing businesses table...')
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .limit(1)

    if (businessError) {
      console.error('❌ Business query error:', businessError)
    } else {
      console.log('✅ Businesses query successful:', businesses?.length || 0, 'records')
    }

    // Test 2: Check staff table
    console.log('\n👥 Testing staff table...')
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .limit(1)

    if (staffError) {
      console.error('❌ Staff query error:', staffError)
    } else {
      console.log('✅ Staff query successful:', staff?.length || 0, 'records')
    }

    // Test 3: Check shifts table
    console.log('\n📅 Testing shifts table...')
    const { data: shifts, error: shiftsError } = await supabase
      .from('shifts')
      .select('*')
      .limit(1)

    if (shiftsError) {
      console.error('❌ Shifts query error:', shiftsError)
    } else {
      console.log('✅ Shifts query successful:', shifts?.length || 0, 'records')
    }

    // Test 4: Try inserting a simple record
    console.log('\n✏️ Testing shifts insert...')
    const testShift = {
      business_id: 1,
      title: 'Connection Test',
      date: '2025-07-20',
      start_time: '10:00',
      end_time: '18:00',
      required_skill: 'test',
      required_staff_count: 1,
      status: 'scheduled'
    }

    const { data: insertResult, error: insertError } = await supabase
      .from('shifts')
      .insert([testShift])
      .select()

    if (insertError) {
      console.error('❌ Insert error:', insertError)
      console.error('Error code:', insertError.code)
      console.error('Error message:', insertError.message)
      console.error('Error details:', insertError.details)
      console.error('Error hint:', insertError.hint)
    } else {
      console.log('✅ Insert successful:', insertResult)
      
      // Clean up - delete the test record
      if (insertResult && insertResult.length > 0) {
        await supabase
          .from('shifts')
          .delete()
          .eq('id', insertResult[0].id)
        console.log('🧹 Test record cleaned up')
      }
    }

  } catch (error) {
    console.error('❌ Connection test failed:', error)
  }
}

testConnection()