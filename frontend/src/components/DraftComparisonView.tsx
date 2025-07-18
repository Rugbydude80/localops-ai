import React, { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { 
  ChevronRightIcon, 
  ChevronDownIcon,
  UserPlusIcon,
  UserMinusIcon,
  ArrowRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { DraftShift, DraftAssignment, ScheduleDraft } from '../hooks/useDraftSchedule'

interface DraftComparisonViewProps {
  originalDraft: ScheduleDraft
  currentDraft: ScheduleDraft
  onRevertChange?: (changeId: string) => void
  className?: string
}

interface ShiftChange {
  id: string
  type: 'assignment_added' | 'assignment_removed' | 'assignment_moved' | 'shift_modified'
  shiftId: number
  shiftTitle: string
  description: string
  details: any
  severity: 'low' | 'medium' | 'high'
}

const DraftComparisonView: React.FC<DraftComparisonViewProps> = ({
  originalDraft,
  currentDraft,
  onRevertChange,
  className = ''
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['changes']))
  const [selectedChange, setSelectedChange] = useState<ShiftChange | null>(null)

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  // Calculate changes between original and current draft
  const calculateChanges = (): ShiftChange[] => {
    const changes: ShiftChange[] = []

    currentDraft.shifts.forEach(currentShift => {
      const originalShift = originalDraft.shifts.find(s => s.id === currentShift.id)
      
      if (!originalShift) {
        // New shift added
        changes.push({
          id: `shift-added-${currentShift.id}`,
          type: 'shift_modified',
          shiftId: currentShift.id,
          shiftTitle: currentShift.title,
          description: `New shift added: ${currentShift.title}`,
          details: { shift: currentShift },
          severity: 'medium'
        })
        return
      }

      // Check for assignment changes
      const currentAssignments = new Map(currentShift.assignments.map(a => [a.staff_id, a]))
      const originalAssignments = new Map(originalShift.assignments.map(a => [a.staff_id, a]))

      // Find added assignments
      currentAssignments.forEach((assignment, staffId) => {
        if (!originalAssignments.has(staffId)) {
          changes.push({
            id: `assignment-added-${currentShift.id}-${staffId}`,
            type: 'assignment_added',
            shiftId: currentShift.id,
            shiftTitle: currentShift.title,
            description: `${assignment.staff_name} assigned to ${currentShift.title}`,
            details: { assignment, shift: currentShift },
            severity: 'low'
          })
        }
      })

      // Find removed assignments
      originalAssignments.forEach((assignment, staffId) => {
        if (!currentAssignments.has(staffId)) {
          // Check if this staff member was moved to another shift
          const movedTo = currentDraft.shifts.find(s => 
            s.id !== currentShift.id && 
            s.assignments.some(a => a.staff_id === staffId)
          )

          if (movedTo) {
            changes.push({
              id: `assignment-moved-${currentShift.id}-${movedTo.id}-${staffId}`,
              type: 'assignment_moved',
              shiftId: currentShift.id,
              shiftTitle: currentShift.title,
              description: `${assignment.staff_name} moved from ${currentShift.title} to ${movedTo.title}`,
              details: { 
                assignment, 
                fromShift: currentShift, 
                toShift: movedTo,
                staffId 
              },
              severity: 'medium'
            })
          } else {
            changes.push({
              id: `assignment-removed-${currentShift.id}-${staffId}`,
              type: 'assignment_removed',
              shiftId: currentShift.id,
              shiftTitle: currentShift.title,
              description: `${assignment.staff_name} unassigned from ${currentShift.title}`,
              details: { assignment, shift: currentShift },
              severity: 'high'
            })
          }
        }
      })
    })

    return changes.sort((a, b) => {
      // Sort by severity (high first), then by shift title
      const severityOrder = { high: 0, medium: 1, low: 2 }
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity]
      }
      return a.shiftTitle.localeCompare(b.shiftTitle)
    })
  }

  const changes = calculateChanges()

  // Calculate statistics
  const stats = {
    totalChanges: changes.length,
    assignmentsAdded: changes.filter(c => c.type === 'assignment_added').length,
    assignmentsRemoved: changes.filter(c => c.type === 'assignment_removed').length,
    assignmentsMoved: changes.filter(c => c.type === 'assignment_moved').length,
    shiftsModified: new Set(changes.map(c => c.shiftId)).size
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200'
      case 'low': return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <ExclamationTriangleIcon className="h-4 w-4" />
      case 'medium': return <InformationCircleIcon className="h-4 w-4" />
      case 'low': return <CheckCircleIcon className="h-4 w-4" />
      default: return <InformationCircleIcon className="h-4 w-4" />
    }
  }

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'assignment_added': return <UserPlusIcon className="h-4 w-4 text-green-600" />
      case 'assignment_removed': return <UserMinusIcon className="h-4 w-4 text-red-600" />
      case 'assignment_moved': return <ArrowRightIcon className="h-4 w-4 text-blue-600" />
      default: return <ClockIcon className="h-4 w-4 text-gray-600" />
    }
  }

  if (changes.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="text-center">
          <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Changes Made</h3>
          <p className="text-gray-500">
            The current schedule matches the original AI-generated schedule.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Schedule Changes</h3>
            <p className="text-sm text-gray-500">
              Comparing current draft with original AI-generated schedule
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">
              {format(parseISO(currentDraft.modified_at), 'MMM d, yyyy h:mm a')}
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.totalChanges}</div>
            <div className="text-xs text-gray-500">Total Changes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.assignmentsAdded}</div>
            <div className="text-xs text-gray-500">Added</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.assignmentsRemoved}</div>
            <div className="text-xs text-gray-500">Removed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.assignmentsMoved}</div>
            <div className="text-xs text-gray-500">Moved</div>
          </div>
        </div>
      </div>

      {/* Changes List */}
      <div className="divide-y divide-gray-200">
        <div className="p-4">
          <button
            onClick={() => toggleSection('changes')}
            className="flex items-center justify-between w-full text-left"
          >
            <h4 className="text-sm font-medium text-gray-900">
              Changes ({changes.length})
            </h4>
            {expandedSections.has('changes') ? (
              <ChevronDownIcon className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-gray-500" />
            )}
          </button>

          {expandedSections.has('changes') && (
            <div className="mt-4 space-y-2">
              {changes.map((change) => (
                <div
                  key={change.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-sm ${
                    selectedChange?.id === change.id 
                      ? 'ring-2 ring-blue-500 ring-opacity-50' 
                      : ''
                  } ${getSeverityColor(change.severity)}`}
                  onClick={() => setSelectedChange(selectedChange?.id === change.id ? null : change)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getChangeIcon(change.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900">
                          {change.description}
                        </p>
                        <div className="flex items-center space-x-1">
                          {getSeverityIcon(change.severity)}
                        </div>
                      </div>
                      <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                        <span>{format(parseISO(currentDraft.modified_at), 'h:mm a')}</span>
                        <span className="capitalize">{change.type.replace('_', ' ')}</span>
                      </div>
                    </div>
                    {onRevertChange && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onRevertChange(change.id)
                        }}
                        className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Revert
                      </button>
                    )}
                  </div>

                  {/* Expanded details */}
                  {selectedChange?.id === change.id && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-xs text-gray-600">
                        {change.type === 'assignment_moved' && (
                          <div className="space-y-1">
                            <div>From: {change.details.fromShift.title}</div>
                            <div>To: {change.details.toShift.title}</div>
                            <div>Staff: {change.details.assignment.staff_name}</div>
                          </div>
                        )}
                        {(change.type === 'assignment_added' || change.type === 'assignment_removed') && (
                          <div className="space-y-1">
                            <div>Shift: {change.shiftTitle}</div>
                            <div>Staff: {change.details.assignment.staff_name}</div>
                            <div>Time: {change.details.shift.start_time} - {change.details.shift.end_time}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Impact Analysis */}
        <div className="p-4">
          <button
            onClick={() => toggleSection('impact')}
            className="flex items-center justify-between w-full text-left"
          >
            <h4 className="text-sm font-medium text-gray-900">
              Impact Analysis
            </h4>
            {expandedSections.has('impact') ? (
              <ChevronDownIcon className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-gray-500" />
            )}
          </button>

          {expandedSections.has('impact') && (
            <div className="mt-4 space-y-3">
              {/* Coverage Impact */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <h5 className="text-sm font-medium text-gray-900 mb-2">Coverage Impact</h5>
                <div className="space-y-2">
                  {currentDraft.shifts.map(shift => {
                    const originalShift = originalDraft.shifts.find(s => s.id === shift.id)
                    if (!originalShift) return null

                    const currentCoverage = shift.assignments.length / shift.required_staff_count
                    const originalCoverage = originalShift.assignments.length / originalShift.required_staff_count
                    const coverageChange = currentCoverage - originalCoverage

                    if (Math.abs(coverageChange) < 0.01) return null

                    return (
                      <div key={shift.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700">{shift.title}</span>
                        <span className={`font-medium ${
                          coverageChange > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {coverageChange > 0 ? '+' : ''}{Math.round(coverageChange * 100)}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* AI Confidence Impact */}
              {originalDraft.ai_generated && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <h5 className="text-sm font-medium text-gray-900 mb-2">AI Confidence Impact</h5>
                  <p className="text-xs text-gray-600">
                    Manual changes may affect the AI's confidence in the overall schedule optimization.
                    Consider the reasoning behind original assignments when making modifications.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DraftComparisonView