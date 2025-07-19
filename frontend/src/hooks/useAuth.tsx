import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'

// Types
export interface User {
  id: number
  name: string
  email: string
  role: string
  business_id: number
  permissions: string[]
  can_assign_shifts: boolean
  can_manage_staff: boolean
  can_view_all_shifts: boolean
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  expires_in: number
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  name: string
  email: string
  password: string
  phone_number: string
  business_id: number
  role: string
}

interface AuthContextType {
  user: User | null
  tokens: AuthTokens | null
  loading: boolean
  login: (credentials: LoginCredentials) => Promise<boolean>
  register: (data: RegisterData) => Promise<boolean>
  logout: () => void
  refreshToken: () => Promise<boolean>
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>
  hasPermission: (permission: string) => boolean
  isAdmin: () => boolean
  isManager: () => boolean
  isSupervisor: () => boolean
  isStaff: () => boolean
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// API functions
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const authAPI = {
  async login(credentials: LoginCredentials): Promise<{ tokens: AuthTokens; user: User }> {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Login failed')
    }

    const data = await response.json()
    return {
      tokens: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      },
      user: data.user_info,
    }
  },

  async register(data: RegisterData): Promise<{ tokens: AuthTokens; user: User }> {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Registration failed')
    }

    const responseData = await response.json()
    return {
      tokens: {
        access_token: responseData.access_token,
        refresh_token: responseData.refresh_token,
        expires_in: responseData.expires_in,
      },
      user: responseData.user_info,
    }
  },

  async refreshToken(refreshToken: string): Promise<{ tokens: AuthTokens; user: User }> {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!response.ok) {
      throw new Error('Token refresh failed')
    }

    const data = await response.json()
    return {
      tokens: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      },
      user: data.user_info,
    }
  },

  async getCurrentUser(accessToken: string): Promise<User> {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get user info')
    }

    return await response.json()
  },

  async changePassword(
    accessToken: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Password change failed')
    }
  },

  async logout(accessToken: string): Promise<void> {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })
  },
}

// Storage utilities
const storage = {
  getTokens(): AuthTokens | null {
    if (typeof window === 'undefined') return null
    
    try {
      const tokens = localStorage.getItem('auth_tokens')
      return tokens ? JSON.parse(tokens) : null
    } catch {
      return null
    }
  },

  setTokens(tokens: AuthTokens): void {
    if (typeof window === 'undefined') return
    
    localStorage.setItem('auth_tokens', JSON.stringify(tokens))
  },

  removeTokens(): void {
    if (typeof window === 'undefined') return
    
    localStorage.removeItem('auth_tokens')
  },

  getUser(): User | null {
    if (typeof window === 'undefined') return null
    
    try {
      const user = localStorage.getItem('auth_user')
      return user ? JSON.parse(user) : null
    } catch {
      return null
    }
  },

  setUser(user: User): void {
    if (typeof window === 'undefined') return
    
    localStorage.setItem('auth_user', JSON.stringify(user))
  },

  removeUser(): void {
    if (typeof window === 'undefined') return
    
    localStorage.removeItem('auth_user')
  },
}

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [tokens, setTokens] = useState<AuthTokens | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Initialize auth state
  useEffect(() => {
    initializeAuth()
  }, [])

  // Auto-refresh token
  useEffect(() => {
    if (!tokens) return

    const refreshInterval = setInterval(() => {
      refreshToken()
    }, (tokens.expires_in - 300) * 1000) // Refresh 5 minutes before expiry

    return () => clearInterval(refreshInterval)
  }, [tokens])

  const initializeAuth = async () => {
    try {
      const storedTokens = storage.getTokens()
      const storedUser = storage.getUser()

      if (storedTokens && storedUser) {
        // Verify token is still valid
        try {
          const currentUser = await authAPI.getCurrentUser(storedTokens.access_token)
          setUser(currentUser)
          setTokens(storedTokens)
        } catch {
          // Token invalid, clear storage
          storage.removeTokens()
          storage.removeUser()
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
    } finally {
      setLoading(false)
    }
  }

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      setLoading(true)
      const { tokens: newTokens, user: newUser } = await authAPI.login(credentials)
      
      storage.setTokens(newTokens)
      storage.setUser(newUser)
      setTokens(newTokens)
      setUser(newUser)
      
      toast.success('Login successful!')
      return true
    } catch (error: any) {
      toast.error(error.message || 'Login failed')
      return false
    } finally {
      setLoading(false)
    }
  }

  const register = async (data: RegisterData): Promise<boolean> => {
    try {
      setLoading(true)
      const { tokens: newTokens, user: newUser } = await authAPI.register(data)
      
      storage.setTokens(newTokens)
      storage.setUser(newUser)
      setTokens(newTokens)
      setUser(newUser)
      
      toast.success('Registration successful!')
      return true
    } catch (error: any) {
      toast.error(error.message || 'Registration failed')
      return false
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      if (tokens) {
        await authAPI.logout(tokens.access_token)
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      storage.removeTokens()
      storage.removeUser()
      setTokens(null)
      setUser(null)
      router.push('/login')
    }
  }

  const refreshToken = async (): Promise<boolean> => {
    if (!tokens?.refresh_token) return false

    try {
      const { tokens: newTokens, user: newUser } = await authAPI.refreshToken(tokens.refresh_token)
      
      storage.setTokens(newTokens)
      storage.setUser(newUser)
      setTokens(newTokens)
      setUser(newUser)
      
      return true
    } catch (error) {
      console.error('Token refresh failed:', error)
      logout()
      return false
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    if (!tokens) return false

    try {
      await authAPI.changePassword(tokens.access_token, currentPassword, newPassword)
      toast.success('Password changed successfully!')
      return true
    } catch (error: any) {
      toast.error(error.message || 'Password change failed')
      return false
    }
  }

  const hasPermission = (permission: string): boolean => {
    return user?.permissions?.includes(permission) || false
  }

  const isAdmin = (): boolean => {
    return user?.role === 'admin' || user?.role === 'superadmin'
  }

  const isManager = (): boolean => {
    return ['manager', 'admin', 'superadmin'].includes(user?.role || '')
  }

  const isSupervisor = (): boolean => {
    return ['supervisor', 'manager', 'admin', 'superadmin'].includes(user?.role || '')
  }

  const isStaff = (): boolean => {
    return !!user?.role
  }

  const value: AuthContextType = {
    user,
    tokens,
    loading,
    login,
    register,
    logout,
    refreshToken,
    changePassword,
    hasPermission,
    isAdmin,
    isManager,
    isSupervisor,
    isStaff,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Hook to get authenticated API client
export function useAuthenticatedAPI() {
  const { tokens } = useAuth()

  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    if (!tokens) {
      throw new Error('No authentication tokens available')
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (response.status === 401) {
      // Token expired, try to refresh
      const { refreshToken } = useAuth()
      const refreshed = await refreshToken()
      if (refreshed) {
        // Retry the request with new token
        const newTokens = storage.getTokens()
        if (newTokens) {
          return fetch(url, {
            ...options,
            headers: {
              'Authorization': `Bearer ${newTokens.access_token}`,
              'Content-Type': 'application/json',
              ...options.headers,
            },
          })
        }
      }
      throw new Error('Authentication failed')
    }

    return response
  }

  return { authenticatedFetch }
} 