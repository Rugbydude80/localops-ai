import { useState, useEffect } from 'react'
import {
  XMarkIcon,
  CogIcon,
  PlusIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'

interface SchedulingConstraint {
  id: number
  business_id: number
  constraint_type: string
  constraint_value: any
  priority: string
  is_active: boolean
  created_at: string
}

interface BusinessConstraintsModalProps {
  businessId: number
  onClose: () => void
}

export default function BusinessConstraintsModal({ businessId, onClose }: BusinessConstraintsModalProps) {
  const [constraints, setConstraints] = useState<SchedulingConstraint[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddConstraint, setShowAddConstraint] = useState(false)

  const [newConstraint, setNewConstraint] = useState({
    constraint_type: 'max_hours_per_week',
    constraint_value: {},
    priority: 'medium'
  })

  useEffect(() => {
    loadConstraints()
  }, [businessId])

  const loadConstraints = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/business/${businessId}/constraints`)
      if (!response.ok) throw new Error('Failed to load constraints')
      
      const data = await response.json()
      setConstraints(data)
    } catch (error) {
      console.error('Error loading constraints:', error)
      setError('Failed to load business constraints')
    } finally {
      setLoading(false)
    }
  }

  const handleAddConstraint = async () => {
    try {
      setSaving(true)
      
      const response = await fetch(`/api/business/${businessId}/constraints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          constraint_type: newConstraint.constraint_type,
          constraint_value: newConstraint.constraint_value,
          priority: newConstraint.priority
        })
      })
      
      if (!response.ok) throw new Error('Failed to create constraint')
      
      setNewConstraint({
        constraint_type: 'max_hours_per_week',
        constraint_value: {},
        priority: 'medium'
      })
      setShowAddConstraint(false)
      await loadConstraints()
    } catch (error) {
      console.error('Error adding constraint:', error)
      setError('Failed to add constraint')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateConstraint = async (constraintId: number, updates: any) => {
    try {
      const response = await fetch(`/api/business/${businessId}/constraints/${constraintId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      
      if (!response.ok) throw new Error('Failed to update constraint')
      await loadConstraints()
    } catch (error) {
      console.error('Error updating constraint:', error)
      setError('Failed to update constraint')
    }
  }

  const handleDeleteConstraint = async (constraintId: number) => {
    try {
      const response = await fetch(`/api/business/${businessId}/constraints/${constraintId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) throw new Error('Failed to delete constraint')
      await loadConstraints()
    } catch (error) {
      console.error('Error deleting constraint:', error)
      setError('Failed to delete constraint')
    }
  }

  const renderConstraintValue = (constraint: SchedulingConstraint) => {
    switch (constraint.constraint_type) {
      case 'max_hours_per_week':
        return `${constraint.constraint_value.hours || 40} hours per week`
      case 'min_rest_between_shifts':
        return `${constraint.constraint_value.hours || 8} hours minimum rest`
      case 'max_consecutive_days':
        return `${constraint.constraint_value.days || 5} consecutive days maximum`
      case 'skill_match_required':
        return constraint.constraint_value.required ? 'Required' : 'Preferred'
      case 'fair_distribution':
        return constraint.constraint_value.enabled ? 'Enabled' : 'Disabled'
      case 'min_staff_per_shift':
        return `${constraint.constraint_value.count || 2} staff minimum per shift`
      case 'max_overtime_hours':
        return `${constraint.constraint_value.hours || 8} overtime hours maximum per week`
      case 'weekend_rotation':
        return constraint.constraint_value.enabled 
          ? `Enabled (${constraint.constraint_value.rotation_weeks || 2} week rotation)` 
          : 'Disabled'
      default:
        return JSON.stringify(constraint.constraint_value)
    }
  }

  const renderConstraintForm = () => {
    switch (newConstraint.constraint_type) {
      case 'max_hours_per_week':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Hours per Week
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={newConstraint.constraint_value.hours || 40}
              onChange={(e) => setNewConstraint({
                ...newConstraint,
                constraint_value: { hours: parseInt(e.target.value) || 40 }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Legal maximum: 48 hours (UK Working Time Regulations)
            </p>
          </div>
        )
      
      case 'min_rest_between_shifts':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Rest Hours Between Shifts
            </label>
            <input
              type="number"
              min="1"
              max="24"
              value={newConstraint.constraint_value.hours || 8}
              onChange={(e) => setNewConstraint({
                ...newConstraint,
                constraint_value: { hours: parseInt(e.target.value) || 8 }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Recommended minimum: 8 hours
            </p>
          </div>
        )
      
      case 'max_consecutive_days':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Consecutive Working Days
            </label>
            <input
              type="number"
              min="1"
              max="14"
              value={newConstraint.constraint_value.days || 5}
              onChange={(e) => setNewConstraint({
                ...newConstraint,
                constraint_value: { days: parseInt(e.target.value) || 5 }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Legal maximum: 6 consecutive days in most jurisdictions
            </p>
          </div>
        )
      
      case 'skill_match_required':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Skill Matching
            </label>
            <select
              value={newConstraint.constraint_value.required ? 'required' : 'preferred'}
              onChange={(e) => setNewConstraint({
                ...newConstraint,
                constraint_value: { required: e.target.value === 'required' }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="required">Required - Staff must have exact skill match</option>
              <option value="preferred">Preferred - Allow close skill matches</option>
            </select>
          </div>
        )
      
      case 'fair_distribution':
        return (
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={newConstraint.constraint_value.enabled || false}
                onChange={(e) => setNewConstraint({
                  ...newConstraint,
                  constraint_value: { enabled: e.target.checked }
                })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Enable fair distribution of shifts among staff
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Ensures shifts are distributed evenly among qualified staff
            </p>
          </div>
        )
      
      case 'min_staff_per_shift':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Staff Members per Shift
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={newConstraint.constraint_value.count || 2}
              onChange={(e) => setNewConstraint({
                ...newConstraint,
                constraint_value: { count: parseInt(e.target.value) || 2 }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Ensures adequate coverage for each shift
            </p>
          </div>
        )
      
      case 'max_overtime_hours':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Overtime Hours per Week
            </label>
            <input
              type="number"
              min="0"
              max="20"
              value={newConstraint.constraint_value.hours || 8}
              onChange={(e) => setNewConstraint({
                ...newConstraint,
                constraint_value: { hours: parseInt(e.target.value) || 8 }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Controls overtime costs and staff wellbeing
            </p>
          </div>
        )
      
      case 'weekend_rotation':
        return (
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={newConstraint.constraint_value.enabled || false}
                onChange={(e) => setNewConstraint({
                  ...newConstraint,
                  constraint_value: { 
                    enabled: e.target.checked,
                    rotation_weeks: newConstraint.constraint_value.rotation_weeks || 2
                  }
                })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Enable weekend rotation among staff
              </span>
            </label>
            {newConstraint.constraint_value.enabled && (
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rotation Period (weeks)
                </label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={newConstraint.constraint_value.rotation_weeks || 2}
                  onChange={(e) => setNewConstraint({
                    ...newConstraint,
                    constraint_value: { 
                      enabled: true,
                      rotation_weeks: parseInt(e.target.value) || 2
                    }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Ensures fair distribution of weekend shifts
            </p>
          </div>
        )
      
      default:
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Constraint Value (JSON)
            </label>
            <textarea
              value={JSON.stringify(newConstraint.constraint_value, null, 2)}
              onChange={(e) => {
                try {
                  const value = JSON.parse(e.target.value)
                  setNewConstraint({ ...newConstraint, constraint_value: value })
                } catch (error) {
                  // Invalid JSON, ignore
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>
        )
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getConstraintTypeLabel = (type: string) => {
    switch (type) {
      case 'max_hours_per_week': return 'Maximum Hours per Week'
      case 'min_rest_between_shifts': return 'Minimum Rest Between Shifts'
      case 'max_consecutive_days': return 'Maximum Consecutive Days'
      case 'skill_match_required': return 'Skill Match Requirement'
      case 'fair_distribution': return 'Fair Distribution'
      case 'min_staff_per_shift': return 'Minimum Staff per Shift'
      case 'max_overtime_hours': return 'Maximum Overtime Hours'
      case 'weekend_rotation': return 'Weekend Rotation'
      default: return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Loading constraints...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Business Scheduling Constraints</h2>
            <p className="text-sm text-gray-600">Configure rules for automatic scheduling</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <XMarkIcon className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <InformationCircleIcon className="h-5 w-5 text-blue-400 mt-0.5 mr-2" />
              <div>
                <h3 className="text-sm font-medium text-blue-800">About Scheduling Constraints</h3>
                <p className="text-sm text-blue-700 mt-1">
                  These constraints help ensure fair, legal, and efficient scheduling. Higher priority constraints 
                  will be enforced more strictly during automatic scheduling.
                </p>
              </div>
            </div>
          </div>

          {/* Add Constraint Button */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Active Constraints</h3>
            <button
              onClick={() => setShowAddConstraint(true)}
              className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Constraint
            </button>
          </div>

          {/* Constraints List */}
          {constraints.length === 0 ? (
            <div className="text-center py-8">
              <CogIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No scheduling constraints configured</p>
              <p className="text-sm text-gray-400 mt-1">
                Add constraints to improve automatic scheduling
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {constraints.map((constraint) => (
                <div key={constraint.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-medium text-gray-900">
                          {getConstraintTypeLabel(constraint.constraint_type)}
                        </h4>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(constraint.priority)}`}>
                          {constraint.priority}
                        </span>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={constraint.is_active}
                            onChange={(e) => handleUpdateConstraint(constraint.id, { is_active: e.target.checked })}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-1 text-sm text-gray-600">Active</span>
                        </label>
                      </div>
                      <p className="text-sm text-gray-600">
                        {renderConstraintValue(constraint)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <select
                        value={constraint.priority}
                        onChange={(e) => handleUpdateConstraint(constraint.id, { priority: e.target.value })}
                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                      <button
                        onClick={() => handleDeleteConstraint(constraint.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Conflict Resolution Section */}
          {constraints.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 mt-0.5 mr-2" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-amber-800">Constraint Conflict Resolution</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    When constraints conflict during scheduling, the system will prioritize based on the priority levels you've set.
                  </p>
                  <div className="mt-3 text-xs text-amber-600">
                    <div className="grid grid-cols-2 gap-2">
                      <div><strong>Critical:</strong> Must be enforced - violations will prevent scheduling</div>
                      <div><strong>High:</strong> Strongly enforced - violations will generate warnings</div>
                      <div><strong>Medium:</strong> Balanced consideration - may be relaxed if needed</div>
                      <div><strong>Low:</strong> Soft preferences - will be considered but not enforced</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Add Constraint Form */}
          {showAddConstraint && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">Add New Constraint</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Constraint Type
                  </label>
                  <select
                    value={newConstraint.constraint_type}
                    onChange={(e) => setNewConstraint({
                      ...newConstraint,
                      constraint_type: e.target.value,
                      constraint_value: {}
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="max_hours_per_week">Maximum Hours per Week</option>
                    <option value="min_rest_between_shifts">Minimum Rest Between Shifts</option>
                    <option value="max_consecutive_days">Maximum Consecutive Days</option>
                    <option value="skill_match_required">Skill Match Requirement</option>
                    <option value="fair_distribution">Fair Distribution</option>
                    <option value="min_staff_per_shift">Minimum Staff per Shift</option>
                    <option value="max_overtime_hours">Maximum Overtime Hours</option>
                    <option value="weekend_rotation">Weekend Rotation</option>
                  </select>
                </div>

                {renderConstraintForm()}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={newConstraint.priority}
                    onChange={(e) => setNewConstraint({ ...newConstraint, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="low">Low - Soft preference</option>
                    <option value="medium">Medium - Important rule</option>
                    <option value="high">High - Strict enforcement</option>
                    <option value="critical">Critical - Must not violate</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAddConstraint(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddConstraint}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Adding...' : 'Add Constraint'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}