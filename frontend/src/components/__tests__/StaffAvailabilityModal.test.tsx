import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import StaffAvailabilityModal from '../StaffAvailabilityModal'

// Mock fetch
global.fetch = vi.fn()

const mockStaff = {
  id: 1,
  name: 'John Doe',
  business_id: 1,
  role: 'server',
  skills: ['server', 'host'],
  is_active: true
}

const mockPreferences = [
  {
    id: 1,
    staff_id: 1,
    staff_name: 'John Doe',
    preference_type: 'max_hours',
    preference_value: { hours: 35 },
    priority: 'high',
    effective_date: '2024-01-01',
    expiry_date: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    staff_id: 1,
    staff_name: 'John Doe',
    preference_type: 'availability',
    preference_value: {
      times: [
        {
          day_of_week: 0,
          start_time: '09:00',
          end_time: '17:00',
          preferred: true
        }
      ]
    },
    priority: 'medium',
    effective_date: null,
    expiry_date: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z'
  }
]

describe('StaffAvailabilityModal', () => {
  const mockOnClose = vi.fn()
  const mockOnUpdate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock successful API responses
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockPreferences
    })
  })

  it('renders modal with staff name', async () => {
    render(
      <StaffAvailabilityModal
        staff={mockStaff}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    expect(screen.getByText('Staff Preferences & Availability')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    render(
      <StaffAvailabilityModal
        staff={mockStaff}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    expect(screen.getByText('Loading preferences...')).toBeInTheDocument()
  })

  it('loads and displays staff preferences', async () => {
    render(
      <StaffAvailabilityModal
        staff={mockStaff}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Maximum Weekly Hours')).toBeInTheDocument()
    })

    // Should display max hours preference
    expect(screen.getByDisplayValue('35')).toBeInTheDocument()
  })

  it('handles API error gracefully', async () => {
    ;(fetch as any).mockRejectedValue(new Error('API Error'))

    render(
      <StaffAvailabilityModal
        staff={mockStaff}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Failed to load staff preferences')).toBeInTheDocument()
    })
  })

  it('allows updating maximum hours', async () => {
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPreferences
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockPreferences[0], preference_value: { hours: 40 } })
      })

    render(
      <StaffAvailabilityModal
        staff={mockStaff}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('35')).toBeInTheDocument()
    })

    // Change max hours
    const hoursInput = screen.getByDisplayValue('35')
    fireEvent.change(hoursInput, { target: { value: '40' } })

    // Click save button
    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/staff/1/preferences/1',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            preference_value: { hours: 40 },
            priority: 'high'
          })
        })
      )
    })
  })

  it('allows adding availability preference', async () => {
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 3, ...mockPreferences[1] })
      })

    render(
      <StaffAvailabilityModal
        staff={mockStaff}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Add Availability')).toBeInTheDocument()
    })

    // Click add availability button
    fireEvent.click(screen.getByText('Add Availability'))

    // Fill in availability form
    const daySelect = screen.getByDisplayValue('Monday')
    fireEvent.change(daySelect, { target: { value: '1' } })

    const startTimeInput = screen.getByLabelText('Start Time')
    fireEvent.change(startTimeInput, { target: { value: '10:00' } })

    const endTimeInput = screen.getByLabelText('End Time')
    fireEvent.change(endTimeInput, { target: { value: '18:00' } })

    // Submit form
    const addButton = screen.getAllByText('Add')[1] // Second "Add" button in the form
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/staff/1/preferences',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"preference_type":"availability"')
        })
      )
    })
  })

  it('allows adding time off request', async () => {
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 4 })
      })

    render(
      <StaffAvailabilityModal
        staff={mockStaff}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Request Time Off')).toBeInTheDocument()
    })

    // Click request time off button
    fireEvent.click(screen.getByText('Request Time Off'))

    // Fill in time off form
    const startDateInput = screen.getByLabelText('Start Date')
    fireEvent.change(startDateInput, { target: { value: '2024-07-01' } })

    const endDateInput = screen.getByLabelText('End Date')
    fireEvent.change(endDateInput, { target: { value: '2024-07-07' } })

    const reasonInput = screen.getByLabelText('Reason')
    fireEvent.change(reasonInput, { target: { value: 'Family vacation' } })

    // Submit form
    const submitButton = screen.getByText('Submit Request')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/staff/1/preferences',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"preference_type":"time_off"')
        })
      )
    })
  })

  it('displays existing preferences correctly', async () => {
    render(
      <StaffAvailabilityModal
        staff={mockStaff}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('All Preferences')).toBeInTheDocument()
    })

    // Should display preference types
    expect(screen.getByText('Max Hours')).toBeInTheDocument()
    expect(screen.getByText('Availability')).toBeInTheDocument()

    // Should display priority badges
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('medium')).toBeInTheDocument()
  })

  it('allows deleting preferences', async () => {
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPreferences
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockPreferences[1]]
      })

    render(
      <StaffAvailabilityModal
        staff={mockStaff}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('All Preferences')).toBeInTheDocument()
    })

    // Click delete button for first preference
    const deleteButtons = screen.getAllByRole('button')
    const deleteButton = deleteButtons.find(btn => 
      btn.querySelector('svg') && btn.className.includes('text-red-600')
    )
    
    if (deleteButton) {
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/staff/1/preferences/1',
          expect.objectContaining({
            method: 'DELETE'
          })
        )
      })
    }
  })

  it('closes modal when close button is clicked', () => {
    render(
      <StaffAvailabilityModal
        staff={mockStaff}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    const closeButton = screen.getByText('Close')
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('handles form validation', async () => {
    render(
      <StaffAvailabilityModal
        staff={mockStaff}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Add Availability')).toBeInTheDocument()
    })

    // Click add availability without filling form
    fireEvent.click(screen.getByText('Add Availability'))

    // Try to submit empty form
    const addButton = screen.getAllByText('Add')[1]
    fireEvent.click(addButton)

    // Should not make API call with empty data
    expect(fetch).toHaveBeenCalledTimes(1) // Only the initial load call
  })
})