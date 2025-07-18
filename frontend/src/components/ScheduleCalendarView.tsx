import React, { useState, useCallback, useEffect } from 'react'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { format, parseISO, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, UserIcon, ExclamationTriangleIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import ShiftDetailPopover from './ShiftDetailPopover'
import { useDraftSchedule, DraftShift, DraftAssignment } from '../hooks/useDraftSchedule'
import DraftComparisonView from './DraftComparisonView'
import ConfidenceIndicator from './ConfidenceIndicator'
import UserPresenceIndicator from './UserPresenceIndicator'
import ConflictResolutionModal from './ConflictResolutionModal'
import { useCollaboration, EditConflict } from '../hooks/useCollaboration'
import AssignmentValidationIndicator from './AssignmentValidationIndicator'
import ConstraintViolationsPanel from './ConstraintViolationsPanel'
import useConstraintValidation from '../hooks/useConstraintValidation'

// Types
export interface Staff {
  id: number
  name: string
  skills: string[]
  hourly_rate?: number
  is_available?: boolean
}

export interface ShiftAssignment {
  id: number
  staff_id: number
  staff_name: string
  status: 'assigned' | 'called_in_sick' | 'no_show'
  confidence_score?: number
  reasoning?: string
  reasoning_data?: {
    staff_id: number
    shift_id: number
    confidence_score: number
    primary_reasons: string[]
    considerations: string[]
    alternatives_considered: Array<{
      staff_id: number
      score: number
      reason: string
      pros?: string[]
      cons?: string[]
    }>
    risk_factors: string[]
  }
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
}

export interface ScheduleCalendarViewProps {
  businessId: number
  shifts: Shift[]
  staff: Staff[]
  selectedDate: Date
  onDateChange: (date: Date) => void
  onShiftEdit?: (shift: Shift) => void
  onStaffAssign: (shiftId: number, staffId: number) => void
  onStaffUnassign: (assignmentId: number) => void
  onAutoSchedule?: () => void
  isLoading?: boolean
  isDraftMode?: boolean
  showComparison?: boolean
  // Collaboration props
  currentUserId?: number
  currentUserName?: string
  enableCollaboration?: boolean
  draftId?: string
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

// Staff Card Component for dragging
interface StaffCardProps {
  staff: Staff
  isAssigned?: boolean
  assignment?: ShiftAssignment
}

const StaffCard: React.FC<StaffCardProps> = ({ staff, isAssigned = false, assignment }) => {
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

  return (
    <div
      ref={drag}
      className={`
        inline-flex items-center px-2 py-1 rounded-md text-xs font-medium cursor-move
        transition-all duration-200 border
        ${isDragging ? 'opacity-50' : 'opacity-100'}
        ${isAssigned 
          ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200' 
          : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
        }
        ${assignment?.status === 'called_in_sick' ? 'bg-red-100 text-red-800 border-red-200' : ''}
      `}
    >
      <UserIcon className="h-3 w-3 mr-1" />
      <span className="truncate max-w-16">{staff.name}</span>
      
      {/* Confidence indicator for assigned staff */}
      {assignment?.confidence_score && (
        <div className="ml-1">
          <ConfidenceIndicator
            score={assignment.confidence_score}
            size="sm"
            showLabel={false}
            showIcon={false}
            className="!px-1 !py-0.5 !text-xs"
          />
        </div>
      )}
      
      {assignment?.status === 'called_in_sick' && (
        <span className="ml-1">🤒</span>
      )}
    </div>
  )
}

// Shift Cell Component with drop functionality
interface ShiftCellProps {
  shift: Shift
  staff: Staff[]
  onStaffAssign: (shiftId: number, staffId: number) => void
  onStaffUnassign: (assignmentId: number) => void
  onShiftClick?: (shift: Shift) => void
}

const ShiftCell: React.FC<ShiftCellProps> = ({ 
  shift, 
  staff, 
  onStaffAssign, 
  onStaffUnassign,
  onShiftClick 
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
  const assignedCount = shift.assignments.filter(a => a.status === 'assigned').length
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

  return (
    <div
      ref={drop}
      className={`
        p-2 rounded-md border-l-4 border text-xs cursor-pointer
        transition-all duration-200 min-h-[80px]
        ${getShiftStatusColor()}
        ${isOver && canDrop ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}
        ${isOver && !canDrop ? 'ring-2 ring-red-400 ring-opacity-50' : ''}
        hover:shadow-sm
      `}
      onClick={() => onShiftClick?.(shift)}
    >
      {/* Shift Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="font-medium truncate flex-1">{shift.title}</div>
        {shift.ai_generated && (
          <div className="flex items-center space-x-1">
            {shift.confidence_score && (
              <div 
                className={`w-2 h-2 rounded-full ${getConfidenceColor(shift.confidence_score)}`}
                title={`AI Confidence: ${Math.round(shift.confidence_score * 100)}%`}
              />
            )}
            <span className="text-xs text-blue-600 font-medium">AI</span>
          </div>
        )}
      </div>

      {/* Time and Skill */}
      <div className="text-xs opacity-75 mb-1">
        {shift.start_time}-{shift.end_time}
      </div>
      <div className="text-xs opacity-75 mb-2 capitalize">
        {shift.required_skill.replace('_', ' ')}
      </div>

      {/* Staffing Status */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium ${
          actualStaffing >= shift.required_staff_count ? 'text-green-600' :
          actualStaffing >= Math.ceil(shift.required_staff_count * 0.7) ? 'text-amber-600' :
          'text-red-600'
        }`}>
          {actualStaffing}/{shift.required_staff_count}
        </span>
        {actualStaffing < shift.required_staff_count && (
          <ExclamationTriangleIcon className="h-3 w-3 text-red-500" />
        )}
      </div>

      {/* Coverage Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-1 mb-2">
        <div 
          className={`h-1 rounded-full transition-all duration-300 ${
            coveragePercentage >= 100 ? 'bg-green-500' :
            coveragePercentage >= 70 ? 'bg-amber-500' :
            'bg-red-500'
          }`}
          style={{ width: `${Math.min(100, coveragePercentage)}%` }}
        />
      </div>

      {/* Assigned Staff */}
      <div className="space-y-1">
        {shift.assignments.map(assignment => {
          const staffMember = staff.find(s => s.id === assignment.staff_id)
          if (!staffMember) return null
          
          return (
            <div key={assignment.id} className="flex items-center space-x-1">
              <StaffCard
                staff={staffMember}
                isAssigned={true}
                assignment={assignment}
              />
              <AssignmentValidationIndicator
                shiftId={shift.id}
                staffId={assignment.staff_id}
                businessId={shift.business_id || 1}
                className="flex-shrink-0"
              />
            </div>
          )
        })}
      </div>

      {/* Drop Zone Indicator */}
      {isOver && canDrop && (
        <div className="mt-2 p-1 border-2 border-dashed border-blue-400 rounded text-center text-blue-600 text-xs">
          Drop to assign
        </div>
      )}
    </div>
  )
}

// Available Staff Panel
interface AvailableStaffPanelProps {
  staff: Staff[]
  assignedStaffIds: Set<number>
}

const AvailableStaffPanel: React.FC<AvailableStaffPanelProps> = ({ staff, assignedStaffIds }) => {
  const availableStaff = staff.filter(s => !assignedStaffIds.has(s.id))

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
        <UserIcon className="h-4 w-4 mr-2" />
        Available Staff ({availableStaff.length})
      </h3>
      <div className="flex flex-wrap gap-2">
        {availableStaff.map(staffMember => (
          <StaffCard
            key={staffMember.id}
            staff={staffMember}
            isAssigned={false}
          />
        ))}
        {availableStaff.length === 0 && (
          <p className="text-sm text-gray-500 italic">All staff are assigned</p>
        )}
      </div>
    </div>
  )
}

// Main Calendar Component
const ScheduleCalendarView: React.FC<ScheduleCalendarViewProps> = ({
  businessId,
  shifts,
  staff,
  selectedDate,
  onDateChange,
  onShiftEdit,
  onStaffAssign,
  onStaffUnassign,
  onAutoSchedule,
  isLoading = false,
  isDraftMode = false,
  showComparison = false,
  currentUserId = 1,
  currentUserName = 'Current User',
  enableCollaboration = true,
  draftId
}) => {
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [showShiftDetail, setShowShiftDetail] = useState(false)
  const [showComparisonView, setShowComparisonView] = useState(showComparison)
  const [activeConflict, setActiveConflict] = useState<EditConflict | null>(null)
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [showViolationsPanel, setShowViolationsPanel] = useState(true)

  // Constraint validation
  const constraintValidation = useConstraintValidation(businessId)

  // Use draft schedule context if in draft mode
  const draftSchedule = isDraftMode ? useDraftSchedule() : null

  // Initialize collaboration if enabled
  const collaboration = useCollaboration({
    businessId,
    userId: currentUserId,
    userName: currentUserName,
    draftId: isDraftMode ? draftId : undefined,
    onConflictDetected: (conflict) => {
      setActiveConflict(conflict)
      setShowConflictModal(true)
    },
    onUserJoined: (user) => {
      console.log(`${user.user_name} joined the schedule editing session`)
    },
    onUserLeft: (userId) => {
      console.log(`User ${userId} left the schedule editing session`)
    },
    onLockConflict: (lock) => {
      console.log(`Resource locked by ${lock.user_name}`)
    }
  })

  // Handle draft-specific staff assignment
  const handleStaffAssign = useCallback(async (shiftId: number, staffId: number) => {
    // Validate assignment in real-time
    const validationResult = await constraintValidation.validateSingleAssignment(
      shiftId, 
      staffId,
      displayShifts.map(s => s.assignments.map(a => ({ shift_id: s.id, staff_id: a.staff_id }))).flat()
    )

    // Show warnings if any
    if (validationResult.warnings.length > 0) {
      console.warn('Assignment warnings:', validationResult.warnings)
    }

    // Proceed with assignment if valid or user confirms
    if (validationResult.valid || validationResult.errors.length === 0) {
      if (isDraftMode && draftSchedule) {
        const staffMember = staff.find(s => s.id === staffId)
        if (staffMember) {
          draftSchedule.assignStaff(shiftId, staffId, staffMember.name)
        }
      } else {
        onStaffAssign(shiftId, staffId)
      }
    }
  }, [isDraftMode, draftSchedule, staff, onStaffAssign, constraintValidation, displayShifts])

  // Handle draft-specific staff unassignment
  const handleStaffUnassign = useCallback((assignmentId: number) => {
    if (isDraftMode && draftSchedule) {
      draftSchedule.unassignStaff(assignmentId)
    } else {
      onStaffUnassign(assignmentId)
    }
  }, [isDraftMode, draftSchedule, onStaffUnassign])

  // Use draft shifts if in draft mode, otherwise use regular shifts
  const displayShifts = isDraftMode && draftSchedule?.state.currentDraft 
    ? draftSchedule.state.currentDraft.shifts.map(draftShift => ({
        ...draftShift,
        assignments: draftShift.assignments.map(assignment => ({
          ...assignment,
          staff_name: assignment.staff_name
        }))
      }))
    : shifts

  // Validate assignments when shifts change
  useEffect(() => {
    if (displayShifts.length > 0) {
      const assignments = displayShifts.flatMap(shift => 
        shift.assignments.map(assignment => ({
          shift_id: shift.id,
          staff_id: assignment.staff_id
        }))
      )
      
      if (assignments.length > 0) {
        constraintValidation.validateAssignments(assignments, draftId)
          .catch(error => console.error('Failed to validate assignments:', error))
      }
    }
  }, [displayShifts, constraintValidation, draftId])

  // Calculate week range
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
  const getShiftsForDay = useCallback((date: Date) => {
    return displayShifts.filter(shift => 
      isSameDay(parseISO(shift.date), date)
    ).sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [displayShifts])

  // Get all assigned staff IDs
  const assignedStaffIds = new Set(
    displayShifts.flatMap(shift => 
      shift.assignments.map(assignment => assignment.staff_id)
    )
  )

  const handleShiftClick = (shift: Shift) => {
    setSelectedShift(shift)
    setShowShiftDetail(true)
    onShiftEdit?.(shift)
  }

  const handlePreviousWeek = () => {
    onDateChange(addDays(selectedDate, -7))
  }

  const handleNextWeek = () => {
    onDateChange(addDays(selectedDate, 7))
  }

  const handleToday = () => {
    onDateChange(new Date())
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div 
          className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
          data-testid="loading-spinner"
          role="status"
          aria-label="Loading schedule"
        ></div>
      </div>
    )
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-6">
        {/* Header with Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handlePreviousWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2" />
              Week of {format(startDate, 'MMM d, yyyy')}
              {isDraftMode && draftSchedule?.state.isModified && (
                <span className="ml-2 px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded-full">
                  Modified
                </span>
              )}
            </h2>
            <button
              onClick={handleNextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Next week"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
            
            {/* User Presence Indicator */}
            {enableCollaboration && collaboration.isConnected && (
              <UserPresenceIndicator
                users={collaboration.activeUsers}
                className="ml-4"
                maxVisible={3}
                showActions={true}
              />
            )}
            
            {/* Connection Status */}
            {enableCollaboration && (
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  collaboration.isConnected ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className="text-xs text-gray-500">
                  {collaboration.isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Draft Controls */}
            {isDraftMode && draftSchedule && (
              <>
                <button
                  onClick={draftSchedule.undo}
                  disabled={!draftSchedule.canUndo}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Undo last action"
                  title="Undo"
                >
                  <ArrowUturnLeftIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={draftSchedule.redo}
                  disabled={!draftSchedule.canRedo}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Redo last action"
                  title="Redo"
                >
                  <ArrowUturnRightIcon className="h-4 w-4" />
                </button>
                <div className="h-4 w-px bg-gray-300"></div>
                <button
                  onClick={() => setShowComparisonView(!showComparisonView)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    showComparisonView 
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Compare Changes
                </button>
                <button
                  onClick={draftSchedule.resetDraft}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Reset
                </button>
                {draftSchedule.state.isSyncing && (
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-400"></div>
                    <span>Syncing...</span>
                  </div>
                )}
              </>
            )}
            
            <button
              onClick={handleToday}
              className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              aria-label="Go to today"
            >
              Today
            </button>
            {onAutoSchedule && (
              <button
                onClick={onAutoSchedule}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                aria-label="Generate automatic schedule"
              >
                Auto-Schedule
              </button>
            )}
          </div>
        </div>

        {/* Constraint Violations Panel */}
        {constraintValidation.hasIssues && showViolationsPanel && (
          <ConstraintViolationsPanel
            violations={constraintValidation.violations}
            warnings={constraintValidation.warnings}
            summary={constraintValidation.validationSummary}
            onDismiss={() => setShowViolationsPanel(false)}
            onResolveViolation={(violation) => {
              // Handle violation resolution
              console.log('Resolving violation:', violation)
            }}
            className="mb-4"
          />
        )}

        {/* Available Staff Panel */}
        <AvailableStaffPanel staff={staff} assignedStaffIds={assignedStaffIds} />

        {/* Calendar Grid */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Week Header */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => {
              const dayDate = weekDays[index]
              const isToday = isSameDay(dayDate, new Date())
              
              return (
                <div key={day} className={`p-4 text-center font-medium border-r border-gray-200 last:border-r-0 ${
                  isToday ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-700'
                }`}>
                  <div className="text-sm">{day}</div>
                  <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                    {format(dayDate, 'd')}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Calendar Body */}
          <div className="grid grid-cols-7 min-h-[400px]">
            {weekDays.map(day => {
              const dayShifts = getShiftsForDay(day)
              
              return (
                <div key={day.toISOString()} className="border-r border-gray-200 last:border-r-0 p-2">
                  <div className="space-y-2 min-h-[350px]">
                    {dayShifts.map(shift => (
                      <ShiftCell
                        key={shift.id}
                        shift={shift}
                        staff={staff}
                        onStaffAssign={handleStaffAssign}
                        onStaffUnassign={handleStaffUnassign}
                        onShiftClick={handleShiftClick}
                      />
                    ))}
                    {dayShifts.length === 0 && (
                      <div className="text-center text-gray-400 text-sm py-8">
                        No shifts scheduled
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Fully Staffed (100%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-amber-500 rounded"></div>
                <span>Partially Staffed (70-99%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>Understaffed (&lt;70%)</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                <span>High AI Confidence (80%+)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-amber-400 rounded-full"></div>
                <span>Medium AI Confidence (60-79%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                <span>Low AI Confidence (&lt;60%)</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-blue-600 font-medium text-xs">AI</span>
                <span>AI Generated Assignment</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>🤒</span>
                <span>Called in Sick</span>
              </div>
              <div className="flex items-center space-x-2">
                <UserIcon className="h-3 w-3" />
                <span>Drag staff to assign shifts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Draft Comparison View */}
        {isDraftMode && showComparisonView && draftSchedule?.state.originalDraft && draftSchedule?.state.currentDraft && (
          <DraftComparisonView
            originalDraft={draftSchedule.state.originalDraft}
            currentDraft={draftSchedule.state.currentDraft}
            className="mt-6"
          />
        )}

        {/* Shift Detail Popover */}
        {showShiftDetail && selectedShift && (
          <ShiftDetailPopover
            shift={selectedShift}
            staff={staff}
            isOpen={showShiftDetail}
            onClose={() => {
              setShowShiftDetail(false)
              setSelectedShift(null)
            }}
            onStaffAssign={handleStaffAssign}
            onStaffUnassign={handleStaffUnassign}
          />
        )}

        {/* Conflict Resolution Modal */}
        {enableCollaboration && showConflictModal && activeConflict && (
          <ConflictResolutionModal
            conflict={activeConflict}
            isOpen={showConflictModal}
            onClose={() => {
              setShowConflictModal(false)
              setActiveConflict(null)
            }}
            onResolve={(conflictId, resolution, data) => {
              collaboration.resolveConflict(conflictId, resolution, data)
              setShowConflictModal(false)
              setActiveConflict(null)
            }}
          />
        )}
      </div>
    </DndProvider>
  )
}

export default ScheduleCalendarView