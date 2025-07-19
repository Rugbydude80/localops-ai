import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../hooks/useAuth'
import { 
  ArrowLeftOnRectangleIcon,
  UserCircleIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermissions?: string[]
  requiredRole?: string
  minRoleLevel?: number
}

export default function ProtectedRoute({ 
  children, 
  requiredPermissions = [],
  requiredRole,
  minRoleLevel
}: ProtectedRouteProps) {
  const { user, loading, logout, hasPermission, isAdmin, isManager, isSupervisor, isStaff } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  // Check permissions
  const checkPermissions = () => {
    if (!user) return false
    
    // Check specific permissions
    for (const permission of requiredPermissions) {
      if (!hasPermission(permission)) {
        return false
      }
    }
    
    // Check specific role
    if (requiredRole && user.role !== requiredRole) {
      return false
    }
    
    // Check minimum role level
    if (minRoleLevel) {
      const roleLevels = {
        'staff': 20,
        'supervisor': 40,
        'manager': 60,
        'admin': 80,
        'superadmin': 100
      }
      
      const userLevel = roleLevels[user.role as keyof typeof roleLevels] || 0
      if (userLevel < minRoleLevel) {
        return false
      }
    }
    
    return true
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to login
  }

  if (!checkPermissions()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Cog6ToothIcon className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-6">
              You don't have the required permissions to access this page.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/enhanced-dashboard')}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard
              </button>
              <button
                onClick={logout}
                className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with user info and logout */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">L</span>
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-xl font-semibold text-gray-900">LocalOps AI</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* User info */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <UserCircleIcon className="h-5 w-5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">{user.name}</span>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {user.role}
                </span>
              </div>
              
              {/* Logout button */}
              <button
                onClick={logout}
                className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}

// Convenience components for different permission levels
export function AdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRole="admin" minRoleLevel={80}>
      {children}
    </ProtectedRoute>
  )
}

export function ManagerRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute minRoleLevel={60}>
      {children}
    </ProtectedRoute>
  )
}

export function SupervisorRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute minRoleLevel={40}>
      {children}
    </ProtectedRoute>
  )
}

export function StaffRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute minRoleLevel={20}>
      {children}
    </ProtectedRoute>
  )
} 