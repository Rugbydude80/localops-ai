import React, { useState } from 'react'
import { XMarkIcon, UserIcon, ClockIcon, CurrencyPoundIcon, ExclamationTriangleIcon, CheckCircleIcon, LightBulbIcon } from '@heroicons/react/24/outline'
import { format, parseISO } from 'date-fns'
import { Shift, Staff, ShiftAssignment } from './ScheduleCalendarView'
import ReasoningDisplay from './ReasoningDisplay'
import ConfidenceIndicator from './ConfidenceIndicator'

interface ShiftDetailPopoverProps {
  shift: Shift
  staff: Staff[]
  isOpen: boolean
  onClose: () => void
  onStaffAssign: (shiftId: number, staffId: number) => void
  onStaffUnassign: (assignmentId: number) => void
  onShiftEdit?: (shift: Shift) => void
}

interface AssignmentReasoningProps {
  assignment: ShiftAssignment
  staff: Staff
}

const AssignmentReasoning: React.FC<AssignmentReasoningProps> = ({ assignment, staff }) => {
  // If we have detailed reasoning data, use the full ReasoningDisplay component
  if (assignment.reasoning_data) {
    return (
      <ReasoningDisplay
        reasoning={assignment.reasoning_data}
        staffName={staff.name}
        shiftTitle="this shift"
        compact={true}
        showAlternatives={false}
      />
    )
  }

  // Fallback to simple reasoning display with confidence indicator
  return (
    <div className="bg-gray-50 rounded-lg p-3 mt-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <LightBulbIcon className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-900">Assignment Reasoning</span>
        </div>
        {assignment.confidence_score && (
          <ConfidenceIndicator
            score={assignment.confidence_score}
            size="sm"
            showLabel={false}
          />
        )}
      </div>

      {assignment.reasoning ? (
        <div className="mb-3">
          <p className="text-sm text-gray-700">{assignment.reasoning}</p>
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          <div className="flex items-center space-x-2 text-sm">
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
            <span className="text-gray-700">Staff member has required skills</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
            <span className="text-gray-700">Available during shift hours</span>
          </div>
          {staff.hourly_rate && (
            <div className="flex items-center space-x-2 text-sm">
              <CurrencyPoundIcon className="h-4 w-4 text-blue-500" />
              <span className="text-gray-700">Rate: £{staff.hourly_rate}/hour</span>
            </div>
          )}
        </div>
      )}

      {assignment.status === 'called_in_sick' && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center space-x-2">
            <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700 font-medium">Called in sick</span>
          </div>
        </div>
      )}
    </div>
  )
}

const ShiftDetailPopover: React.FC<ShiftDetailPopoverProps> = ({
  shift,
  staff,
  isOpen,
  onClose,
  onStaffAssign,
  onStaffUnassign,
  onShiftEdit
}) => {
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null)

  if (!isOpen) return null

  // Calculate shift statistics
  const assignedCount = shift.assignments.filter(a => a.status === 'assigned').length
  const sickCount = shift.assignments.filter(a => a.status === 'called_in_sick').length
  const actualStaffing = assignedCount - sickCount
  const coveragePercentage = (actualStaffing / shift.required_staff_count) * 100

  // Get available staff (not already assigned to this shift)
  const assignedStaffIds = new Set(shift.assignments.map(a => a.staff_id))
  const availableStaff = staff.filter(s => !assignedStaffIds.has(s.id))

  const getShiftStatus = () => {
    if (actualStaffing >= shift.required_staff_count) {
      return { text: 'Fully Staffed', color: 'text-green-600', bg: 'bg-green-100' }
    } else if (actualStaffing >= Math.ceil(shift.required_staff_count * 0.7)) {
      return { text: 'Partially Staffed', color: 'text-amber-600', bg: 'bg-amber-100' }
    } else {
      return { text: 'Understaffed', color: 'text-red-600', bg: 'bg-red-100' }
    }
  }

  const status = getShiftStatus()

  const handleAssignStaff = () => {
    if (selectedStaffId) {
      onStaffAssign(shift.id, selectedStaffId)
      setSelectedStaffId(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{shift.title}</h3>
            <p className="text-sm text-gray-500">
              {format(parseISO(shift.date), 'EEEE, MMMM d, yyyy')} • {shift.start_time} - {shift.end_time}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Shift Details */}
        <div className="p-6 space-y-6">
          {/* Status and Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <UserIcon className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Staffing</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {actualStaffing}/{shift.required_staff_count}
              </div>
              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                {status.text}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <ClockIcon className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Required Skill</span>
              </div>
              <div className="text-lg font-semibold text-gray-900 capitalize">
                {shift.required_skill.replace('_', ' ')}
              </div>
            </div>

            {shift.hourly_rate && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <CurrencyPoundIcon className="h-5 w-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-900">Hourly Rate</span>
                </div>
                <div className="text-lg font-semibold text-gray-900">
                  £{shift.hourly_rate}
                </div>
              </div>
            )}
          </div>

          {/* Coverage Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">Coverage</span>
              <span className="text-sm text-gray-600">{Math.round(coveragePercentage)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  coveragePercentage >= 100 ? 'bg-green-500' :
                  coveragePercentage >= 70 ? 'bg-amber-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, coveragePercentage)}%` }}
              />
            </div>
          </div>

          {/* AI Information */}
          {shift.ai_generated && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-900">AI Generated Shift</span>
                {shift.confidence_score && (
                  <span className="text-sm text-blue-700">
                    (Confidence: {Math.round(shift.confidence_score * 100)}%)
                  </span>
                )}
              </div>
              <p className="text-sm text-blue-800">
                This shift was automatically generated based on historical data, staff preferences, and business requirements.
              </p>
            </div>
          )}

          {/* Current Assignments */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Current Assignments</h4>
            {shift.assignments.length > 0 ? (
              <div className="space-y-3">
                {shift.assignments.map(assignment => {
                  const staffMember = staff.find(s => s.id === assignment.staff_id)
                  if (!staffMember) return null

                  return (
                    <div key={assignment.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <UserIcon className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{staffMember.name}</div>
                            <div className="text-sm text-gray-500">
                              Skills: {staffMember.skills?.join(', ') || 'Not specified'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {assignment.status === 'called_in_sick' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              🤒 Sick
                            </span>
                          )}
                          <button
                            onClick={() => onStaffUnassign(assignment.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Assignment Reasoning */}
                      <AssignmentReasoning assignment={assignment} staff={staffMember} />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <UserIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No staff assigned to this shift</p>
              </div>
            )}
          </div>

          {/* Add Staff Section */}
          {availableStaff.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Add Staff</h4>
              <div className="flex items-center space-x-3">
                <select
                  value={selectedStaffId || ''}
                  onChange={(e) => setSelectedStaffId(e.target.value ? parseInt(e.target.value) : null)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select staff member...</option>
                  {availableStaff.map(staffMember => (
                    <option key={staffMember.id} value={staffMember.id}>
                      {staffMember.name} - {staffMember.skills?.join(', ') || 'No skills listed'}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAssignStaff}
                  disabled={!selectedStaffId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Assign
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
            {onShiftEdit && (
              <button
                onClick={() => onShiftEdit(shift)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Edit Shift Details
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ShiftDetailPopover