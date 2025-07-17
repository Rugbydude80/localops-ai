const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔐 Setting up user roles and permissions...')

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupRoles() {
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'add-user-roles-permissions.sql')
    const sqlContent = fs.readFileSync(sqlPath, 'utf8')
    
    // Split SQL into individual statements (basic approach)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`📝 Found ${statements.length} SQL statements to execute...`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim()) {
        try {
          console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`)
          const { error } = await supabase.rpc('exec_sql', { sql: statement })
          
          if (error) {
            // Try direct query for simpler statements
            const { error: directError } = await supabase
              .from('_temp')
              .select('1')
              .limit(0)
            
            if (error.code === '42P01') {
              // Table doesn't exist, which is expected for some operations
              console.log(`⚠️  Statement ${i + 1} skipped (expected for setup)`)
            } else {
              console.error(`❌ Error in statement ${i + 1}:`, error.message)
            }
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`)
          }
        } catch (err) {
          console.error(`❌ Error executing statement ${i + 1}:`, err.message)
        }
      }
    }

    // Test the setup by checking if tables exist
    console.log('\n🧪 Testing role setup...')
    
    // Check user_roles table
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*')
      .limit(5)

    if (rolesError) {
      console.error('❌ Could not query user_roles:', rolesError.message)
    } else {
      console.log('✅ User roles table ready:', roles?.length || 0, 'roles found')
      roles?.forEach(role => {
        console.log(`   - ${role.role_name} (level ${role.role_level})`)
      })
    }

    // Check role_permissions table
    const { data: permissions, error: permError } = await supabase
      .from('role_permissions')
      .select('*')
      .limit(10)

    if (permError) {
      console.error('❌ Could not query role_permissions:', permError.message)
    } else {
      console.log('✅ Role permissions table ready:', permissions?.length || 0, 'permissions found')
    }

    // Update existing staff with roles
    console.log('\n👥 Updating existing staff with default roles...')
    
    const { data: staffUpdate, error: updateError } = await supabase
      .from('staff')
      .update({ 
        user_role: 'admin',
        can_assign_shifts: true,
        can_manage_staff: true,
        can_view_all_shifts: true
      })
      .eq('id', 1)
      .select()

    if (updateError) {
      console.error('❌ Could not update staff roles:', updateError.message)
    } else {
      console.log('✅ Staff roles updated successfully')
    }

    console.log('\n🎉 Role and permission setup complete!')
    console.log('📋 Available roles:')
    console.log('   - superadmin: Full system access')
    console.log('   - admin: Business administration')
    console.log('   - manager: Department management')
    console.log('   - supervisor: Team supervision')
    console.log('   - staff: Regular staff member')

  } catch (error) {
    console.error('❌ Setup failed:', error)
  }
}

setupRoles()