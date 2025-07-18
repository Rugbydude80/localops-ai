import React, { useState } from 'react'
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { ConstraintViolation, ViolationsSummary } from '../hooks/useConstraintValidation'

interface ConstraintViolationsPanelProps {
  violations: ConstraintViolation[]
  warnings: ConstraintViolation[]
  summary?: ViolationsSummary | null
  onDismiss?: () => void
  onResolveViolation?: (violation: ConstraintViolation) => void
  className?: string
}

const ConstraintViolationsPanel: React.FC<ConstraintViolationsPanelProps> = ({
  violations,
  warnings,
  summary,
  onDismiss,
  onResolveViolation,
  className = ''
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['errors']))
  const [expandedViolations, setExpandedViolations] = useState<Set<number>>(new Set())

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const toggleViolation = (index: number) => {
    const newExpanded = new Set(expandedViolations)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedViolations(newExpanded)
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
      case 'warning':
        return <ExclamationCircleIcon className="h-5 w-5 text-amber-500" />
      default:
        return <InformationCircleIcon className="h-5 w-5 text-blue-500" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'border-red-200 bg-red-50'
      case 'warning':
        return 'border-amber-200 bg-amber-50'
      default:
        return 'border-blue-200 bg-blue-50'
    }
  }

  const getConstraintTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'skill_match': 'Skill Match',
      'availability': 'Staff Availability',
      'max_hours': 'Maximum Hours',
      'min_rest': 'Minimum Rest',
      'fair_distribution': 'Fair Distribution',
      'labor_cost': 'Labor Cost',
      'max_hours_per_week': 'Weekly Hour Limit',
      'min_rest_between_shifts': 'Rest Between Shifts',
      'max_consecutive_days': 'Consecutive Days',
      'skill_match_required': 'Required Skills',
      'data_integrity': 'Data Integrity',
      'confidence': 'Assignment Confidence'
    }
    return labels[type] || type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  if (violations.length === 0 && warnings.length === 0) {
    return null
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            {violations.length > 0 && (
              <div className="flex items-center space-x-1">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                <span className="text-sm font-medium text-red-700">
                  {violations.length} Error{violations.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="flex items-center space-x-1">
                <ExclamationCircleIcon className="h-5 w-5 text-amber-500" />
                <span className="text-sm font-medium text-amber-700">
                  {warnings.length} Warning{warnings.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
          <h3 className="text-lg font-medium text-gray-900">
            Constraint Violations
          </h3>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Dismiss violations panel"
          >
            <XMarkIcon className="h-5 w-5 text-gray-400" />
          </button>
        )}
      </div>

      {/* Summary */}
      {summary && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Total Issues:</span>
              <span className="ml-1 font-medium">
                {summary.total_violations + summary.total_warnings}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Critical:</span>
              <span className="ml-1 font-medium text-red-600">
                {summary.by_severity.error || 0}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Warnings:</span>
              <span className="ml-1 font-medium text-amber-600">
                {summary.by_severity.warning || 0}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Affected Staff:</span>
              <span className="ml-1 font-medium">
                {summary.affected_staff.length}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="max-h-96 overflow-y-auto">
        {/* Critical Errors */}
        {violations.length > 0 && (
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleSection('errors')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                <span className="font-medium text-gray-900">
                  Critical Issues ({violations.length})
                </span>
              </div>
              {expandedSections.has('errors') ? (
                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronRightIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>
            
            {expandedSections.has('errors') && (
              <div className="pb-4">
                {violations.map((violation, index) => (
                  <div
                    key={index}
                    className={`mx-4 mb-3 border rounded-lg ${getSeverityColor(violation.severity)}`}
                  >
                    <div
                      className="p-3 cursor-pointer"
                      onClick={() => toggleViolation(index)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          {getSeverityIcon(violation.severity)}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                                {getConstraintTypeLabel(violation.constraint_type)}
                              </span>
                              <span className="text-xs text-gray-500">
                                {violation.violation_type.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900 font-medium">
                              {violation.message}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {onResolveViolation && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onResolveViolation(violation)
                              }}
                              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                              Resolve
                            </button>
                          )}
                          {expandedViolations.has(index) ? (
                            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {expandedViolations.has(index) && violation.suggested_resolution && (
                      <div className="px-3 pb-3 border-t border-gray-200 bg-white bg-opacity-50">
                        <div className="pt-3">
                          <p className="text-xs font-medium text-gray-700 mb-1">
                            Suggested Resolution:
                          </p>
                          <p className="text-xs text-gray-600">
                            {violation.suggested_resolution}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('warnings')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <ExclamationCircleIcon className="h-5 w-5 text-amber-500" />
                <span className="font-medium text-gray-900">
                  Warnings ({warnings.length})
                </span>
              </div>
              {expandedSections.has('warnings') ? (
                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronRightIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>
            
            {expandedSections.has('warnings') && (
              <div className="pb-4">
                {warnings.map((warning, index) => (
                  <div
                    key={index}
                    className={`mx-4 mb-3 border rounded-lg ${getSeverityColor(warning.severity)}`}
                  >
                    <div className="p-3">
                      <div className="flex items-start space-x-3">
                        {getSeverityIcon(warning.severity)}
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                              {getConstraintTypeLabel(warning.constraint_type)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {warning.violation_type.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900">
                            {warning.message}
                          </p>
                          {warning.suggested_resolution && (
                            <p className="text-xs text-gray-600 mt-2">
                              <span className="font-medium">Suggestion:</span> {warning.suggested_resolution}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ConstraintViolationsPanel