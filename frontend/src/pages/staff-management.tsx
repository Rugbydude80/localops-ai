import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  UserPlusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  PhoneIcon,
  EnvelopeIcon,
  UserIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline'
import toast, { Toaster } from 'react-hot-toast'
import ProtectedRoute, { ManagerRoute } from '../components/ProtectedRoute'
import { useAuth } from '../hooks/useAuth'
import { useAuthenticatedAPI } from '../hooks/useAuth'

// Types
interface Staff {
  id: number
  name: string
  email: string
  phone_number: string
  role: string
  user_role: string
  skills: string[]
  reliability_score: number
  is_active: boolean
  hired_date: string
  can_assign_shifts: boolean
  can_manage_staff: boolean
  can_view_all_shifts: boolean
  department?: string
  reports_to?: number
}

interface CreateStaffData {
  name: string
  email: string
  phone_number: string
  role: string
  user_role: string
  skills: string[]
  department?: string
  reports_to?: number
}

interface UpdateStaffData {
  name?: string
  email?: string
  phone_number?: string
  role?: string
  user_role?: string
  skills?: string[]
  department?: string
  reports_to?: number
  can_assign_shifts?: boolean
  can_manage_staff?: boolean
  can_view_all_shifts?: boolean
  is_active?: boolean
}

// Available skills and roles
const AVAILABLE_SKILLS = [
  'kitchen',
  'front_of_house',
  'bar',
  'management',
  'cleaning',
  'delivery',
  'cashier',
  'host',
  'busser',
  'prep_cook',
  'line_cook',
  'sous_chef',
  'head_chef'
]

const USER_ROLES = [
  { value: 'staff', label: 'Staff', level: 20 },
  { value: 'supervisor', label: 'Supervisor', level: 40 },
  { value: 'manager', label: 'Manager', level: 60 },
  { value: 'admin', label: 'Admin', level: 80 },
  { value: 'superadmin', label: 'Super Admin', level: 100 }
]

export default function StaffManagement() {
  const { user, hasPermission, isAdmin, isManager } = useAuth()
  const { authenticatedFetch } = useAuthenticatedAPI()
  const queryClient = useQueryClient()
  
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null)

  // Form states
  const [formData, setFormData] = useState<CreateStaffData>({
    name: '',
    email: '',
    phone_number: '',
    role: '',
    user_role: 'staff',
    skills: [],
    department: '',
    reports_to: undefined
  })

  // API functions
  const api = {
    async getStaff(businessId: number): Promise<Staff[]> {
      const response = await authenticatedFetch(`/api/staff/${businessId}`)
      return response.json()
    },

    async createStaff(data: CreateStaffData): Promise<Staff> {
      const response = await authenticatedFetch('/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          business_id: user?.business_id
        })
      })
      return response.json()
    },

    async updateStaff(staffId: number, data: UpdateStaffData): Promise<Staff> {
      const response = await authenticatedFetch(`/api/staff/${staffId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
      return response.json()
    },

    async deleteStaff(staffId: number): Promise<void> {
      await authenticatedFetch(`/api/staff/${staffId}`, {
        method: 'DELETE'
      })
    }
  }

  // Queries
  const { data: staff = [], isLoading, error } = useQuery({
    queryKey: ['staff', user?.business_id],
    queryFn: () => api.getStaff(user?.business_id || 1),
    enabled: !!user?.business_id,
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  // Mutations
  const createStaffMutation = useMutation({
    mutationFn: api.createStaff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setShowCreateForm(false)
      setFormData({
        name: '',
        email: '',
        phone_number: '',
        role: '',
        user_role: 'staff',
        skills: [],
        department: '',
        reports_to: undefined
      })
      toast.success('Staff member created successfully!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create staff member')
    }
  })

  const updateStaffMutation = useMutation({
    mutationFn: ({ staffId, data }: { staffId: number; data: UpdateStaffData }) =>
      api.updateStaff(staffId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setShowEditForm(false)
      setEditingStaff(null)
      toast.success('Staff member updated successfully!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update staff member')
    }
  })

  const deleteStaffMutation = useMutation({
    mutationFn: api.deleteStaff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setShowDeleteConfirm(false)
      setStaffToDelete(null)
      toast.success('Staff member deleted successfully!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete staff member')
    }
  })

  // Event handlers
  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault()
    createStaffMutation.mutate(formData)
  }

  const handleEditStaff = (staff: Staff) => {
    setEditingStaff(staff)
    setShowEditForm(true)
  }

  const handleUpdateStaff = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStaff) return

    const updateData: UpdateStaffData = {
      name: formData.name || editingStaff.name,
      email: formData.email || editingStaff.email,
      phone_number: formData.phone_number || editingStaff.phone_number,
      role: formData.role || editingStaff.role,
      user_role: formData.user_role || editingStaff.user_role,
      skills: formData.skills.length > 0 ? formData.skills : editingStaff.skills,
      department: formData.department || editingStaff.department,
      reports_to: formData.reports_to || editingStaff.reports_to
    }

    updateStaffMutation.mutate({ staffId: editingStaff.id, data: updateData })
  }

  const handleDeleteStaff = (staff: Staff) => {
    setStaffToDelete(staff)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    if (staffToDelete) {
      deleteStaffMutation.mutate(staffToDelete.id)
    }
  }

  const canManageStaff = isAdmin() || isManager() || hasPermission('manage_all_staff')

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading staff...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (error) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Staff</h2>
            <p className="text-gray-600">Failed to load staff data. Please try again.</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Head>
        <title>Staff Management - LocalOps AI</title>
        <meta name="description" content="Manage your restaurant staff with role-based permissions" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <Toaster position="top-right" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
                <p className="mt-2 text-gray-600">
                  Manage your team members, roles, and permissions
                </p>
              </div>
              {canManageStaff && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Add Staff Member
                </button>
              )}
            </div>
          </div>

          {/* Staff List */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                Team Members ({staff.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-200">
              {staff.map((member) => (
                <div key={member.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {member.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{member.name}</h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <EnvelopeIcon className="h-4 w-4 mr-1" />
                            {member.email}
                          </span>
                          <span className="flex items-center">
                            <PhoneIcon className="h-4 w-4 mr-1" />
                            {member.phone_number}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {member.role}
                          </span>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {member.user_role}
                          </span>
                          {member.department && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {member.department}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {member.skills.length > 0 && (
                        <div className="text-sm text-gray-500">
                          Skills: {member.skills.join(', ')}
                        </div>
                      )}
                      {canManageStaff && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditStaff(member)}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteStaff(member)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Create Staff Modal */}
        {showCreateForm && (
          <StaffFormModal
            title="Add Staff Member"
            onSubmit={handleCreateStaff}
            onCancel={() => setShowCreateForm(false)}
            formData={formData}
            setFormData={setFormData}
            isLoading={createStaffMutation.isPending}
          />
        )}

        {/* Edit Staff Modal */}
        {showEditForm && editingStaff && (
          <StaffFormModal
            title="Edit Staff Member"
            onSubmit={handleUpdateStaff}
            onCancel={() => {
              setShowEditForm(false)
              setEditingStaff(null)
            }}
            formData={formData}
            setFormData={setFormData}
            isLoading={updateStaffMutation.isPending}
            isEdit={true}
          />
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && staffToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-500 mr-2" />
                  <h3 className="text-lg font-medium text-gray-900">Delete Staff Member</h3>
                </div>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete <strong>{staffToDelete.name}</strong>? 
                  This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={deleteStaffMutation.isPending}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {deleteStaffMutation.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}

// Staff Form Modal Component
interface StaffFormModalProps {
  title: string
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  formData: CreateStaffData
  setFormData: (data: CreateStaffData) => void
  isLoading: boolean
  isEdit?: boolean
}

function StaffFormModal({
  title,
  onSubmit,
  onCancel,
  formData,
  setFormData,
  isLoading,
  isEdit = false
}: StaffFormModalProps) {
  const handleSkillToggle = (skill: string) => {
    const newSkills = formData.skills.includes(skill)
      ? formData.skills.filter(s => s !== skill)
      : [...formData.skills, skill]
    setFormData({ ...formData, skills: newSkills })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter email address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Role *
              </label>
              <input
                type="text"
                required
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Server, Chef, Manager"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Role *
              </label>
              <select
                required
                value={formData.user_role}
                onChange={(e) => setFormData({ ...formData, user_role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {USER_ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department
              </label>
              <input
                type="text"
                value={formData.department || ''}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Kitchen, Front of House"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Skills
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {AVAILABLE_SKILLS.map((skill) => (
                <label key={skill} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.skills.includes(skill)}
                    onChange={() => handleSkillToggle(skill)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 capitalize">
                    {skill.replace('_', ' ')}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : (isEdit ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 