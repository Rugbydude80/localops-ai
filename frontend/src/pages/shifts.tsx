import { useState, useEffect } from 'react'
import Head from 'next/head'
import { CalendarIcon, PlusIcon, UserGroupIcon, ExclamationTriangleIcon, ClockIcon, LockClosedIcon, ShieldCheckIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { format, parseISO, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns'
import { supabase, Staff } from '../../lib/supabase'
import { usePermissions, RoleBadge } from '../hooks/usePermissions'
import { useNotifications } from '../hooks/useNotifications'
import ChatSystem from '../components/ChatSystem'
import ExcelImportExport from '../components/ExcelImportExport'

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



// API functions using Supabase
const api = {
  getShifts: async (businessId: number, startDate: string, endDate: string): Promise<Shift[]> => {
    try {
      // Get shifts from Supabase with assignments
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
      console.error('Error fetching shifts:', error)
      return []
    }
  },

  createShift: async (shiftData: any) => {
    const { data, error } = await supabase
      .from('shifts')
      .insert({
        business_id: shiftData.business_id,
        title: shiftData.title,
        date: shiftData.date.split('T')[0], // Ensure date format
        start_time: shiftData.start_time,
        end_time: shiftData.end_time,
        required_skill: shiftData.required_skill,
        required_staff_count: shiftData.required_staff_count,
        hourly_rate: shiftData.hourly_rate,
        notes: shiftData.notes,
        status: 'scheduled'
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  assignStaff: async (assignmentData: any) => {
    const { data, error } = await supabase
      .from('shift_assignments')
      .insert({
        shift_id: assignmentData.shift_id,
        staff_id: assignmentData.staff_id,
        status: 'assigned'
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  reportSickLeave: async (sickLeaveData: any) => {
    // Create sick leave record
    const { data: sickLeave, error: sickError } = await supabase
      .from('sick_leave_requests')
      .insert({
        staff_id: sickLeaveData.staff_id,
        shift_id: sickLeaveData.shift_id,
        business_id: sickLeaveData.business_id,
        reason: sickLeaveData.reason,
        message: sickLeaveData.message
      })
      .select()
      .single()

    if (sickError) throw sickError

    // Update shift assignment status
    const { error: updateError } = await supabase
      .from('shift_assignments')
      .update({ status: 'called_in_sick' })
      .eq('shift_id', sickLeaveData.shift_id)
      .eq('staff_id', sickLeaveData.staff_id)

    if (updateError) throw updateError

    // Update shift status to understaffed
    const { error: shiftError } = await supabase
      .from('shifts')
      .update({ status: 'understaffed' })
      .eq('id', sickLeaveData.shift_id)

    if (shiftError) throw shiftError

    return sickLeave
  },

  getStaff: async (businessId: number): Promise<Staff[]> => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name')

    if (error) throw error
    return data || []
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
    mutationFn: api.createShift,
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
    mutationFn: api.assignStaff,
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
                      {dayShifts.map(shift => (
                        <div
                          key={shift.id}
                          className={`p-2 rounded-md border text-xs cursor-pointer hover:shadow-sm ${getStatusColor(shift.status)}`}
                          onClick={() => {
                            setSelectedShift(shift)
                            setShowAssignStaff(true)
                          }}
                        >
                          <div className="font-medium truncate">{shift.title}</div>
                          <div className="text-xs opacity-75">
                            {shift.start_time}-{shift.end_time}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="capitalize text-xs">
                              {shift.required_skill.replace('_', ' ')}
                            </span>
                            <span className="text-xs">
                              {shift.assignments.length}/{shift.required_staff_count}
                            </span>
                          </div>
                          
                          {shift.assignments.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {shift.assignments.map(assignment => (
                                <div key={assignment.id} className="flex items-center justify-between">
                                  <span className="text-xs truncate">{assignment.staff_name}</span>
                                  {assignment.status === 'called_in_sick' && (
                                    <ExclamationTriangleIcon className="h-3 w-3 text-red-500" />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
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
                shift_id: selectedShift.id, 
                staff_id: staffId 
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
        
        {/* Excel Import/Export Section */}
        <div className="mt-8">
          <ExcelImportExport 
            onDataImported={() => {
              queryClient.invalidateQueries({ queryKey: ['shifts'] });
              queryClient.invalidateQueries({ queryKey: ['staff'] });
            }}
          />
        </div>
      </div>
    </div>
  )
}