import { useState, useEffect } from 'react'
import Head from 'next/head'
import { 
  CalendarIcon, 
  UserGroupIcon, 
  ClockIcon, 
  ExclamationTriangleIcon,
  PlusIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast'
import { format, parseISO, addDays, startOfWeek, endOfWeek, isSameDay } from 'date-fns'
import { supabase, Staff } from '../../lib/supabase'
import ShiftDetailModal from '../components/ShiftDetailModal'
import StaffAvailabilityModal from '../components/StaffAvailabilityModal'

// Types
interface Shift {
  id: number
  title: string
  date: string
  start_time: string
  end_time: string
  required_skill: string
  required_staff_count: number
  hourly_rate?: number
  status: string
  assignments: Assignment[]
}

interface Assignment {
  id: number
  staff_id: number
  staff_name: string
  status: string
}

interface EmergencyRequest {
  id: number
  shift_date: string
  shift_start: string
  shift_end: string
  required_skill: string
  urgency: string
  status: string
  created_at: string
}

// API functions
const api = {
  getStaff: async (businessId: number): Promise<Staff[]> => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name')
    
    if (error) throw error
    return data || []
  },

  getShifts: async (businessId: number, startDate: string, endDate: string): Promise<Shift[]> => {
    try {
      // Try to get shifts from Supabase first
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select(`
          *,
          shift_assignments (
            id,
            staff_id,
            status,
            staff:staff_id (
              name
            )
          )
        `)
        .eq('business_id', businessId)
        .gte('date', startDate.split('T')[0])
        .lte('date', endDate.split('T')[0])
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })

      if (shiftsError) throw shiftsError

      // Transform the data to match our interface
      const transformedShifts = (shiftsData || []).map(shift => ({
        ...shift,
        assignments: (shift.shift_assignments || []).map((assignment: any) => ({
          id: assignment.id,
          staff_id: assignment.staff_id,
          staff_name: assignment.staff?.name || 'Unknown',
          status: assignment.status
        }))
      }))

      return transformedShifts
    } catch (error) {
      // Fallback to demo data if database query fails
      console.log('Database not available, using demo data')
      return generateDemoShifts()
    }
  },

  getEmergencyRequests: async (businessId: number): Promise<EmergencyRequest[]> => {
    const { data, error } = await supabase
      .from('emergency_requests')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (error) throw error
    return data || []
  }
}

// Demo data generator
const generateDemoShifts = (): Shift[] => {
  const shifts = []
  const today = new Date()
  const skills = ['kitchen', 'bar', 'front_of_house', 'management']
  const shiftTypes = ['Morning', 'Afternoon', 'Evening', 'Night']
  
  for (let i = 0; i < 14; i++) {
    const date = addDays(today, i)
    const shiftsPerDay = Math.floor(Math.random() * 4) + 2
    
    for (let j = 0; j < shiftsPerDay; j++) {
      const skill = skills[Math.floor(Math.random() * skills.length)]
      const shiftType = shiftTypes[j % shiftTypes.length]
      const startHour = 6 + (j * 4)
      const endHour = startHour + 6
      
      shifts.push({
        id: i * 10 + j,
        title: `${shiftType} ${skill.replace('_', ' ')}`,
        date: date.toISOString(),
        start_time: `${startHour.toString().padStart(2, '0')}:00`,
        end_time: `${endHour.toString().padStart(2, '0')}:00`,
        required_skill: skill,
        required_staff_count: Math.floor(Math.random() * 3) + 1,
        hourly_rate: 12.50 + Math.random() * 5,
        status: ['scheduled', 'filled', 'understaffed'][Math.floor(Math.random() * 3)],
        assignments: []
      })
    }
  }
  
  return shifts
}

// Enhanced Coverage Request Card Component
function CoverageRequestCard({ request, staff, onRespond }: {
  request: EmergencyRequest
  staff: Staff[]
  onRespond: (requestId: number, staffId: number, response: string) => void
}) {
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null)
  const [showResponseOptions, setShowResponseOptions] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [responseNotes, setResponseNotes] = useState('')
  const [expandedView, setExpandedView] = useState(false)

  // Find qualified staff for this request
  const qualifiedStaff = staff.filter(s => 
    s.skills.includes(request.required_skill) && s.is_active
  )

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'border-l-red-500 bg-red-50'
      case 'high': return 'border-l-orange-500 bg-orange-50'
      case 'normal': return 'border-l-blue-500 bg-blue-50'
      default: return 'border-l-gray-500 bg-gray-50'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'filled':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">✅ Filled</span>
      case 'pending':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">⏳ Pending</span>
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">{status}</span>
    }
  }

  const handleStaffResponse = (response: string) => {
    if (selectedStaffId) {
      onRespond(request.id, selectedStaffId, response)
      setShowResponseOptions(false)
      setSelectedStaffId(null)
      setResponseNotes('')
      toast.success(`Response submitted: ${response}`)
    }
  }

  const getShiftDuration = () => {
    const start = parseInt(request.shift_start.replace(':', ''))
    const end = parseInt(request.shift_end.replace(':', ''))
    const duration = (end - start) / 100
    return duration
  }

  const getEstimatedPay = () => {
    const duration = getShiftDuration()
    const baseRate = 12.50 // Base hourly rate
    const skillMultiplier = request.required_skill === 'management' ? 1.5 : 
                           request.required_skill === 'kitchen' ? 1.2 : 1.0
    return (duration * baseRate * skillMultiplier).toFixed(2)
  }

  return (
    <div className={`rounded-lg border-l-4 transition-all duration-200 ${getUrgencyColor(request.urgency)} ${
      expandedView ? 'p-6' : 'p-4'
    }`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="font-semibold text-gray-900 capitalize">
              {request.required_skill.replace('_', ' ')} needed
            </h3>
            {request.urgency !== 'normal' && (
              <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                request.urgency === 'critical' ? 'bg-red-100 text-red-800' :
                request.urgency === 'high' ? 'bg-orange-100 text-orange-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {request.urgency.toUpperCase()}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-2">
            📅 {format(parseISO(request.shift_date), 'EEEE, MMM d')} • 
            ⏰ {request.shift_start}-{request.shift_end} ({getShiftDuration()}h)
          </p>
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <span>💰 Est. £{getEstimatedPay()}</span>
            <span>👥 {qualifiedStaff.length} qualified</span>
            <span>📍 Main Location</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge(request.status)}
          <button
            onClick={() => setExpandedView(!expandedView)}
            className="p-1 hover:bg-white hover:bg-opacity-50 rounded text-gray-500 hover:text-gray-700"
            title="View details"
          >
            {expandedView ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expandedView && (
        <div className="mb-4 p-3 bg-white bg-opacity-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Shift Requirements</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Skills Required:</span>
              <p className="text-gray-600 capitalize">{request.required_skill.replace('_', ' ')}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Duration:</span>
              <p className="text-gray-600">{getShiftDuration()} hours</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Estimated Pay:</span>
              <p className="text-gray-600">£{getEstimatedPay()}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Urgency:</span>
              <p className="text-gray-600 capitalize">{request.urgency}</p>
            </div>
          </div>
          {request.message && (
            <div className="mt-3">
              <span className="font-medium text-gray-700">Additional Notes:</span>
              <p className="text-gray-600 text-sm mt-1">{request.message}</p>
            </div>
          )}
        </div>
      )}

      {/* Interactive Response Section */}
      {request.status === 'pending' && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          {!showResponseOptions ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Can you help cover this shift?</span>
                <div className="flex -space-x-1">
                  {qualifiedStaff.slice(0, 3).map(staffMember => (
                    <div
                      key={staffMember.id}
                      className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center border-2 border-white text-xs font-medium text-blue-600"
                      title={staffMember.name}
                    >
                      {staffMember.name.charAt(0)}
                    </div>
                  ))}
                  {qualifiedStaff.length > 3 && (
                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center border-2 border-white text-xs font-medium text-gray-600">
                      +{qualifiedStaff.length - 3}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setExpandedView(!expandedView)}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
                >
                  📋 Details
                </button>
                <button
                  onClick={() => setShowResponseOptions(true)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                >
                  Respond
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select staff member:
                </label>
                <select
                  value={selectedStaffId || ''}
                  onChange={(e) => setSelectedStaffId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">Choose a staff member...</option>
                  {qualifiedStaff.map(staffMember => (
                    <option key={staffMember.id} value={staffMember.id}>
                      {staffMember.name} ({staffMember.role}) - {staffMember.reliability_score}/10 reliability
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Add notes (optional):
                </label>
                <textarea
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  placeholder="Any additional comments or conditions..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              {selectedStaffId && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleStaffResponse('accept')}
                      className="flex-1 px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors font-medium"
                    >
                      ✅ Accept Shift
                    </button>
                    <button
                      onClick={() => handleStaffResponse('decline')}
                      className="flex-1 px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors font-medium"
                    >
                      ❌ Decline
                    </button>
                  </div>
                  <button
                    onClick={() => handleStaffResponse('maybe')}
                    className="w-full px-4 py-2 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700 transition-colors font-medium"
                  >
                    ⏰ Maybe - Need More Info
                  </button>
                </div>
              )}

              <button
                onClick={() => {
                  setShowResponseOptions(false)
                  setSelectedStaffId(null)
                  setResponseNotes('')
                }}
                className="w-full px-3 py-1 text-gray-600 text-sm hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filled Status */}
      {request.status === 'filled' && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-700 font-medium">
                This shift has been covered! 🎉
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {format(parseISO(request.created_at), 'MMM d, h:mm a')}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const [businessId] = useState(1)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'overview' | 'shifts' | 'staff'>('overview')
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [selectedStaffForAvailability, setSelectedStaffForAvailability] = useState<Staff | null>(null)
  const queryClient = useQueryClient()
  
  // Calculate date range for current week
  const startDate = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const endDate = endOfWeek(selectedDate, { weekStartsOn: 1 })

  // Mutations for shift management
  const assignStaffMutation = useMutation({
    mutationFn: async ({ shiftId, staffId }: { shiftId: number, staffId: number }) => {
      const { data, error } = await supabase
        .from('shift_assignments')
        .insert({
          shift_id: shiftId,
          staff_id: staffId,
          status: 'assigned'
        })
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Staff assigned successfully!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to assign staff')
    }
  })

  const removeStaffMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      const { error } = await supabase
        .from('shift_assignments')
        .delete()
        .eq('id', assignmentId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Staff removed from shift!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove staff')
    }
  })

  const updateStaffMutation = useMutation({
    mutationFn: async (updatedStaff: Staff) => {
      const { data, error } = await supabase
        .from('staff')
        .update({
          max_weekly_hours: updatedStaff.max_weekly_hours,
          unavailable_times: updatedStaff.unavailable_times,
          contract_type: updatedStaff.contract_type
        })
        .eq('id', updatedStaff.id)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      toast.success('Staff availability updated!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update staff')
    }
  })

  const respondToCoverageMutation = useMutation({
    mutationFn: async ({ requestId, staffId, response }: { requestId: number, staffId: number, response: string }) => {
      // Record the response in shift_coverage table
      const { data, error } = await supabase
        .from('shift_coverage')
        .insert({
          request_id: requestId,
          staff_id: staffId,
          response: response
        })
        .select()
        .single()
      
      if (error) throw error

      // If accepted, mark request as filled
      if (response === 'accept') {
        const { error: updateError } = await supabase
          .from('emergency_requests')
          .update({
            status: 'filled',
            filled_by: staffId,
            filled_at: new Date().toISOString()
          })
          .eq('id', requestId)
        
        if (updateError) throw updateError
      }

      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['emergency-requests'] })
      const responseText = variables.response === 'accept' ? 'accepted' : 
                          variables.response === 'decline' ? 'declined' : 'noted'
      toast.success(`Response ${responseText} successfully!`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to record response')
    }
  })

  // Handle coverage response
  const handleCoverageResponse = (requestId: number, staffId: number, response: string) => {
    respondToCoverageMutation.mutate({ requestId, staffId, response })
  }

  // Queries
  const { data: staff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff', businessId],
    queryFn: () => api.getStaff(businessId)
  })

  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['shifts', businessId, startDate.toISOString(), endDate.toISOString()],
    queryFn: () => api.getShifts(businessId, startDate.toISOString(), endDate.toISOString())
  })

  const { data: emergencyRequests = [] } = useQuery({
    queryKey: ['emergency-requests', businessId],
    queryFn: () => api.getEmergencyRequests(businessId)
  })

  // Calculate metrics
  const totalShifts = shifts.length
  const filledShifts = shifts.filter(s => s.status === 'filled').length
  const understaffedShifts = shifts.filter(s => s.status === 'understaffed').length
  const pendingRequests = emergencyRequests.filter(r => r.status === 'pending').length

  // Get shifts for today
  const todayShifts = shifts.filter(shift => 
    isSameDay(parseISO(shift.date), new Date())
  ).sort((a, b) => a.start_time.localeCompare(b.start_time))

  // Get upcoming shifts (next 3 days)
  const upcomingShifts = shifts.filter(shift => {
    const shiftDate = parseISO(shift.date)
    const today = new Date()
    const threeDaysFromNow = addDays(today, 3)
    return shiftDate > today && shiftDate <= threeDaysFromNow
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'filled': return 'bg-green-100 text-green-800 border-green-200'
      case 'understaffed': return 'bg-red-100 text-red-800 border-red-200'
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <>
      <Head>
        <title>LocalOps AI - Operations Dashboard</title>
        <meta name="description" content="Comprehensive restaurant operations dashboard" />
      </Head>

      <div className="min-h-screen bg-slate-50">
        <Toaster position="top-right" />
        
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">L</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">LocalOps AI</h1>
                  <p className="text-sm text-gray-500">Operations Dashboard</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('overview')}
                    className={`px-3 py-1 text-sm font-medium rounded-md ${
                      viewMode === 'overview' 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setViewMode('shifts')}
                    className={`px-3 py-1 text-sm font-medium rounded-md ${
                      viewMode === 'shifts' 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Shifts
                  </button>
                  <button
                    onClick={() => setViewMode('staff')}
                    className={`px-3 py-1 text-sm font-medium rounded-md ${
                      viewMode === 'staff' 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Staff
                  </button>
                </div>
                
                <a
                  href="/shifts"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Full Calendar
                </a>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Overview Mode */}
          {viewMode === 'overview' && (
            <div className="space-y-8">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Total Staff</p>
                      <p className="text-3xl font-bold text-gray-900">{staff.length}</p>
                    </div>
                    <UserGroupIcon className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">This Week's Shifts</p>
                      <p className="text-3xl font-bold text-gray-900">{totalShifts}</p>
                    </div>
                    <CalendarIcon className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Fully Staffed</p>
                      <p className="text-3xl font-bold text-gray-900">{filledShifts}</p>
                    </div>
                    <CheckCircleIcon className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Need Coverage</p>
                      <p className="text-3xl font-bold text-gray-900">{understaffedShifts + pendingRequests}</p>
                    </div>
                    <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
                  </div>
                </div>
              </div>

              {/* Today's Shifts */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-xl font-semibold text-gray-900">Today's Shifts</h2>
                  <p className="text-sm text-gray-500">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
                </div>
                <div className="p-6">
                  {todayShifts.length === 0 ? (
                    <div className="text-center py-8">
                      <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No shifts scheduled for today</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {todayShifts.map(shift => (
                        <div 
                          key={shift.id} 
                          className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all duration-200 ${getStatusColor(shift.status)}`}
                          onClick={() => setSelectedShift(shift)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold text-gray-900">{shift.title}</h3>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-white bg-opacity-50">
                              {shift.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {shift.start_time} - {shift.end_time}
                          </p>
                          <div className="flex justify-between items-center text-xs">
                            <span className="capitalize">{shift.required_skill.replace('_', ' ')}</span>
                            <span>{shift.assignments?.length || 0}/{shift.required_staff_count} staff</span>
                          </div>
                          <p className="text-xs text-blue-600 mt-2 font-medium">Click to manage staff</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Upcoming Shifts */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Upcoming Shifts</h2>
                      <p className="text-sm text-gray-500">Next 3 days</p>
                    </div>
                    <a
                      href="/shifts"
                      className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
                    >
                      View all shifts
                      <ArrowRightIcon className="h-4 w-4 ml-1" />
                    </a>
                  </div>
                </div>
                <div className="p-6">
                  {upcomingShifts.length === 0 ? (
                    <div className="text-center py-8">
                      <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No upcoming shifts in the next 3 days</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {upcomingShifts.slice(0, 6).map(shift => (
                        <div 
                          key={shift.id} 
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-all duration-200"
                          onClick={() => setSelectedShift(shift)}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="text-center">
                              <div className="text-sm font-medium text-gray-900">
                                {format(parseISO(shift.date), 'MMM')}
                              </div>
                              <div className="text-lg font-bold text-gray-900">
                                {format(parseISO(shift.date), 'd')}
                              </div>
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{shift.title}</h3>
                              <p className="text-sm text-gray-600">
                                {shift.start_time} - {shift.end_time} • {shift.required_skill.replace('_', ' ')}
                              </p>
                              <p className="text-xs text-blue-600 font-medium">Click to manage staff</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="text-sm text-gray-600">
                              {shift.assignments?.length || 0}/{shift.required_staff_count}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(shift.status)}`}>
                              {shift.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Interactive Coverage Requests */}
              {emergencyRequests.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">Coverage Requests</h2>
                        <p className="text-sm text-gray-500">Staff can respond to urgent requests</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        <span className="text-xs text-gray-500">Live Updates</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {emergencyRequests.slice(0, 5).map(request => (
                        <CoverageRequestCard 
                          key={request.id} 
                          request={request} 
                          staff={staff}
                          onRespond={(requestId, staffId, response) => handleCoverageResponse(requestId, staffId, response)}
                        />
                      ))}
                    </div>
                    
                    {emergencyRequests.filter(r => r.status === 'pending').length === 0 && (
                      <div className="text-center py-6">
                        <CheckCircleIcon className="h-12 w-12 text-green-400 mx-auto mb-3" />
                        <p className="text-gray-600 font-medium">All requests covered!</p>
                        <p className="text-sm text-gray-500">Great teamwork 🎉</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Shifts Mode */}
          {viewMode === 'shifts' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="text-center">
                <CalendarIcon className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Shift Management</h2>
                <p className="text-gray-600 mb-6">View and manage all your shifts in the full calendar view</p>
                <a
                  href="/shifts"
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
                >
                  <CalendarIcon className="h-5 w-5 mr-2" />
                  Open Shift Calendar
                </a>
              </div>
            </div>
          )}

          {/* Staff Mode */}
          {viewMode === 'staff' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="text-center">
                <UserGroupIcon className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Staff Management</h2>
                <p className="text-gray-600 mb-6">Manage your team members and their details</p>
                <a
                  href="/"
                  className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm"
                >
                  <UserGroupIcon className="h-5 w-5 mr-2" />
                  Manage Staff
                </a>
              </div>
            </div>
          )}
        </main>

        {/* Shift Detail Modal */}
        {selectedShift && (
          <ShiftDetailModal
            shift={selectedShift}
            onClose={() => setSelectedShift(null)}
            onAssignStaff={(staffId) => assignStaffMutation.mutate({ shiftId: selectedShift.id, staffId })}
            onRemoveStaff={(assignmentId) => removeStaffMutation.mutate(assignmentId)}
          />
        )}

        {/* Staff Availability Modal */}
        {selectedStaffForAvailability && (
          <StaffAvailabilityModal
            staff={selectedStaffForAvailability}
            onClose={() => setSelectedStaffForAvailability(null)}
            onUpdate={(updatedStaff) => updateStaffMutation.mutate(updatedStaff)}
          />
        )}
      </div>
    </>
  )
}