import React, { useState, useEffect } from 'react'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import { ValidationResult } from '../hooks/useConstraintValidation'

interface AssignmentValidationIndicatorProps {
  shiftId: number
  staffId: number
  businessId: number
  existingAssignments?: Array<{ shift_id: number; staff_id: number }>
  onValidationChange?: (result: ValidationResult) => void
  showDetails?: boolean
  className?: string
}

const AssignmentValidationIndicator: React.FC<AssignmentValidationIndicatorProps> = ({
  shiftId,
  staffId,
  businessId,
  existingAssignments = [],
  onValidationChange,
  showDetails = false,
  className = ''
}) => {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    if (shiftId && staffId && businessId) {
      validateAssignment()
    }
  }, [shiftId, staffId, businessId, existingAssignments])

  const validateAssignment = async () => {
    setIsValidating(true)
    
    try {
      const response = await fetch('/api/constraints/validate-assignment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shift_id: shiftId,
          staff_id: staffId,
          business_id: businessId,
          existing_assignments: existingAssignments
        })
      })

      if (!response.ok) {
        throw new Error('Validation failed')
      }

      const result: ValidationResult = await response.json()
      setValidationResult(result)
      
      if (onValidationChange) {
        onValidationChange(result)
      }
    } catch (error) {
      console.error('Assignment validation failed:', error)
      setValidationResult({
        valid: false,
        errors: ['Validation service unavailable'],
        warnings: [],
        suggestions: []
      })
    } finally {
      setIsValidating(false)
    }
  }

  const getIndicatorIcon = () => {
    if (isValidating) {
      return <SparklesIcon className="h-4 w-4 text-blue-500 animate-pulse" />
    }

    if (!validationResult) {
      return <InformationCircleIcon className="h-4 w-4 text-gray-400" />
    }

    if (validationResult.errors.length > 0) {
      return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
    }

    if (validationResult.warnings.length > 0) {
      return <ExclamationCircleIcon className="h-4 w-4 text-amber-500" />
    }

    return <CheckCircleIcon className="h-4 w-4 text-green-500" />
  }

  const getIndicatorColor = () => {
    if (isValidating) {
      return 'border-blue-200 bg-blue-50'
    }

    if (!validationResult) {
      return 'border-gray-200 bg-gray-50'
    }

    if (validationResult.errors.length > 0) {
      return 'border-red-200 bg-red-50'
    }

    if (validationResult.warnings.length > 0) {
      return 'border-amber-200 bg-amber-50'
    }

    return 'border-green-200 bg-green-50'
  }

  const getConfidenceBar = () => {
    if (!validationResult?.confidence_score) {
      return null
    }

    const score = validationResult.confidence_score
    const percentage = Math.round(score * 100)
    
    let colorClass = 'bg-green-500'
    if (score < 0.5) {
      colorClass = 'bg-red-500'
    } else if (score < 0.7) {
      colorClass = 'bg-amber-500'
    }

    return (
      <div className="mt-2">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>Confidence</span>
          <span>{percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${colorClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    )
  }

  const getTooltipContent = () => {
    if (!validationResult) {
      return 'Validation pending...'
    }

    const parts = []
    
    if (validationResult.errors.length > 0) {
      parts.push(`${validationResult.errors.length} error${validationResult.errors.length !== 1 ? 's' : ''}`)
    }
    
    if (validationResult.warnings.length > 0) {
      parts.push(`${validationResult.warnings.length} warning${validationResult.warnings.length !== 1 ? 's' : ''}`)
    }
    
    if (validationResult.suggestions.length > 0) {
      parts.push(`${validationResult.suggestions.length} suggestion${validationResult.suggestions.length !== 1 ? 's' : ''}`)
    }

    if (parts.length === 0) {
      return 'Assignment looks good!'
    }

    return parts.join(', ')
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className={`inline-flex items-center px-2 py-1 rounded-md border transition-colors ${getIndicatorColor()}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {getIndicatorIcon()}
        {showDetails && validationResult && (
          <div className="ml-2 text-xs">
            {validationResult.errors.length > 0 && (
              <span className="text-red-600 font-medium">
                {validationResult.errors.length} error{validationResult.errors.length !== 1 ? 's' : ''}
              </span>
            )}
            {validationResult.warnings.length > 0 && (
              <span className={`text-amber-600 font-medium ${validationResult.errors.length > 0 ? 'ml-2' : ''}`}>
                {validationResult.warnings.length} warning{validationResult.warnings.length !== 1 ? 's' : ''}
              </span>
            )}
            {validationResult.errors.length === 0 && validationResult.warnings.length === 0 && (
              <span className="text-green-600 font-medium">Valid</span>
            )}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-md shadow-lg whitespace-nowrap">
          {getTooltipContent()}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}

      {/* Detailed validation info */}
      {showDetails && validationResult && (
        <div className="mt-2 space-y-2">
          {/* Confidence score */}
          {getConfidenceBar()}

          {/* Errors */}
          {validationResult.errors.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-red-700 mb-1">Errors:</h4>
              <ul className="text-xs text-red-600 space-y-1">
                {validationResult.errors.map((error, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-1">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {validationResult.warnings.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-amber-700 mb-1">Warnings:</h4>
              <ul className="text-xs text-amber-600 space-y-1">
                {validationResult.warnings.map((warning, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-1">•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {validationResult.suggestions.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-blue-700 mb-1">Suggestions:</h4>
              <ul className="text-xs text-blue-600 space-y-1">
                {validationResult.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-1">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Constraint scores */}
          {validationResult.constraint_scores && Object.keys(validationResult.constraint_scores).length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-700 mb-1">Constraint Scores:</h4>
              <div className="space-y-1">
                {Object.entries(validationResult.constraint_scores).map(([constraint, score]) => (
                  <div key={constraint} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 capitalize">
                      {constraint.replace('_', ' ')}:
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="w-12 bg-gray-200 rounded-full h-1">
                        <div
                          className={`h-1 rounded-full ${
                            score >= 0.8 ? 'bg-green-500' : 
                            score >= 0.6 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.round(score * 100)}%` }}
                        />
                      </div>
                      <span className="text-gray-500 w-8 text-right">
                        {Math.round(score * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AssignmentValidationIndicator