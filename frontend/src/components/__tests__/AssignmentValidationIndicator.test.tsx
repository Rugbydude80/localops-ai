import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import AssignmentValidationIndicator from '../AssignmentValidationIndicator'

// Mock fetch
global.fetch = jest.fn()

describe('AssignmentValidationIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows loading state initially', () => {
    ;(fetch as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    )

    render(
      <AssignmentValidationIndicator
        shiftId={1}
        staffId={1}
        businessId={1}
      />
    )

    // Should show loading indicator
    const loadingIcon = document.querySelector('.animate-pulse')
    expect(loadingIcon).toBeInTheDocument()
  })

  it('shows success indicator for valid assignment', async () => {
    const mockValidationResult = {
      valid: true,
      confidence_score: 0.9,
      errors: [],
      warnings: [],
      suggestions: []
    }

    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidationResult
    })

    render(
      <AssignmentValidationIndicator
        shiftId={1}
        staffId={1}
        businessId={1}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('check-circle-icon') || document.querySelector('[data-testid="check-circle-icon"]')).toBeInTheDocument()
    })
  })

  it('shows error indicator for invalid assignment', async () => {
    const mockValidationResult = {
      valid: false,
      confidence_score: 0.2,
      errors: ['Staff lacks required skill'],
      warnings: [],
      suggestions: []
    }

    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidationResult
    })

    render(
      <AssignmentValidationIndicator
        shiftId={1}
        staffId={1}
        businessId={1}
      />
    )

    await waitFor(() => {
      // Should show error indicator with red styling
      const indicator = document.querySelector('.border-red-200')
      expect(indicator).toBeInTheDocument()
    })
  })

  it('shows warning indicator for assignment with warnings', async () => {
    const mockValidationResult = {
      valid: true,
      confidence_score: 0.6,
      errors: [],
      warnings: ['Limited availability'],
      suggestions: []
    }

    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidationResult
    })

    render(
      <AssignmentValidationIndicator
        shiftId={1}
        staffId={1}
        businessId={1}
      />
    )

    await waitFor(() => {
      // Should show warning indicator with amber styling
      const indicator = document.querySelector('.border-amber-200')
      expect(indicator).toBeInTheDocument()
    })
  })

  it('displays detailed validation info when showDetails is true', async () => {
    const mockValidationResult = {
      valid: false,
      confidence_score: 0.4,
      errors: ['Staff lacks required skill'],
      warnings: ['Limited availability'],
      suggestions: ['Consider alternative staff'],
      constraint_scores: {
        skill_match: 0.0,
        availability: 0.6,
        max_hours: 0.8
      }
    }

    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidationResult
    })

    render(
      <AssignmentValidationIndicator
        shiftId={1}
        staffId={1}
        businessId={1}
        showDetails={true}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('1 error')).toBeInTheDocument()
      expect(screen.getByText('1 warning')).toBeInTheDocument()
      expect(screen.getByText('Errors:')).toBeInTheDocument()
      expect(screen.getByText('Staff lacks required skill')).toBeInTheDocument()
      expect(screen.getByText('Warnings:')).toBeInTheDocument()
      expect(screen.getByText('Limited availability')).toBeInTheDocument()
      expect(screen.getByText('Suggestions:')).toBeInTheDocument()
      expect(screen.getByText('Consider alternative staff')).toBeInTheDocument()
    })
  })

  it('displays confidence score bar', async () => {
    const mockValidationResult = {
      valid: true,
      confidence_score: 0.75,
      errors: [],
      warnings: [],
      suggestions: []
    }

    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidationResult
    })

    render(
      <AssignmentValidationIndicator
        shiftId={1}
        staffId={1}
        businessId={1}
        showDetails={true}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Confidence')).toBeInTheDocument()
      expect(screen.getByText('75%')).toBeInTheDocument()
    })
  })

  it('displays constraint scores when available', async () => {
    const mockValidationResult = {
      valid: true,
      confidence_score: 0.8,
      errors: [],
      warnings: [],
      suggestions: [],
      constraint_scores: {
        skill_match: 1.0,
        availability: 0.8,
        max_hours: 0.6
      }
    }

    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidationResult
    })

    render(
      <AssignmentValidationIndicator
        shiftId={1}
        staffId={1}
        businessId={1}
        showDetails={true}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Constraint Scores:')).toBeInTheDocument()
      expect(screen.getByText('Skill match:')).toBeInTheDocument()
      expect(screen.getByText('100%')).toBeInTheDocument()
      expect(screen.getByText('80%')).toBeInTheDocument()
      expect(screen.getByText('60%')).toBeInTheDocument()
    })
  })

  it('calls onValidationChange when validation completes', async () => {
    const mockValidationResult = {
      valid: true,
      confidence_score: 0.9,
      errors: [],
      warnings: [],
      suggestions: []
    }

    const mockOnValidationChange = jest.fn()

    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidationResult
    })

    render(
      <AssignmentValidationIndicator
        shiftId={1}
        staffId={1}
        businessId={1}
        onValidationChange={mockOnValidationChange}
      />
    )

    await waitFor(() => {
      expect(mockOnValidationChange).toHaveBeenCalledWith(mockValidationResult)
    })
  })

  it('handles validation service errors gracefully', async () => {
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Service unavailable'))

    render(
      <AssignmentValidationIndicator
        shiftId={1}
        staffId={1}
        businessId={1}
        showDetails={true}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Validation service unavailable')).toBeInTheDocument()
    })
  })

  it('re-validates when props change', async () => {
    const mockValidationResult = {
      valid: true,
      confidence_score: 0.9,
      errors: [],
      warnings: [],
      suggestions: []
    }

    ;(fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockValidationResult
    })

    const { rerender } = render(
      <AssignmentValidationIndicator
        shiftId={1}
        staffId={1}
        businessId={1}
      />
    )

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    // Change staff ID
    rerender(
      <AssignmentValidationIndicator
        shiftId={1}
        staffId={2}
        businessId={1}
      />
    )

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2)
    })
  })
})