import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import BusinessConstraintsModal from '../BusinessConstraintsModal'

// Mock fetch
global.fetch = vi.fn()

const mockConstraints = [
  {
    id: 1,
    business_id: 1,
    constraint_type: 'max_hours_per_week',
    constraint_value: { hours: 40 },
    priority: 'high',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    business_id: 1,
    constraint_type: 'min_rest_between_shifts',
    constraint_value: { hours: 8 },
    priority: 'medium',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 3,
    business_id: 1,
    constraint_type: 'skill_match_required',
    constraint_value: { required: true },
    priority: 'critical',
    is_active: false,
    created_at: '2024-01-01T00:00:00Z'
  }
]

describe('BusinessConstraintsModal', () => {
  const mockOnClose = vi.fn()
  const businessId = 1

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock successful API responses
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockConstraints
    })
  })

  it('renders modal with title', async () => {
    render(
      <BusinessConstraintsModal
        businessId={businessId}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('Business Scheduling Constraints')).toBeInTheDocument()
    expect(screen.getByText('Configure rules for automatic scheduling')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    render(
      <BusinessConstraintsModal
        businessId={businessId}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('Loading constraints...')).toBeInTheDocument()
  })

  it('loads and displays constraints', async () => {
    render(
      <BusinessConstraintsModal
        businessId={businessId}
        onClose={mockOnClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Active Constraints')).toBeInTheDocument()
    })

    // Should display constraint types
    expect(screen.getByText('Maximum Hours per Week')).toBeInTheDocument()
    expect(screen.getByText('Minimum Rest Between Shifts')).toBeInTheDocument()
    expect(screen.getByText('Skill Match Requirement')).toBeInTheDocument()

    // Should display constraint values
    expect(screen.getByText('40 hours per week')).toBeInTheDocument()
    expect(screen.getByText('8 hours minimum rest')).toBeInTheDocument()
    expect(screen.getByText('Required')).toBeInTheDocument()

    // Should display priority badges
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('medium')).toBeInTheDocument()
    expect(screen.getByText('critical')).toBeInTheDocument()
  })

  it('handles API error gracefully', async () => {
    ;(fetch as any).mockRejectedValue(new Error('API Error'))

    render(
      <BusinessConstraintsModal
        businessId={businessId}
        onClose={mockOnClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Failed to load business constraints')).toBeInTheDocument()
    })
  })

  it('shows empty state when no constraints exist', async () => {
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => []
    })

    render(
      <BusinessConstraintsModal
        businessId={businessId}
        onClose={mockOnClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('No scheduling constraints configured')).toBeInTheDocument()
      expect(screen.getByText('Add constraints to improve automatic scheduling')).toBeInTheDocument()
    })
  })

  it('allows adding new constraint', async () => {
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 4, ...mockConstraints[0] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 4, ...mockConstraints[0] }]
      })

    render(
      <BusinessConstraintsModal
        businessId={businessId}
        onClose={mockOnClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Add Constraint')).toBeInTheDocument()
    })

    // Click add constraint button
    fireEvent.click(screen.getByText('Add Constraint'))

    // Should show constraint form
    expect(screen.getByText('Add New Constraint')).toBeInTheDocument()

    // Fill in constraint form (default is max_hours_per_week)
    const hoursInput = screen.getByLabelText('Maximum Hours per Week')
    fireEvent.change(hoursInput, { target: { value: '45' } })

    const prioritySelect = screen.getByDisplayValue('Medium - Important rule')
    fireEvent.change(prioritySelect, { target: { value: 'high' } })

    // Submit form
    const addButton = screen.getByText('Add Constraint')
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/business/1/constraints',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_id: 1,
            constraint_type: 'max_hours_per_week',
            constraint_value: { hours: 45 },
            priority: 'high'
          })
        })
      )
    })
  })

  it('allows updating constraint priority', async () => {
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConstraints
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockConstraints[0], priority: 'critical' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConstraints
      })

    render(
      <BusinessConstraintsModal
        businessId={businessId}
        onClose={mockOnClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Maximum Hours per Week')).toBeInTheDocument()
    })

    // Find and change priority select
    const prioritySelects = screen.getAllByDisplayValue('High')
    fireEvent.change(prioritySelects[0], { target: { value: 'critical' } })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/business/1/constraints/1',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priority: 'critical' })
        })
      )
    })
  })

  it('allows toggling constraint active status', async () => {
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConstraints
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockConstraints[2], is_active: true })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConstraints
      })

    render(
      <BusinessConstraintsModal
        businessId={businessId}
        onClose={mockOnClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Skill Match Requirement')).toBeInTheDocument()
    })

    // Find and toggle active checkbox for inactive constraint
    const activeCheckboxes = screen.getAllByRole('checkbox')
    const inactiveCheckbox = activeCheckboxes.find(checkbox => !checkbox.checked)
    
    if (inactiveCheckbox) {
      fireEvent.click(inactiveCheckbox)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/business/1/constraints/3',
          expect.objectContaining({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: true })
          })
        )
      })
    }
  })

  it('allows deleting constraints', async () => {
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConstraints
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConstraints.slice(1)
      })

    render(
      <BusinessConstraintsModal
        businessId={businessId}
        onClose={mockOnClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Maximum Hours per Week')).toBeInTheDocument()
    })

    // Click delete button for first constraint
    const deleteButtons = screen.getAllByRole('button')
    const deleteButton = deleteButtons.find(btn => 
      btn.querySelector('svg') && btn.className.includes('text-red-600')
    )
    
    if (deleteButton) {
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/business/1/constraints/1',
          expect.objectContaining({
            method: 'DELETE'
          })
        )
      })
    }
  })

  it('renders different constraint types correctly', async () => {
    render(
      <BusinessConstraintsModal
        businessId={businessId}
        onClose={mockOnClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Add Constraint')).toBeInTheDocument()
    })

    // Click add constraint to show form
    fireEvent.click(screen.getByText('Add Constraint'))

    // Test different constraint types
    const constraintTypeSelect = screen.getByDisplayValue('Maximum Hours per Week')

    // Test min rest constraint
    fireEvent.change(constraintTypeSelect, { target: { value: 'min_rest_between_shifts' } })
    expect(screen.getByLabelText('Minimum Rest Hours Between Shifts')).toBeInTheDocument()

    // Test skill match constraint
    fireEvent.change(constraintTypeSelect, { target: { value: 'skill_match_required' } })
    expect(screen.getByLabelText('Skill Matching')).toBeInTheDocument()

    // Test fair distribution constraint
    fireEvent.change(constraintTypeSelect, { target: { value: 'fair_distribution' } })
    expect(screen.getByText('Enable fair distribution of shifts among staff')).toBeInTheDocument()
  })

  it('validates constraint form inputs', async () => {
    render(
      <BusinessConstraintsModal
        businessId={businessId}
        onClose={mockOnClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Add Constraint')).toBeInTheDocument()
    })

    // Click add constraint
    fireEvent.click(screen.getByText('Add Constraint'))

    // Try to submit with invalid hours (should use default)
    const hoursInput = screen.getByLabelText('Maximum Hours per Week')
    fireEvent.change(hoursInput, { target: { value: '' } })

    const addButton = screen.getByText('Add Constraint')
    fireEvent.click(addButton)

    // Should still make API call with default value
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/business/1/constraints',
        expect.objectContaining({
          method: 'POST'
        })
      )
    })
  })

  it('closes modal when close button is clicked', () => {
    render(
      <BusinessConstraintsModal
        businessId={businessId}
        onClose={mockOnClose}
      />
    )

    const closeButton = screen.getByText('Close')
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('cancels constraint form', async () => {
    render(
      <BusinessConstraintsModal
        businessId={businessId}
        onClose={mockOnClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Add Constraint')).toBeInTheDocument()
    })

    // Click add constraint to show form
    fireEvent.click(screen.getByText('Add Constraint'))
    expect(screen.getByText('Add New Constraint')).toBeInTheDocument()

    // Click cancel
    fireEvent.click(screen.getByText('Cancel'))

    // Form should be hidden
    expect(screen.queryByText('Add New Constraint')).not.toBeInTheDocument()
  })

  it('displays info box about constraints', async () => {
    render(
      <BusinessConstraintsModal
        businessId={businessId}
        onClose={mockOnClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('About Scheduling Constraints')).toBeInTheDocument()
    })

    expect(screen.getByText(/These constraints help ensure fair, legal, and efficient scheduling/)).toBeInTheDocument()
  })
})