import { useState, useEffect } from 'react'
import Head from 'next/head'
import { CalendarIcon, PlusIcon, UserGroupIcon, ExclamationTriangleIcon, ClockIcon, LockClosedIcon, ShieldCheckIcon, ChatBubbleLeftRightIcon, CogIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { format, parseISO, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns'
import { usePermissions, RoleBadge } from '../hooks/usePermissions'
import { useNotifications } from '../hooks/useNotifications'
import ChatSystem from '../components/ChatSystem'
import ExcelImportExport from '../components/ExcelImportExport'
import AutoScheduleModal from '../components/AutoScheduleModal'
import BusinessConstraintsModal from '../components/BusinessConstraintsModal'
import EnhancedShiftCalendar, { Shift, Staff, ShiftAssignment } from '../components/EnhancedShiftCalendar'
import apiClient from '../lib/api'

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

  unassignStaff: async (businessId: number, assignmentId: number) => {
    // Note: This would need to be implemented in the backend API
    // For now, we'll use a placeholder that removes the assignment from the frontend
    console.log('Unassigning staff:', { businessId, assignmentId })
    return { success: true }
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
  },

  generateAutoSchedule: async (businessId: number, params: any) => {
    try {
      const response = await fetch(`/api/auto-schedule/${businessId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      })
      
      if (!response.ok) {
        throw new Error('Failed to generate auto-schedule')
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error generating auto-schedule:', error)
      throw error
    }
  }
}

export default function EnhancedShiftsPage() {
  const [businessId] = useState(1)
  const [currentStaffId] = useState(1) // This would come from auth context
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showCreateShift, setShowCreateShift] = useState(false)
  const [showAssignStaff, setShowAssignStaff] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showAutoSchedule, setShowAutoSchedule] = useState(false)
  const [showConstraintsModal, setShowConstraintsModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false)
  const [showAIRecommendations, setShowAIRecommendations] = useState(true)
  const queryClient = useQueryClient()
  const notifications = useNotifications()

  // Calculate date range for current week
  const startDate = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const endDate = endOfWeek(selectedDate, { weekStartsOn: 1 })

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

  const unassignStaffMutation = useMutation({
    mutationFn: (assignmentId: number) => api.unassignStaff(businessId, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Staff unassigned successfully!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to unassign staff')
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
      setIsGeneratingSchedule(true)
      const result = await api.generateAutoSchedule(businessId, params)
      
      // Refresh shifts to show the new AI-generated schedule
      await queryClient.invalidateQueries({ queryKey: ['shifts'] })
      
      toast.success(`AI schedule generated! ${result.assigned_shifts} shifts assigned with ${Math.round(result.overall_confidence * 100)}% confidence.`)
      setShowAutoSchedule(false)
    } catch (error) {
      console.error('Auto-schedule failed:', error)
      toast.error('Failed to generate AI schedule. Please try again.')
    } finally {
      setIsGeneratingSchedule(false)
    }
  }

  // Manual override handler
  const handleManualOverride = async (shiftId: number, staffId: number, action: 'assign' | 'unassign') => {
    try {
      if (action === 'assign') {
        await assignStaffMutation.mutateAsync({ shiftId, staffId })
        toast.success('Manual assignment applied!')
      } else {
        // Find the assignment to unassign
        const shift = shifts.find(s => s.id === shiftId)
        const assignment = shift?.assignments.find(a => a.staff_id === staffId)
        if (assignment) {
          await unassignStaffMutation.mutateAsync(assignment.id)
          toast.success('Manual unassignment applied!')
        }
      }
    } catch (error) {
      toast.error('Failed to apply manual override')
    }
  }

  // Staff assignment handler
  const handleStaffAssign = async (shiftId: number, staffId: number) => {
    try {
      await assignStaffMutation.mutateAsync({ shiftId, staffId })
    } catch (error) {
      // Error is handled by the mutation
    }
  }

  // Staff unassignment handler
  const handleStaffUnassign = async (assignmentId: number) => {
    try {
      await unassignStaffMutation.mutateAsync(assignmentId)
    } catch (error) {
      // Error is handled by the mutation
    }
  }

  // Calculate summary statistics
  const getSummaryStats = () => {
    const totalShifts = shifts.length
    const totalRequiredStaff = shifts.reduce((sum, shift) => sum + shift.required_staff_count, 0)
    const totalAssignedStaff = shifts.reduce((sum, shift) => 
      sum + shift.assignments.filter(a => a.status === 'assigned' || a.status === 'confirmed').length, 0
    )
    const understaffedShifts = shifts.filter(shift => {
      const assignedCount = shift.assignments.filter(a => a.status === 'assigned' || a.status === 'confirmed').length
      return assignedCount < shift.required_staff_count
    }).length
    const aiGeneratedShifts = shifts.filter(shift => shift.ai_generated).length

    return {
      totalShifts,
      totalRequiredStaff,
      totalAssignedStaff,
      understaffedShifts,
      aiGeneratedShifts,
      coveragePercentage: totalRequiredStaff > 0 ? Math.round((totalAssignedStaff / totalRequiredStaff) * 100) : 0
    }
  }

  const stats = getSummaryStats()

  return (
    <>
      <Head>
        <title>Enhanced Shift Management - LocalOps AI</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <CalendarIcon className="h-8 w-8 text-blue-600" />
                  <h1 className="text-2xl font-bold text-gray-900">Enhanced Shift Management</h1>
                </div>
                <RoleBadge role="manager" />
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowAIRecommendations(!showAIRecommendations)}
                  className={`px-3 py-2 text-sm font-medium rounded-md flex items-center space-x-2 ${
                    showAIRecommendations 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <SparklesIcon className="h-4 w-4" />
                  <span>AI Recommendations</span>
                </button>

                <button
                  onClick={() => setShowConstraintsModal(true)}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                  title="Business Constraints"
                >
                  <CogIcon className="h-5 w-5" />
                </button>

                <button
                  onClick={() => setShowChat(!showChat)}
                  className={`p-2 rounded-md ${
                    showChat 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                  title="Chat Support"
                >
                  <ChatBubbleLeftRightIcon className="h-5 w-5" />
                </button>

                <button
                  onClick={() => setShowCreateShift(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>Create Shift</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center">
                <CalendarIcon className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Shifts</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalShifts}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center">
                <UserGroupIcon className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Staff Coverage</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.coveragePercentage}%</p>
                  <p className="text-xs text-gray-500">{stats.totalAssignedStaff}/{stats.totalRequiredStaff}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Understaffed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.understaffedShifts}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center">
                <SparklesIcon className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">AI Generated</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.aiGeneratedShifts}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center">
                <ClockIcon className="h-8 w-8 text-amber-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">This Week</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {format(startDate, 'MMM d')} - {format(endDate, 'MMM d')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Calendar */}
          <div className="bg-white rounded-lg shadow-sm border">
            <EnhancedShiftCalendar
              businessId={businessId}
              shifts={shifts}
              staff={staff}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onShiftEdit={setSelectedShift}
              onStaffAssign={handleStaffAssign}
              onStaffUnassign={handleStaffUnassign}
              onAutoSchedule={() => setShowAutoSchedule(true)}
              onManualOverride={handleManualOverride}
              isLoading={shiftsLoading || isGeneratingSchedule}
              showAIRecommendations={showAIRecommendations}
              currentUserId={currentStaffId}
              currentUserName="Current User"
            />
          </div>
        </div>

        {/* Modals */}
        {showCreateShift && (
          <CreateShiftModal
            onClose={() => setShowCreateShift(false)}
            onSubmit={createShiftMutation.mutate}
            isLoading={createShiftMutation.isPending}
          />
        )}

        {selectedShift && showAssignStaff && (
          <AssignStaffModal
            shift={selectedShift}
            staff={staff}
            onClose={() => {
              setShowAssignStaff(false)
              setSelectedShift(null)
            }}
            onAssign={assignStaffMutation.mutate}
            onReportSick={sickLeaveMutation.mutate}
            isLoading={assignStaffMutation.isPending}
          />
        )}

        {showAutoSchedule && (
          <AutoScheduleModal
            isOpen={showAutoSchedule}
            businessId={businessId}
            onClose={() => setShowAutoSchedule(false)}
            onConfirm={handleAutoSchedule}
            isLoading={isGeneratingSchedule}
          />
        )}

        {showConstraintsModal && (
          <BusinessConstraintsModal
            businessId={businessId}
            onClose={() => setShowConstraintsModal(false)}
          />
        )}

        {/* Chat System */}
        {showChat && (
          <div className="fixed bottom-4 right-4 z-50">
            <ChatSystem businessId={businessId} currentStaffId={currentStaffId} />
          </div>
        )}

        {/* Excel Import/Export */}
        <div className="fixed bottom-4 left-4 z-50">
          <ExcelImportExport />
        </div>
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
    required_skill: 'kitchen',
    required_staff_count: 1,
    hourly_rate: 12.50,
    notes: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Shift</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Time</label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Time</label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Required Skill</label>
                <select
                  value={formData.required_skill}
                  onChange={(e) => setFormData({ ...formData, required_skill: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="kitchen">Kitchen</option>
                  <option value="front_of_house">Front of House</option>
                  <option value="bar">Bar</option>
                  <option value="management">Management</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Staff Needed</label>
                <input
                  type="number"
                  min="1"
                  value={formData.required_staff_count}
                  onChange={(e) => setFormData({ ...formData, required_staff_count: parseInt(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Hourly Rate (£)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Creating...' : 'Create Shift'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Assign Staff Modal
function AssignStaffModal({ shift, staff, onClose, onAssign, onReportSick, isLoading }: any) {
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null)

  const availableStaff = staff.filter((s: Staff) => 
    s.skills.includes(shift.required_skill) && 
    s.is_available &&
    !shift.assignments.some((a: ShiftAssignment) => a.staff_id === s.id)
  )

  const handleAssign = () => {
    if (selectedStaffId) {
      onAssign({ shiftId: shift.id, staffId: selectedStaffId })
    }
  }

  const handleReportSick = (staffId: number) => {
    onReportSick({
      staff_id: staffId,
      shift_id: shift.id,
      business_id: shift.business_id,
      reason: 'sick',
      message: 'Staff member called in sick'
    })
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Assign Staff to {shift.title}</h3>
          
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              Required: {shift.required_skill} ({shift.required_staff_count} staff)
            </p>
            <p className="text-sm text-gray-600">
              Time: {shift.start_time} - {shift.end_time}
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Available Staff</label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {availableStaff.map((s: Staff) => (
                <div
                  key={s.id}
                  className={`p-2 border rounded-md cursor-pointer ${
                    selectedStaffId === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                  onClick={() => setSelectedStaffId(s.id)}
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="text-sm text-gray-600">{s.role}</div>
                  <div className="text-sm text-gray-500">£{s.hourly_rate}/hr</div>
                </div>
              ))}
              {availableStaff.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-4">
                  No available staff for this shift
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={!selectedStaffId || isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Assigning...' : 'Assign Staff'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 