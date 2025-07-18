import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast'
import { 
  UserGroupIcon, 
  PlusIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  PhoneIcon,
  EnvelopeIcon,
  BellIcon
} from '@heroicons/react/24/outline'
import apiClient from '../lib/api'
import NotificationPanel from '../components/NotificationPanel'

// Types
interface Staff {
  id: number
  name: string
  phone_number: string
  email?: string
  role: string
  skills: string[]
  reliability_score: number
  is_active: boolean
  hired_date: string
}

interface CreateStaffData {
  name: string
  phone_number: string
  email: string
  role: string
  skills: string[]
  availability?: Record<string, string[]>
}

// Predefined skills for restaurant operations
const AVAILABLE_SKILLS = [
  'kitchen',
  'front_of_house',
  'bar',
  'management',
  'food_prep',
  'customer_service',
  'cleaning',
  'delivery',
  'cashier',
  'host',
  'server',
  'cook',
  'dishwasher',
  'barista'
]

const ROLES = [
  'manager',
  'assistant_manager',
  'head_chef',
  'sous_chef',
  'line_cook',
  'prep_cook',
  'server',
  'bartender',
  'barista',
  'host',
  'cashier',
  'dishwasher',
  'cleaner',
  'delivery_driver'
]

export default function StaffPage() {
  const [businessId] = useState(1)
  const [currentStaffId] = useState(1) // This would come from auth context
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEmergencyForm, setShowEmergencyForm] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const queryClient = useQueryClient()

  // Form state
  const [formData, setFormData] = useState<CreateStaffData>({
    name: '',
    phone_number: '',
    email: '',
    role: '',
    skills: []
  })

  // Emergency request state
  const [emergencyData, setEmergencyData] = useState({
    required_skill: '',
    shift_date: '',
    shift_start: '',
    shift_end: '',
    urgency: 'normal',
    message: ''
  })

  // Queries
  const { data: staff = [], isLoading, error } = useQuery({
    queryKey: ['staff', businessId],
    queryFn: () => apiClient.getStaff(businessId),
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  // Mutations
  const createStaffMutation = useMutation({
    mutationFn: (staffData: CreateStaffData) => apiClient.createStaff({
      business_id: businessId,
      ...staffData
    }),
    onSuccess: (newStaff) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setShowCreateForm(false)
      setFormData({
        name: '',
        phone_number: '',
        email: '',
        role: '',
        skills: []
      })
      toast.success(`Staff member ${newStaff.name} created successfully!`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create staff member')
    }
  })

  const emergencyRequestMutation = useMutation({
    mutationFn: (requestData: any) => apiClient.createEmergencyRequest({
      business_id: businessId,
      business_name: 'Demo Restaurant',
      ...requestData
    }),
    onSuccess: (response) => {
      setShowEmergencyForm(false)
      setEmergencyData({
        required_skill: '',
        shift_date: '',
        shift_start: '',
        shift_end: '',
        urgency: 'normal',
        message: ''
      })
      toast.success(`Emergency request sent to ${response.qualified_staff_count} staff members with ${response.required_skill} skills!`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send emergency request')
    }
  })

  const handleSkillToggle = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.phone_number || !formData.role) {
      toast.error('Please fill in all required fields')
      return
    }

    if (formData.skills.length === 0) {
      toast.error('Please select at least one skill')
      return
    }

    createStaffMutation.mutate(formData)
  }

  const handleEmergencySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!emergencyData.required_skill || !emergencyData.shift_date || !emergencyData.shift_start || !emergencyData.shift_end) {
      toast.error('Please fill in all required fields')
      return
    }

    emergencyRequestMutation.mutate(emergencyData)
  }

  const getStaffBySkill = (skill: string) => {
    return staff.filter(s => s.skills.includes(skill))
  }

  const getSkillColor = (skill: string) => {
    const colors = {
      kitchen: 'bg-red-100 text-red-800',
      front_of_house: 'bg-blue-100 text-blue-800',
      bar: 'bg-purple-100 text-purple-800',
      management: 'bg-green-100 text-green-800',
      food_prep: 'bg-orange-100 text-orange-800',
      customer_service: 'bg-indigo-100 text-indigo-800'
    }
    return colors[skill as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connection Error</h2>
          <p className="text-gray-600 mb-4">
            Cannot connect to the backend API. Please make sure the backend is running on port 8001.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Staff Management - LocalOps AI</title>
      </Head>

      <div className="min-h-screen bg-slate-50">
        <Toaster position="top-right" />
        
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <a href="/" className="text-gray-400 hover:text-gray-600">
                  ← Dashboard
                </a>
                <UserGroupIcon className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
                  <p className="text-sm text-gray-500">Manage your team and skills</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowNotifications(true)}
                  className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  <BellIcon className="h-5 w-5 mr-2" />
                  Notifications
                </button>
                <button
                  onClick={() => setShowEmergencyForm(true)}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                  Emergency Coverage
                </button>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Add Staff
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <UserGroupIcon className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Total Staff</p>
                  <p className="text-2xl font-bold text-gray-900">{staff.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-red-600 font-semibold">K</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Kitchen Staff</p>
                  <p className="text-2xl font-bold text-gray-900">{getStaffBySkill('kitchen').length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">F</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Front of House</p>
                  <p className="text-2xl font-bold text-gray-900">{getStaffBySkill('front_of_house').length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 font-semibold">B</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Bar Staff</p>
                  <p className="text-2xl font-bold text-gray-900">{getStaffBySkill('bar').length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Staff List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Staff Members</h2>
            </div>
            
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading staff...</p>
              </div>
            ) : staff.length === 0 ? (
              <div className="p-8 text-center">
                <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No staff members found. Add your first staff member to get started!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {staff.map((member) => (
                  <div key={member.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-lg">
                            {member.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{member.name}</h3>
                          <p className="text-sm text-gray-500 capitalize">{member.role.replace('_', ' ')}</p>
                          <div className="flex items-center space-x-4 mt-1">
                            <div className="flex items-center text-sm text-gray-500">
                              <PhoneIcon className="h-4 w-4 mr-1" />
                              {member.phone_number}
                            </div>
                            {member.email && (
                              <div className="flex items-center text-sm text-gray-500">
                                <EnvelopeIcon className="h-4 w-4 mr-1" />
                                {member.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="flex flex-wrap gap-1">
                          {member.skills.map((skill) => (
                            <span
                              key={skill}
                              className={`px-2 py-1 text-xs font-medium rounded-full ${getSkillColor(skill)}`}
                            >
                              {skill.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center">
                          <div className="flex items-center">
                            <CheckCircleIcon className="h-5 w-5 text-green-500 mr-1" />
                            <span className="text-sm font-medium text-gray-900">
                              {member.reliability_score.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Create Staff Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Add New Staff Member</h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter staff member name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={formData.phone_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+44 7700 900000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="staff@restaurant.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select a role</option>
                    {ROLES.map(role => (
                      <option key={role} value={role}>
                        {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Skills * (Select all that apply)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_SKILLS.map(skill => (
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

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createStaffMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createStaffMutation.isPending ? 'Creating...' : 'Create Staff Member'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Emergency Coverage Modal */}
        {showEmergencyForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mr-2" />
                  Emergency Coverage Request
                </h2>
                <button
                  onClick={() => setShowEmergencyForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleEmergencySubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Required Skill *
                  </label>
                  <select
                    value={emergencyData.required_skill}
                    onChange={(e) => setEmergencyData(prev => ({ ...prev, required_skill: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select required skill</option>
                    {AVAILABLE_SKILLS.map(skill => (
                      <option key={skill} value={skill}>
                        {skill.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} 
                        ({getStaffBySkill(skill).length} available)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shift Date *
                  </label>
                  <input
                    type="date"
                    value={emergencyData.shift_date}
                    onChange={(e) => setEmergencyData(prev => ({ ...prev, shift_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time *
                    </label>
                    <input
                      type="time"
                      value={emergencyData.shift_start}
                      onChange={(e) => setEmergencyData(prev => ({ ...prev, shift_start: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Time *
                    </label>
                    <input
                      type="time"
                      value={emergencyData.shift_end}
                      onChange={(e) => setEmergencyData(prev => ({ ...prev, shift_end: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Urgency Level
                  </label>
                  <select
                    value={emergencyData.urgency}
                    onChange={(e) => setEmergencyData(prev => ({ ...prev, urgency: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Message
                  </label>
                  <textarea
                    value={emergencyData.message}
                    onChange={(e) => setEmergencyData(prev => ({ ...prev, message: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Additional details about the emergency coverage needed..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEmergencyForm(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={emergencyRequestMutation.isPending}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {emergencyRequestMutation.isPending ? 'Sending...' : 'Send Emergency Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Notification Panel */}
        <NotificationPanel
          staffId={currentStaffId}
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
        />
      </div>
    </>
  )
} 