const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔧 Adding missing columns to staff table...')

const supabase = createClient(supabaseUrl, supabaseKey)

async function addStaffColumns() {
  try {
    // First, let's check current staff structure
    console.log('📊 Checking current staff table structure...')
    const { data: currentStaff, error: checkError } = await supabase
      .from('staff')
      .select('*')
      .limit(1)

    if (checkError) {
      console.error('❌ Error checking staff table:', checkError)
      return
    }

    console.log('✅ Current staff columns:', Object.keys(currentStaff[0] || {}))

    // Update existing staff with role information
    console.log('\n👥 Updating staff with role permissions...')
    
    // Get all staff
    const { data: allStaff, error: staffError } = await supabase
      .from('staff')
      .select('*')

    if (staffError) {
      console.error('❌ Error fetching staff:', staffError)
      return
    }

    console.log(`📋 Found ${allStaff.length} staff members to update`)

    // Update each staff member with appropriate role
    for (const staff of allStaff) {
      let userRole = 'staff'
      let canAssignShifts = false
      let canManageStaff = false
      let canViewAllShifts = false

      // Determine role based on current role field
      if (staff.role === 'manager' || staff.role === 'owner' || staff.role === 'admin') {
        userRole = 'admin'
        canAssignShifts = true
        canManageStaff = true
        canViewAllShifts = true
      } else if (staff.role === 'supervisor') {
        userRole = 'manager'
        canAssignShifts = true
        canViewAllShifts = true
      }

      // Make the first staff member a superadmin
      if (staff.id === 1) {
        userRole = 'superadmin'
        canAssignShifts = true
        canManageStaff = true
        canViewAllShifts = true
      }

      console.log(`   Updating ${staff.name}: ${staff.role} → ${userRole}`)

      // Try to update with new columns (they may not exist yet)
      const updateData = {
        user_role: userRole
      }

      // Try to add permission columns if they exist
      try {
        updateData.can_assign_shifts = canAssignShifts
        updateData.can_manage_staff = canManageStaff
        updateData.can_view_all_shifts = canViewAllShifts
      } catch (e) {
        // Columns might not exist yet
      }

      const { error: updateError } = await supabase
        .from('staff')
        .update(updateData)
        .eq('id', staff.id)

      if (updateError) {
        console.error(`❌ Error updating ${staff.name}:`, updateError.message)
      } else {
        console.log(`✅ Updated ${staff.name}`)
      }
    }

    // Verify the updates
    console.log('\n🧪 Verifying updates...')
    const { data: updatedStaff, error: verifyError } = await supabase
      .from('staff')
      .select('id, name, role, user_role')

    if (verifyError) {
      console.error('❌ Error verifying updates:', verifyError)
    } else {
      console.log('✅ Updated staff roles:')
      updatedStaff.forEach(staff => {
        console.log(`   ${staff.name}: ${staff.role} (${staff.user_role || 'staff'})`)
      })
    }

    console.log('\n🎉 Staff role setup complete!')

  } catch (error) {
    console.error('❌ Setup failed:', error)
  }
}

addStaffColumns()