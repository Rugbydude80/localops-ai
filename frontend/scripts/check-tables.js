const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTables() {
  console.log('🔍 Checking database tables...')

  const tables = ['businesses', 'staff', 'emergency_requests', 'shift_coverage', 'message_logs']
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1)
      
      if (error) {
        console.log(`❌ Table '${table}' does not exist or has issues:`, error.message)
      } else {
        console.log(`✅ Table '${table}' exists and is accessible`)
      }
    } catch (err) {
      console.log(`❌ Error checking table '${table}':`, err.message)
    }
  }
}

checkTables()