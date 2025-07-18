import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ConstraintViolationsPanel from '../ConstraintViolationsPanel'
import { ConstraintViolation } from '../../hooks/useConstraintValidation'

describe('ConstraintViolationsPanel', () => {
  const mockViolations: ConstraintViolation[] = [
    {
      constraint_id: 1,
      constraint_type: 'skill_match',
      violation_type: 'skill_mismatch',
      severity: 'error',
      message: 'Staff lacks required skill: kitchen',
      affected_staff_id: 1,
      affected_shift_id: 1,
      suggested_resolution: 'Assign staff member with required skill or provide training'
    }
  ]

  const mockWarnings: ConstraintViolation[] = [
    {
      constraint_id: 2,
      constraint_type: 'availability',
      violation_type: 'partial_availability',
      severity: 'warning',
      message: 'Staff has limited availability during shift time',
      affected_staff_id: 2,
      affected_shift_id: 2,
      suggested_resolution: 'Check staff availability or adjust shift time'
    }
  ]

  const mockSummary = {
    total_violations: 1,
    total_warnings: 1,
    by_type: {
      'skill_match': 1,
      'availability': 1
    },
    by_severity: {
      'error': 1,
      'warning': 1
    },
    affected_staff: [1, 2],
    critical_issues: [
      {
        type: 'skill_match',
        message: 'Staff lacks required skill: kitchen',
        staff_id: 1,
        shift_id: 1
      }
    ]
  }

  it('renders violations and warnings correctly', () => {
    render(
      <ConstraintViolationsPanel
        violations={mockViolations}
        warnings={mockWarnings}
        summary={mockSummary}
      />
    )

    expect(screen.getByText('Constraint Violations')).toBeInTheDocument()
    expect(screen.getByText('1 Error')).toBeInTheDocument()
    expect(screen.getByText('1 Warning')).toBeInTheDocument()
    expect(screen.getByText('Staff lacks required skill: kitchen')).toBeInTheDocument()
    expect(screen.getByText('Staff has limited availability during shift time')).toBeInTheDocument()
  })

  it('displays summary information correctly', () => {
    render(
      <ConstraintViolationsPanel
        violations={mockViolations}
        warnings={mockWarnings}
        summary={mockSummary}
      />
    )

    expect(screen.getByText('Total Issues:')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Critical:')).toBeInTheDocument()
    expect(screen.getByText('Affected Staff:')).toBeInTheDocument()
  })

  it('expands and collapses sections correctly', () => {
    render(
      <ConstraintViolationsPanel
        violations={mockViolations}
        warnings={mockWarnings}
        summary={mockSummary}
      />
    )

    const errorsSection = screen.getByText('Critical Issues (1)')
    fireEvent.click(errorsSection)

    // Should show violation details
    expect(screen.getByText('Skill Match')).toBeInTheDocument()
  })

  it('shows suggested resolutions when expanded', () => {
    render(
      <ConstraintViolationsPanel
        violations={mockViolations}
        warnings={mockWarnings}
        summary={mockSummary}
      />
    )

    // Click to expand the violation
    const violationCard = screen.getByText('Staff lacks required skill: kitchen')
    fireEvent.click(violationCard.closest('div')!)

    expect(screen.getByText('Suggested Resolution:')).toBeInTheDocument()
    expect(screen.getByText('Assign staff member with required skill or provide training')).toBeInTheDocument()
  })

  it('calls onDismiss when dismiss button is clicked', () => {
    const mockOnDismiss = jest.fn()
    
    render(
      <ConstraintViolationsPanel
        violations={mockViolations}
        warnings={mockWarnings}
        summary={mockSummary}
        onDismiss={mockOnDismiss}
      />
    )

    const dismissButton = screen.getByLabelText('Dismiss violations panel')
    fireEvent.click(dismissButton)

    expect(mockOnDismiss).toHaveBeenCalledTimes(1)
  })

  it('calls onResolveViolation when resolve button is clicked', () => {
    const mockOnResolveViolation = jest.fn()
    
    render(
      <ConstraintViolationsPanel
        violations={mockViolations}
        warnings={mockWarnings}
        summary={mockSummary}
        onResolveViolation={mockOnResolveViolation}
      />
    )

    const resolveButton = screen.getByText('Resolve')
    fireEvent.click(resolveButton)

    expect(mockOnResolveViolation).toHaveBeenCalledWith(mockViolations[0])
  })

  it('does not render when no violations or warnings', () => {
    const { container } = render(
      <ConstraintViolationsPanel
        violations={[]}
        warnings={[]}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('displays constraint type labels correctly', () => {
    const violationsWithDifferentTypes: ConstraintViolation[] = [
      {
        constraint_id: 1,
        constraint_type: 'max_hours_per_week',
        violation_type: 'hours_exceeded',
        severity: 'error',
        message: 'Exceeds weekly hour limit',
        suggested_resolution: 'Reduce hours'
      },
      {
        constraint_id: 2,
        constraint_type: 'min_rest_between_shifts',
        violation_type: 'insufficient_rest',
        severity: 'warning',
        message: 'Insufficient rest between shifts',
        suggested_resolution: 'Increase rest period'
      }
    ]

    render(
      <ConstraintViolationsPanel
        violations={violationsWithDifferentTypes}
        warnings={[]}
      />
    )

    expect(screen.getByText('Weekly Hour Limit')).toBeInTheDocument()
    expect(screen.getByText('Rest Between Shifts')).toBeInTheDocument()
  })
})