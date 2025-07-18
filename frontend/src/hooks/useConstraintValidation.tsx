import { useState, useCallback, useEffect } from 'react'
import { toast } from 'react-hot-toast'

export interface ConstraintViolation {
  constraint_id: number | null
  constraint_type: string
  violation_type: string
  severity: 'error' | 'warning'
  message: string
  affected_staff_id?: number
  affected_shift_id?: number
  suggested_resolution?: string
}

export interface ValidationResult {
  valid: boolean
  confidence_score?: number
  errors: string[]
  warnings: string[]
  suggestions: string[]
  constraint_scores?: Record<string, number>
}

export interface ConstraintValidationResponse {
  valid: boolean
  violations: ConstraintViolation[]
  warnings: ConstraintViolation[]
  total_violations: number
  total_warnings: number
}

export interface ViolationsSummary {
  total_violations: number
  total_warnings: number
  by_type: Record<string, number>
  by_severity: Record<string, number>
  affected_staff: number[]
  critical_issues: Array<{
    type: string
    message: string
    staff_id?: number
    shift_id?: number
  }>
}

export const useConstraintValidation = (businessId: number) => {
  const [isValidating, setIsValidating] = useState(false)
  const [violations, setViolations] = useState<ConstraintViolation[]>([])
  const [warnings, setWarnings] = useState<ConstraintViolation[]>([])
  const [validationSummary, setValidationSummary] = useState<ViolationsSummary | null>(null)

  // Validate a set of assignments
  const validateAssignments = useCallback(async (
    assignments: Array<{ shift_id: number; staff_id: number }>,
    draftId?: string
  ): Promise<ConstraintValidationResponse> => {
    setIsValidating(true)
    
    try {
      const response = await fetch('/api/constraints/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          business_id: businessId,
          draft_id: draftId,
          assignments
        })
      })

      if (!response.ok) {
        throw new Error('Validation request failed')
      }

      const result: ConstraintValidationResponse = await response.json()
      
      setViolations(result.violations)
      setWarnings(result.warnings)
      
      return result
    } catch (error) {
      console.error('Constraint validation failed:', error)
      toast.error('Failed to validate constraints')
      throw error
    } finally {
      setIsValidating(false)
    }
  }, [businessId])

  // Real-time validation for single assignment
  const validateSingleAssignment = useCallback(async (
    shiftId: number,
    staffId: number,
    existingAssignments?: Array<{ shift_id: number; staff_id: number }>
  ): Promise<ValidationResult> => {
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
          existing_assignments: existingAssignments || []
        })
      })

      if (!response.ok) {
        throw new Error('Real-time validation failed')
      }

      const result: ValidationResult = await response.json()
      return result
    } catch (error) {
      console.error('Real-time validation failed:', error)
      return {
        valid: false,
        errors: ['Validation service unavailable'],
        warnings: [],
        suggestions: []
      }
    }
  }, [businessId])

  // Get violations summary
  const getViolationsSummary = useCallback(async (
    assignments: Array<{ shift_id: number; staff_id: number }>
  ): Promise<ViolationsSummary> => {
    try {
      const response = await fetch(`/api/constraints/violations-summary/${businessId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assignments })
      })

      if (!response.ok) {
        throw new Error('Failed to get violations summary')
      }

      const summary: ViolationsSummary = await response.json()
      setValidationSummary(summary)
      return summary
    } catch (error) {
      console.error('Failed to get violations summary:', error)
      throw error
    }
  }, [businessId])

  // Clear validation state
  const clearValidation = useCallback(() => {
    setViolations([])
    setWarnings([])
    setValidationSummary(null)
  }, [])

  // Get constraint type display name
  const getConstraintTypeLabel = useCallback((type: string): string => {
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
  }, [])

  // Get severity color
  const getSeverityColor = useCallback((severity: string): string => {
    switch (severity) {
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'warning':
        return 'text-amber-600 bg-amber-50 border-amber-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }, [])

  // Get severity icon
  const getSeverityIcon = useCallback((severity: string): string => {
    switch (severity) {
      case 'error':
        return '⚠️'
      case 'warning':
        return '⚡'
      default:
        return 'ℹ️'
    }
  }, [])

  return {
    // State
    isValidating,
    violations,
    warnings,
    validationSummary,
    
    // Actions
    validateAssignments,
    validateSingleAssignment,
    getViolationsSummary,
    clearValidation,
    
    // Helpers
    getConstraintTypeLabel,
    getSeverityColor,
    getSeverityIcon,
    
    // Computed
    hasViolations: violations.length > 0,
    hasWarnings: warnings.length > 0,
    hasIssues: violations.length > 0 || warnings.length > 0,
    criticalIssuesCount: violations.filter(v => v.severity === 'error').length,
    warningCount: warnings.length + violations.filter(v => v.severity === 'warning').length
  }
}

export default useConstraintValidation