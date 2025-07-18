import { useState, useEffect } from 'react'
import Head from 'next/head'
import { CalendarIcon, PlusIcon, UserGroupIcon, ExclamationTriangleIcon, ClockIcon, LockClosedIcon, ShieldCheckIcon, ChatBubbleLeftRightIcon, CogIcon } from '@heroicons/react/24/outline'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { format, parseISO, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns'
import { usePermissions, RoleBadge } from '../hooks/usePermissions'
import { useNotifications } from '../hooks/useNotifications'
import ChatSystem from '../components/ChatSystem'
import ExcelImportExport from '../components/ExcelImportExport'
import AutoScheduleModal from '../components/AutoScheduleModal'
import BusinessConstraintsModal from '../components/BusinessConstraintsModal'
import apiClient from '../lib/api'

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

interface Staff {
  id: number
  name: string
  phone_number: string
  email?: string
  role: string
  skills: string[]
  reliability_score: number
  is_active: boolean
}

// API functions using FastAPI backend
const api = {
  getShifts: async (businessId: number, startDate: string, endDate: string): Promise<Shift[]> => {
    try {
      const shifts = await apiClient.getShifts(businessId, startDate.split('T')[0], endDate.split('T')[0]) as Shift[]
      return shifts || []
    } catch (error) {
      console.error('Error fetching shifts:', error)
      return []
    }
  },

  createShift: async (businessId: number, shiftData: any) => {
    return await apiClient.createShift(businessId, {
      title: shiftData.title,
      date: shiftData.date.split('T')[0], // Ensure date format
      start_time: shiftData.start_time,
      end_time: shiftData.end_time,
      required_skill: shiftData.required_skill,
      required_staff_count: shiftData.required_staff_count,
      hourly_rate: shiftData.hourly_rate,
      notes: shiftData.notes
    })
  },

  assignStaff: async (businessId: number, shiftId: number, staffId: number) => {
    return await apiClient.assignStaff(businessId, shiftId, staffId)
  },

  reportSickLeave: async (sickLeaveData: any) => {
    return await apiClient.reportSickLeave(sickLeaveData)
  },

  getStaff: async (businessId: number): Promise<Staff[]> => {
    try {
      const staff = await apiClient.getStaff(businessId) as Staff[]
      return staff || []
    } catch (error) {
      console.error('Error fetching staff:', error)
      return []
    }
  }
}

export default function ShiftsPage() {
  const [businessId] = useState(1)
  const [currentStaffId] = useState(1) // This would come from auth context
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [showCreateShift, setShowCreateShift] = useState(false)
  const [showAssignStaff, setShowAssignStaff] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showAutoSchedule, setShowAutoSchedule] = useState(false)
  const [showConstraintsModal, setShowConstraintsModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const queryClient = useQueryClient()
  const notifications = useNotifications()

  // Calculate date range based on view mode
  const getDateRange = () => {
    if (viewMode === 'week') {
      const start = startOfWeek(selectedDate, { weekStartsOn: 1 })
      const end = endOfWeek(selectedDate, { weekStartsOn: 1 })
      return { start, end }
    } else {
      const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
      const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
      return { start, end }
    }
  }

  const { start: startDate, end: endDate } = getDateRange()

  // Queries
  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['shifts', businessId, startDate.toISOString(), endDate.toISOString()],
    queryFn: () => api.getShifts(businessId, startDate.toISOString(), endDate.toISOString())
  })

  const { data: staff = [] } = useQuery({
    queryKey: ['staff', businessId],
    queryFn: () => api.getStaff(businessId)
  })

  // Mutations
  const createShiftMutation = useMutation({
    mutationFn: (shiftData: any) => api.createShift(businessId, shiftData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      setShowCreateShift(false)
      toast.success('Shift created successfully!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create shift')
    }
  })

  const assignStaffMutation = useMutation({
    mutationFn: ({ shiftId, staffId }: { shiftId: number; staffId: number }) => 
      api.assignStaff(businessId, shiftId, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      setShowAssignStaff(false)
      setSelectedShift(null)
      toast.success('Staff assigned successfully!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to assign staff')
    }
  })

  const sickLeaveMutation = useMutation({
    mutationFn: api.reportSickLeave,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Sick leave reported and replacement search initiated!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to report sick leave')
    }
  })

  // Auto-schedule handler
  const handleAutoSchedule = async (params: any) => {
    try {
      // This would call the backend auto-schedule API
      console.log('Auto-schedule parameters:', params)
      toast.success('Auto-schedule generation started!')
      // For now, just close the modal
      setShowAutoSchedule(false)
    } catch (error) {
      console.error('Auto-schedule failed:', error)
      throw error
    }
  }

  // Generate week days for calendar view
  const getWeekDays = () => {
    const days = []
    let current = startDate
    while (current <= endDate) {
      days.push(new Date(current))
      current = addDays(current, 1)
    }
    return days
  }

  const weekDays = getWeekDays()

  // Get shifts for a specific day
  const getShiftsForDay = (date: Date) => {
    return shifts.filter(shift => 
      isSameDay(parseISO(shift.date), date)
    ).sort((a, b) => a.start_time.localeCompare(b.start_time))
  }

  // Traffic Light System for Shift Coverage
  const getTrafficLightStatus = (shift: Shift) => {
    const assignedCount = shift.assignments.filter(a => a.status === 'assigned').length
    const sickCount = shift.assignments.filter(a => a.status === 'called_in_sick').length
    const requiredCount = shift.required_staff_count
    const actualStaffing = assignedCount - sickCount
    
    if (actualStaffing >= requiredCount) {
      return 'green' // Fully staffed
    } else if (actualStaffing >= Math.ceil(requiredCount * 0.7)) {
      return 'amber' // Partially staffed (70%+ coverage)
    } else {
      return 'red' // Understaffed (less than 70% coverage)
    }
  }

  const getTrafficLightColor = (status: string) => {
    switch (status) {
      case 'green': return 'bg-green-100 text-green-800 border-green-200 border-l-green-500'
      case 'amber': return 'bg-amber-100 text-amber-800 border-amber-200 border-l-amber-500'
      case 'red': return 'bg-red-100 text-red-800 border-red-200 border-l-red-500'
      default: return 'bg-gray-100 text-gray-800 border-gray-200 border-l-gray-500'
    }
  }

  const getTrafficLightIcon = (status: string) => {
    switch (status) {
      case 'green': return '🟢'
      case 'amber': return '🟡'
      case 'red': return '🔴'
      default: return '⚪'
    }
  }

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
        <title>Shift Management - LocalOps AI</title>
      </Head>

      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <a href="/" className="text-gray-400 hover:text-gray-600">
                  ← Dashboard
                </a>
                <CalendarIcon className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Shift Management</h1>
                  <p className="text-sm text-gray-500">Schedule and manage your team</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {/* View Mode Toggle */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('week')}
                    className={`px-3 py-1 text-sm font-medium rounded-md ${
                      viewMode === 'week' 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setViewMode('month')}
                    className={`px-3 py-1 text-sm font-medium rounded-md ${
                      viewMode === 'month' 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Month
                  </button>
                </div>

                {/* Chat Toggle */}
                <button
                  onClick={() => setShowChat(!showChat)}
                  className={`inline-flex items-center px-3 py-2 rounded-lg shadow-sm ${
                    showChat 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <ChatBubbleLeftRightIcon className="h-4 w-4 mr-2" />
                  Chat
                </button>

                {/* Constraints Configuration Button */}
                <button
                  onClick={() => setShowConstraintsModal(true)}
                  className="inline-flex items-center px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
                  title="Configure scheduling constraints"
                >
                  <CogIcon className="h-4 w-4 mr-2" />
                  Constraints
                </button>

                <button
                  onClick={() => setShowAutoSchedule(true)}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm"
                >
                  <ClockIcon className="h-4 w-4 mr-2" />
                  Auto-Schedule
                </button>

                <button
                  onClick={() => setShowCreateShift(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Create Shift
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Date Navigation */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSelectedDate(addDays(selectedDate, viewMode === 'week' ? -7 : -30))}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ←
              </button>
              <h2 className="text-xl font-semibold text-gray-900">
                {viewMode === 'week' 
                  ? `Week of ${format(startDate, 'MMM d, yyyy')}`
                  : format(selectedDate, 'MMMM yyyy')
                }
              </h2>
              <button
                onClick={() => setSelectedDate(addDays(selectedDate, viewMode === 'week' ? 7 : 30))}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                →
              </button>
            </div>
            
            <button
              onClick={() => setSelectedDate(new Date())}
              className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              Today
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Week Header */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="p-4 text-center font-medium text-gray-700 bg-gray-50">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Body */}
            <div className="grid grid-cols-7 min-h-[600px]">
              {weekDays.map(day => {
                const dayShifts = getShiftsForDay(day)
                const isToday = isSameDay(day, new Date())
                
                return (
                  <div key={day.toISOString()} className="border-r border-gray-200 last:border-r-0">
                    <div className={`p-3 border-b border-gray-100 ${isToday ? 'bg-blue-50' : ''}`}>
                      <div className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                        {format(day, 'd')}
                      </div>
                    </div>
                    
                    <div className="p-2 space-y-1 min-h-[200px]">
                      {dayShifts.map(shift => {
                        const trafficLightStatus = getTrafficLightStatus(shift)
                        const assignedCount = shift.assignments.filter(a => a.status === 'assigned').length
                        const sickCount = shift.assignments.filter(a => a.status === 'called_in_sick').length
                        const actualStaffing = assignedCount - sickCount
                        
                        return (
                          <div
                            key={shift.id}
                            className={`p-2 rounded-md border-l-4 border text-xs cursor-pointer hover:shadow-sm transition-all duration-200 ${getTrafficLightColor(trafficLightStatus)}`}
                            onClick={() => {
                              setSelectedShift(shift)
                              setShowAssignStaff(true)
                            }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-medium truncate">{shift.title}</div>
                              <span className="text-lg">{getTrafficLightIcon(trafficLightStatus)}</span>
                            </div>
                            <div className="text-xs opacity-75 mb-1">
                              {shift.start_time}-{shift.end_time}
                            </div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="capitalize text-xs">
                                {shift.required_skill.replace('_', ' ')}
                              </span>
                              <span className={`text-xs font-medium ${
                                actualStaffing >= shift.required_staff_count ? 'text-green-600' :
                                actualStaffing >= Math.ceil(shift.required_staff_count * 0.7) ? 'text-amber-600' :
                                'text-red-600'
                              }`}>
                                {actualStaffing}/{shift.required_staff_count}
                              </span>
                            </div>
                            
                            {/* Coverage Status Bar */}
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                              <div 
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                  trafficLightStatus === 'green' ? 'bg-green-500' :
                                  trafficLightStatus === 'amber' ? 'bg-amber-500' :
                                  'bg-red-500'
                                }`}
                                style={{ 
                                  width: `${Math.min(100, (actualStaffing / shift.required_staff_count) * 100)}%` 
                                }}
                              />
                            </div>
                            
                            {shift.assignments.length > 0 && (
                              <div className="mt-1 space-y-1">
                                {shift.assignments.map(assignment => (
                                  <div key={assignment.id} className="flex items-center justify-between">
                                    <span className="text-xs truncate">{assignment.staff_name}</span>
                                    {assignment.status === 'called_in_sick' ? (
                                      <span className="text-xs text-red-600 font-medium">🤒 Sick</span>
                                    ) : (
                                      <span className="text-xs text-green-600 font-medium">✓</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Quick status indicator */}
                            <div className="mt-1 text-xs font-medium">
                              {trafficLightStatus === 'green' && '✅ Fully Staffed'}
                              {trafficLightStatus === 'amber' && '⚠️ Partially Staffed'}
                              {trafficLightStatus === 'red' && '🚨 Understaffed'}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Traffic Light Legend */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Coverage Status Guide</h3>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-lg">🟢</span>
                <span className="text-green-700 font-medium">Fully Staffed</span>
                <span className="text-gray-500">(100% coverage)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-lg">🟡</span>
                <span className="text-amber-700 font-medium">Partially Staffed</span>
                <span className="text-gray-500">(70-99% coverage)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-lg">🔴</span>
                <span className="text-red-700 font-medium">Understaffed</span>
                <span className="text-gray-500">(&lt;70% coverage)</span>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <CalendarIcon className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Total Shifts</p>
                  <p className="text-2xl font-bold text-gray-900">{shifts.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <UserGroupIcon className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Fully Staffed</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {shifts.filter(s => s.status === 'filled').length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Understaffed</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {shifts.filter(s => s.status === 'understaffed').length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <ClockIcon className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Scheduled</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {shifts.filter(s => s.status === 'scheduled').length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Create Shift Modal */}
        {showCreateShift && (
          <CreateShiftModal
            onClose={() => setShowCreateShift(false)}
            onSubmit={(data) => createShiftMutation.mutate({ ...data, business_id: businessId })}
            isLoading={createShiftMutation.isPending}
          />
        )}

        {/* Assign Staff Modal */}
        {showAssignStaff && selectedShift && (
          <AssignStaffModal
            shift={selectedShift}
            staff={staff}
            onClose={() => {
              setShowAssignStaff(false)
              setSelectedShift(null)
            }}
            onAssign={async (staffId) => {
              // Assign staff
              assignStaffMutation.mutate({ 
                shiftId: selectedShift.id, 
                staffId: staffId 
              });
              
              // Send email notification
              await notifications.notifyShiftAssignment(staffId, {
                shiftTitle: selectedShift.title,
                shiftDate: format(parseISO(selectedShift.date), 'EEEE, MMMM d, yyyy'),
                startTime: selectedShift.start_time,
                endTime: selectedShift.end_time,
                businessId: businessId
              });
            }}
            onReportSick={(staffId, reason, message) => sickLeaveMutation.mutate({
              staff_id: staffId,
              shift_id: selectedShift.id,
              business_id: businessId,
              reason,
              message
            })}
            isLoading={assignStaffMutation.isPending || sickLeaveMutation.isPending}
          />
        )}

        {/* Chat System */}
        {showChat && (
          <div className="fixed bottom-4 right-4 w-96 h-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
            <div className="flex justify-between items-center p-3 border-b bg-gray-50 rounded-t-lg">
              <h3 className="font-medium text-gray-900">Team Chat</h3>
              <button
                onClick={() => setShowChat(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="h-full">
              <ChatSystem 
                currentStaffId={currentStaffId} 
                businessId={businessId} 
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// Create Shift Modal
function CreateShiftModal({ onClose, onSubmit, isLoading }: any) {
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    start_time: '',
    end_time: '',
    required_skill: '',
    required_staff_count: 1,
    hourly_rate: '',
    notes: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      date: new Date(formData.date).toISOString(),
      hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Create New Shift</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Morning Kitchen"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                required
                value={formData.start_time}
                onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                required
                value={formData.end_time}
                onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Required Skill</label>
            <select
              required
              value={formData.required_skill}
              onChange={(e) => setFormData({...formData, required_skill: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select skill...</option>
              <option value="kitchen">Kitchen</option>
              <option value="bar">Bar</option>
              <option value="front_of_house">Front of House</option>
              <option value="management">Management</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff Needed</label>
              <input
                type="number"
                min="1"
                required
                value={formData.required_staff_count}
                onChange={(e) => setFormData({...formData, required_staff_count: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate (£)</label>
              <input
                type="number"
                step="0.01"
                value={formData.hourly_rate}
                onChange={(e) => setFormData({...formData, hourly_rate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Shift'}
            </button>
          </div>
        </form>
      </div>
    </div>

        {/* Excel Import/Export Section */}
        <div className="mt-8">
          <ExcelImportExport 
            onDataImported={() => {
              queryClient.invalidateQueries({ queryKey: ['shifts'] });
              queryClient.invalidateQueries({ queryKey: ['staff'] });
            }}
          />
        </div>

        {/* Auto-Schedule Modal */}
        <AutoScheduleModal
          isOpen={showAutoSchedule}
          onClose={() => setShowAutoSchedule(false)}
          onConfirm={handleAutoSchedule}
          businessId={businessId}
          staff={staff.map(s => ({ id: s.id, name: s.name }))}
        />

        {/* Business Constraints Modal */}
        {showConstraintsModal && (
          <BusinessConstraintsModal
            businessId={businessId}
            onClose={() => setShowConstraintsModal(false)}
          />
        )}
      </div>
    </div>
  )
}

// Assign Staff Modal
function AssignStaffModal({ shift, staff, onClose, onAssign, onReportSick, isLoading }: any) {
  const [showSickForm, setShowSickForm] = useState(false)
  const [selectedStaffForSick, setSelectedStaffForSick] = useState<number | null>(null)
  const [sickReason, setSickReason] = useState('sick')
  const [sickMessage, setSickMessage] = useState('')

  // Import permissions hook
  const permissions = usePermissions()

  const qualifiedStaff = staff.filter((s: Staff) => 
    s.skills.includes(shift.required_skill) &&
    !shift.assignments.some((a: Assignment) => a.staff_id === s.id)
  )

  // Filter staff based on permissions
  const assignableStaff = qualifiedStaff.filter((s: Staff) => 
    permissions.canAssignShiftToUser(s.id)
  )

  const restrictedStaff = qualifiedStaff.filter((s: Staff) => 
    !permissions.canAssignShiftToUser(s.id)
  )

  const handleReportSick = (staffId: number) => {
    setSelectedStaffForSick(staffId)
    setShowSickForm(true)
  }

  const submitSickLeave = () => {
    if (selectedStaffForSick) {
      onReportSick(selectedStaffForSick, sickReason, sickMessage)
      setShowSickForm(false)
      setSelectedStaffForSick(null)
      setSickMessage('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Manage Shift: {shift.title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600">
            {format(parseISO(shift.date), 'EEEE, MMMM d, yyyy')} • {shift.start_time}-{shift.end_time}
          </p>
          <p className="text-sm text-gray-600 capitalize">
            Required: {shift.required_skill.replace('_', ' ')} • {shift.required_staff_count} staff needed
          </p>
        </div>

        {/* Current Assignments */}
        {shift.assignments.length > 0 && (
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">Current Assignments</h4>
            <div className="space-y-2">
              {shift.assignments.map((assignment: Assignment) => (
                <div key={assignment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-600">
                        {assignment.staff_name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{assignment.staff_name}</p>
                      <p className={`text-xs ${
                        assignment.status === 'called_in_sick' ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {assignment.status === 'called_in_sick' ? 'Called in sick' : 'Assigned'}
                      </p>
                    </div>
                  </div>
                  
                  {assignment.status !== 'called_in_sick' && (
                    <button
                      onClick={() => handleReportSick(assignment.staff_id)}
                      className="px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded-md"
                    >
                      Report Sick
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Staff */}
        {qualifiedStaff.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Available Staff</h4>
            <div className="space-y-2">
              {qualifiedStaff.map((staffMember: Staff) => (
                <div key={staffMember.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-green-600">
                        {staffMember.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{staffMember.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{staffMember.role}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => onAssign(staffMember.id)}
                    disabled={isLoading}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {qualifiedStaff.length === 0 && shift.assignments.length < shift.required_staff_count && (
          <div className="text-center py-8">
            <ExclamationTriangleIcon className="h-12 w-12 text-amber-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Available Staff</h4>
            <p className="text-gray-600">
              All qualified staff are already assigned or unavailable for this shift.
            </p>
          </div>
        )}

        {/* Sick Leave Form */}
        {showSickForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h4 className="text-lg font-semibold mb-4">Report Sick Leave</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <select
                    value={sickReason}
                    onChange={(e) => setSickReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="sick">Sick</option>
                    <option value="emergency">Emergency</option>
                    <option value="family">Family Emergency</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message (Optional)</label>
                  <textarea
                    value={sickMessage}
                    onChange={(e) => setSickMessage(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                    placeholder="Additional details..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowSickForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={submitSickLeave}
                  disabled={isLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {isLoading ? 'Reporting...' : 'Report & Find Replacement'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}