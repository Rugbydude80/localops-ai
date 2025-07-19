import React, { useState, useCallback, useEffect, useRef } from 'react'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { format, parseISO, startOfWeek, endOfWeek, addDays, isSameDay, isToday } from 'date-fns'
import { 
  ChevronLeftIcon, ChevronRightIcon, CalendarIcon, UserIcon, 
  ExclamationTriangleIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon, 
  LockClosedIcon, SparklesIcon, CogIcon, EyeIcon, EyeSlashIcon,
  CheckCircleIcon, XCircleIcon, ClockIcon, CurrencyPoundIcon
} from '@heroicons/react/24/outline'
import { 
  CheckCircleIcon as CheckCircleSolidIcon,
  XCircleIcon as XCircleSolidIcon
} from '@heroicons/react/24/solid'

// Types
export interface Staff {
  id: number
  name: string
  skills: string[]
  hourly_rate?: number
  is_available?: boolean
  reliability_score?: number
  role?: string
}

export interface ShiftAssignment {
  id: number
  staff_id: number
  staff_name: string
  status: 'assigned' | 'called_in_sick' | 'no_show' | 'confirmed'
  confidence_score?: number
  reasoning?: string
  is_ai_generated?: boolean
  manual_override?: boolean
}

export interface Shift {
  id: number
  title: string
  date: string
  start_time: string
  end_time: string
  required_skill: string
  required_staff_count: number
  hourly_rate?: number
  status: 'open' | 'filled' | 'understaffed' | 'scheduled'
  assignments: ShiftAssignment[]
  confidence_score?: number
  ai_generated?: boolean
  notes?: string
}

export interface EnhancedShiftCalendarProps {
  businessId: number
  shifts: Shift[]
  staff: Staff[]
  selectedDate: Date
  onDateChange: (date: Date) => void
  onShiftEdit?: (shift: Shift) => void
  onStaffAssign: (shiftId: number, staffId: number) => void
  onStaffUnassign: (assignmentId: number) => void
  onAutoSchedule?: () => void
  onManualOverride?: (shiftId: number, staffId: number, action: 'assign' | 'unassign') => void
  isLoading?: boolean
  isDraftMode?: boolean
  showAIRecommendations?: boolean
  currentUserId?: number
  currentUserName?: string
}

// Drag and Drop Types
const ItemTypes = {
  STAFF: 'staff',
  ASSIGNMENT: 'assignment'
}

interface DragItem {
  type: string
  id: number
  staffId?: number
  assignmentId?: number
  sourceShiftId?: number
}

// Enhanced Staff Card Component
interface EnhancedStaffCardProps {
  staff: Staff
  isAssigned?: boolean
  assignment?: ShiftAssignment
  showDetails?: boolean
}

const EnhancedStaffCard: React.FC<EnhancedStaffCardProps> = ({ 
  staff, 
  isAssigned = false, 
  assignment,
  showDetails = false 
}) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.STAFF,
    item: {
      type: ItemTypes.STAFF,
      id: staff.id,
      staffId: staff.id,
      assignmentId: assignment?.id,
      sourceShiftId: assignment ? undefined : undefined
    } as DragItem,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }))

  const getSkillIcon = (skill: string) => {
    switch (skill) {
      case 'kitchen': return '👨‍🍳'
      case 'front_of_house': return '👥'
      case 'bar': return '🍺'
      case 'management': return '👔'
      case 'cleaning': return '🧹'
      default: return '👤'
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200'
      case 'called_in_sick': return 'bg-red-100 text-red-800 border-red-200'
      case 'no_show': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  return (
    <div
      ref={drag as any}
      className={`
        inline-flex items-center px-2 py-1 rounded-md text-xs font-medium cursor-move
        transition-all duration-200 border
        ${isDragging ? 'opacity-50' : 'opacity-100'}
        ${isAssigned 
          ? getStatusColor(assignment?.status)
          : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
        }
        ${assignment?.is_ai_generated ? 'ring-1 ring-blue-300' : ''}
        ${assignment?.manual_override ? 'ring-1 ring-purple-300' : ''}
      `}
    >
      <UserIcon className="h-3 w-3 mr-1" />
      <span className="truncate max-w-16">{staff.name}</span>
      
      {/* Skill indicator */}
      {staff.skills.length > 0 && (
        <span className="ml-1" title={staff.skills.join(', ')}>
          {getSkillIcon(staff.skills[0])}
        </span>
      )}
      
      {/* AI/Manual override indicators */}
      {assignment?.is_ai_generated && (
        <SparklesIcon className="h-3 w-3 ml-1 text-blue-500" title="AI Generated" />
      )}
      {assignment?.manual_override && (
        <CogIcon className="h-3 w-3 ml-1 text-purple-500" title="Manual Override" />
      )}
      
      {/* Confidence indicator for assigned staff */}
      {assignment?.confidence_score && (
        <div className="ml-1">
          <div 
            className={`w-2 h-2 rounded-full ${
              assignment.confidence_score >= 0.8 ? 'bg-green-400' :
              assignment.confidence_score >= 0.6 ? 'bg-amber-400' : 'bg-red-400'
            }`}
            title={`Confidence: ${Math.round(assignment.confidence_score * 100)}%`}
          />
        </div>
      )}
      
      {/* Status indicators */}
      {assignment?.status === 'called_in_sick' && (
        <span className="ml-1">🤒</span>
      )}
      {assignment?.status === 'confirmed' && (
        <CheckCircleSolidIcon className="h-3 w-3 ml-1 text-green-600" />
      )}
      
      {/* Detailed info on hover */}
      {showDetails && (
        <div className="absolute z-10 bg-white border rounded-lg shadow-lg p-2 -mt-2 ml-2 min-w-48">
          <div className="font-medium">{staff.name}</div>
          <div className="text-xs text-gray-600">{staff.role}</div>
          <div className="text-xs text-gray-600">Skills: {staff.skills.join(', ')}</div>
          {staff.hourly_rate && (
            <div className="text-xs text-gray-600">
              <CurrencyPoundIcon className="h-3 w-3 inline mr-1" />
              {staff.hourly_rate}/hr
            </div>
          )}
          {staff.reliability_score && (
            <div className="text-xs text-gray-600">
              Reliability: {staff.reliability_score}/10
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Enhanced Shift Cell Component
interface EnhancedShiftCellProps {
  shift: Shift
  staff: Staff[]
  onStaffAssign: (shiftId: number, staffId: number) => void
  onStaffUnassign: (assignmentId: number) => void
  onShiftClick?: (shift: Shift) => void
  onManualOverride?: (shiftId: number, staffId: number, action: 'assign' | 'unassign') => void
  showAIRecommendations?: boolean
}

const EnhancedShiftCell: React.FC<EnhancedShiftCellProps> = ({ 
  shift, 
  staff, 
  onStaffAssign, 
  onStaffUnassign,
  onShiftClick,
  onManualOverride,
  showAIRecommendations = false
}) => {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ItemTypes.STAFF,
    drop: (item: DragItem) => {
      if (item.staffId && item.assignmentId) {
        // Moving existing assignment
        onStaffUnassign(item.assignmentId)
        onStaffAssign(shift.id, item.staffId)
      } else if (item.staffId) {
        // New assignment
        onStaffAssign(shift.id, item.staffId)
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }))

  // Calculate shift status
  const assignedCount = shift.assignments.filter(a => a.status === 'assigned' || a.status === 'confirmed').length
  const sickCount = shift.assignments.filter(a => a.status === 'called_in_sick').length
  const actualStaffing = assignedCount - sickCount
  const coveragePercentage = (actualStaffing / shift.required_staff_count) * 100

  const getShiftStatusColor = () => {
    if (actualStaffing >= shift.required_staff_count) {
      return 'border-l-green-500 bg-green-50'
    } else if (actualStaffing >= Math.ceil(shift.required_staff_count * 0.7)) {
      return 'border-l-amber-500 bg-amber-50'
    } else {
      return 'border-l-red-500 bg-red-50'
    }
  }

  const getConfidenceColor = (score?: number) => {
    if (!score) return 'bg-gray-200'
    if (score >= 0.8) return 'bg-green-400'
    if (score >= 0.6) return 'bg-amber-400'
    return 'bg-red-400'
  }

  const getSkillIcon = (skill: string) => {
    switch (skill) {
      case 'kitchen': return '👨‍🍳'
      case 'front_of_house': return '👥'
      case 'bar': return '🍺'
      case 'management': return '👔'
      case 'cleaning': return '🧹'
      default: return '👤'
    }
  }

  return (
    <div
      ref={drop as any}
      className={`
        p-3 rounded-md border-l-4 border text-xs cursor-pointer
        transition-all duration-200 min-h-[100px]
        ${getShiftStatusColor()}
        ${isOver && canDrop ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}
        ${isOver && !canDrop ? 'ring-2 ring-red-400 ring-opacity-50' : ''}
        hover:shadow-sm
      `}
      onClick={() => onShiftClick?.(shift)}
    >
      {/* Shift Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium truncate flex-1">{shift.title}</div>
        <div className="flex items-center space-x-1">
          {shift.ai_generated && (
            <SparklesIcon className="h-4 w-4 text-blue-500" title="AI Generated" />
          )}
          {shift.confidence_score && (
            <div 
              className={`w-3 h-3 rounded-full ${getConfidenceColor(shift.confidence_score)}`}
              title={`AI Confidence: ${Math.round(shift.confidence_score * 100)}%`}
            />
          )}
        </div>
      </div>

      {/* Time and Skill */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-1">
          <ClockIcon className="h-3 w-3" />
          <span>{shift.start_time}-{shift.end_time}</span>
        </div>
        <div className="flex items-center space-x-1">
          <span>{getSkillIcon(shift.required_skill)}</span>
          <span className="capitalize">{shift.required_skill.replace('_', ' ')}</span>
        </div>
      </div>

      {/* Coverage Bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Coverage: {actualStaffing}/{shift.required_staff_count}</span>
          <span>{Math.round(coveragePercentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              coveragePercentage >= 100 ? 'bg-green-500' :
              coveragePercentage >= 70 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(coveragePercentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Staff Assignments */}
      <div className="space-y-1">
        {shift.assignments.map((assignment) => {
          const assignedStaff = staff.find(s => s.id === assignment.staff_id)
          if (!assignedStaff) return null

          return (
            <div key={assignment.id} className="flex items-center justify-between">
              <EnhancedStaffCard 
                staff={assignedStaff} 
                isAssigned={true} 
                assignment={assignment}
              />
              <div className="flex items-center space-x-1">
                {assignment.manual_override && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onManualOverride?.(shift.id, assignment.staff_id, 'unassign')
                    }}
                    className="text-red-500 hover:text-red-700"
                    title="Remove manual override"
                  >
                    <XCircleIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* AI Recommendations */}
      {showAIRecommendations && shift.ai_generated && (
        <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
          <div className="flex items-center space-x-1 text-xs text-blue-700">
            <SparklesIcon className="h-3 w-3" />
            <span>AI Recommended</span>
          </div>
        </div>
      )}
    </div>
  )
}

// Available Staff Panel
interface AvailableStaffPanelProps {
  staff: Staff[]
  assignedStaffIds: Set<number>
  onStaffClick?: (staff: Staff) => void
  showDetails?: boolean
}

const AvailableStaffPanel: React.FC<AvailableStaffPanelProps> = ({ 
  staff, 
  assignedStaffIds,
  onStaffClick,
  showDetails = false 
}) => {
  const availableStaff = staff.filter(s => !assignedStaffIds.has(s.id) && s.is_available)

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="font-medium text-sm mb-3 flex items-center">
        <UserIcon className="h-4 w-4 mr-2" />
        Available Staff ({availableStaff.length})
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {availableStaff.map((staffMember) => (
          <div key={staffMember.id}>
            <EnhancedStaffCard 
              staff={staffMember} 
              showDetails={showDetails}
            />
          </div>
        ))}
        {availableStaff.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-4">
            No available staff
          </div>
        )}
      </div>
    </div>
  )
}

// Main Enhanced Calendar Component
const EnhancedShiftCalendar: React.FC<EnhancedShiftCalendarProps> = ({
  businessId,
  shifts,
  staff,
  selectedDate,
  onDateChange,
  onShiftEdit,
  onStaffAssign,
  onStaffUnassign,
  onAutoSchedule,
  onManualOverride,
  isLoading = false,
  isDraftMode = false,
  showAIRecommendations = false,
  currentUserId = 1,
  currentUserName = 'Current User'
}) => {
  const [showStaffDetails, setShowStaffDetails] = useState(false)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)

  // Calculate date range for current week
  const startDate = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const endDate = endOfWeek(selectedDate, { weekStartsOn: 1 })

  // Generate week days
  const weekDays = []
  let current = startDate
  while (current <= endDate) {
    weekDays.push(new Date(current))
    current = addDays(current, 1)
  }

  // Get shifts for a specific day
  const getShiftsForDay = (date: Date) => {
    return shifts.filter(shift => 
      isSameDay(parseISO(shift.date), date)
    ).sort((a, b) => a.start_time.localeCompare(b.start_time))
  }

  // Get all assigned staff IDs
  const assignedStaffIds = new Set(
    shifts.flatMap(shift => shift.assignments.map(a => a.staff_id))
  )

  // Navigation handlers
  const handlePreviousWeek = () => {
    onDateChange(addDays(selectedDate, -7))
  }

  const handleNextWeek = () => {
    onDateChange(addDays(selectedDate, 7))
  }

  const handleToday = () => {
    onDateChange(new Date())
  }

  const handleShiftClick = (shift: Shift) => {
    setSelectedShift(shift)
    onShiftEdit?.(shift)
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Calendar Header */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-semibold text-gray-900">Shift Calendar</h2>
              {isDraftMode && (
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                  Draft Mode
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePreviousWeek}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              
              <button
                onClick={handleToday}
                className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Today
              </button>
              
              <div className="text-sm font-medium text-gray-900">
                {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
              </div>
              
              <button
                onClick={handleNextWeek}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowStaffDetails(!showStaffDetails)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                title={showStaffDetails ? 'Hide staff details' : 'Show staff details'}
              >
                {showStaffDetails ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
              
              {onAutoSchedule && (
                <button
                  onClick={onAutoSchedule}
                  disabled={isLoading}
                  className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  <SparklesIcon className="h-4 w-4" />
                  <span>AI Schedule</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-8 gap-4 p-4">
          {/* Day Headers */}
          <div className="text-sm font-medium text-gray-500">Staff</div>
          {weekDays.map((day) => (
            <div key={day.toISOString()} className="text-center">
              <div className={`text-sm font-medium ${
                isToday(day) ? 'text-blue-600' : 'text-gray-900'
              }`}>
                {format(day, 'EEE')}
              </div>
              <div className={`text-xs ${
                isToday(day) ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {format(day, 'MMM d')}
              </div>
            </div>
          ))}

          {/* Available Staff Panel */}
          <div className="row-span-full">
            <AvailableStaffPanel 
              staff={staff}
              assignedStaffIds={assignedStaffIds}
              showDetails={showStaffDetails}
            />
          </div>

          {/* Day Columns */}
          {weekDays.map((day) => (
            <div key={day.toISOString()} className="space-y-2">
              {getShiftsForDay(day).map((shift) => (
                <EnhancedShiftCell
                  key={shift.id}
                  shift={shift}
                  staff={staff}
                  onStaffAssign={onStaffAssign}
                  onStaffUnassign={onStaffUnassign}
                  onShiftClick={handleShiftClick}
                  onManualOverride={onManualOverride}
                  showAIRecommendations={showAIRecommendations}
                />
              ))}
              {getShiftsForDay(day).length === 0 && (
                <div className="h-20 border-2 border-dashed border-gray-200 rounded-md flex items-center justify-center">
                  <span className="text-xs text-gray-400">No shifts</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <div className="mt-2 text-sm text-gray-600">Generating schedule...</div>
            </div>
          </div>
        )}
      </div>
    </DndProvider>
  )
}

export default EnhancedShiftCalendar 