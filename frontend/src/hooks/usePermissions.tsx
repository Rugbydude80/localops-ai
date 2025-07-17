import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export interface UserRole {
  role_name: string
  role_level: number
  description: string
}

export interface Permission {
  permission_name: string
  permission_value: boolean
}

export interface CurrentUser {
  id: number
  name: string
  user_role: string
  can_assign_shifts: boolean
  can_manage_staff: boolean
  can_view_all_shifts: boolean
  department?: string
  reports_to?: number
}

export interface PermissionContext {
  currentUser: CurrentUser | null
  userRole: UserRole | null
  permissions: Permission[]
  loading: boolean
  error: string | null
  
  // Permission check functions
  canAssignShiftToUser: (targetUserId: number) => boolean
  canManageUser: (targetUserId: number) => boolean
  hasPermission: (permissionName: string) => boolean
  canViewShift: (shiftId: number) => boolean
  canCreateShift: () => boolean
  canDeleteShift: () => boolean
  canManageStaff: () => boolean
  canViewAllData: () => boolean
  isAdmin: () => boolean
  isSuperAdmin: () => boolean
  isManager: () => boolean
  isSupervisor: () => boolean
  isStaff: () => boolean
}

// Mock current user - in real app, this would come from authentication
const MOCK_CURRENT_USER_ID = 1

export function usePermissions(): PermissionContext {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadUserPermissions()
  }, [])

  const loadUserPermissions = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get current user info
      const { data: userData, error: userError } = await supabase
        .from('staff')
        .select(`
          id,
          name,
          user_role,
          can_assign_shifts,
          can_manage_staff,
          can_view_all_shifts,
          department,
          reports_to
        `)
        .eq('id', MOCK_CURRENT_USER_ID)
        .single()

      if (userError) throw userError

      setCurrentUser(userData)

      // Get role information
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role_name', userData.user_role)
        .single()

      if (roleError) throw roleError

      setUserRole(roleData)

      // Get permissions for this role
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('role_permissions')
        .select('permission_name, permission_value')
        .eq('role_name', userData.user_role)

      if (permissionsError) throw permissionsError

      setPermissions(permissionsData || [])

    } catch (err: any) {
      console.error('Error loading user permissions:', err)
      setError(err.message || 'Failed to load permissions')
    } finally {
      setLoading(false)
    }
  }

  const hasPermission = (permissionName: string): boolean => {
    const permission = permissions.find(p => p.permission_name === permissionName)
    return permission?.permission_value || false
  }

  const canAssignShiftToUser = (targetUserId: number): boolean => {
    if (!currentUser || !userRole) return false

    // Self-assignment is always allowed for staff
    if (currentUser.id === targetUserId) {
      return hasPermission('assign_self_to_shifts')
    }

    // Check role-based permissions
    if (hasPermission('assign_any_shift')) return true
    if (hasPermission('manage_all_staff')) return true
    
    // For managers and supervisors, we'd need to check the target user's role
    // This would require additional database queries in a real implementation
    return currentUser.can_assign_shifts
  }

  const canManageUser = (targetUserId: number): boolean => {
    if (!currentUser || !userRole) return false
    
    if (currentUser.id === targetUserId) return true
    if (hasPermission('manage_all_staff')) return true
    if (hasPermission('manage_department_staff')) return true
    
    return currentUser.can_manage_staff
  }

  const canViewShift = (shiftId: number): boolean => {
    if (!currentUser) return false
    
    if (hasPermission('view_all_data')) return true
    if (currentUser.can_view_all_shifts) return true
    if (hasPermission('view_own_shifts')) return true
    
    return false
  }

  const canCreateShift = (): boolean => {
    return hasPermission('create_shifts') || currentUser?.can_assign_shifts || false
  }

  const canDeleteShift = (): boolean => {
    return hasPermission('delete_shifts')
  }

  const canManageStaff = (): boolean => {
    return hasPermission('manage_all_staff') || 
           hasPermission('manage_department_staff') || 
           currentUser?.can_manage_staff || 
           false
  }

  const canViewAllData = (): boolean => {
    return hasPermission('view_all_data') || currentUser?.can_view_all_shifts || false
  }

  const isAdmin = (): boolean => {
    return currentUser?.user_role === 'admin'
  }

  const isSuperAdmin = (): boolean => {
    return currentUser?.user_role === 'superadmin'
  }

  const isManager = (): boolean => {
    return currentUser?.user_role === 'manager'
  }

  const isSupervisor = (): boolean => {
    return currentUser?.user_role === 'supervisor'
  }

  const isStaff = (): boolean => {
    return currentUser?.user_role === 'staff'
  }

  return {
    currentUser,
    userRole,
    permissions,
    loading,
    error,
    canAssignShiftToUser,
    canManageUser,
    hasPermission,
    canViewShift,
    canCreateShift,
    canDeleteShift,
    canManageStaff,
    canViewAllData,
    isAdmin,
    isSuperAdmin,
    isManager,
    isSupervisor,
    isStaff
  }
}

// Permission-based component wrapper
export function withPermission<T extends object>(
  Component: React.ComponentType<T>,
  requiredPermission: string | ((permissions: PermissionContext) => boolean)
) {
  return function PermissionWrapper(props: T) {
    const permissions = usePermissions()

    if (permissions.loading) {
      return <div className="animate-pulse bg-gray-200 h-8 rounded"></div>
    }

    const hasAccess = typeof requiredPermission === 'string' 
      ? permissions.hasPermission(requiredPermission)
      : requiredPermission(permissions)

    if (!hasAccess) {
      return (
        <div className="text-center py-4">
          <p className="text-gray-500 text-sm">You don't have permission to access this feature.</p>
        </div>
      )
    }

    return <Component {...props} />
  }
}

// Role badge component
export function RoleBadge({ role }: { role: string }) {
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'superadmin': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'admin': return 'bg-red-100 text-red-800 border-red-200'
      case 'manager': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'supervisor': return 'bg-green-100 text-green-800 border-green-200'
      case 'staff': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getRoleColor(role)}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  )
}