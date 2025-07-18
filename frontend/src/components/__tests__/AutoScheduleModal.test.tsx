import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import AutoScheduleModal from '../AutoScheduleModal'

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mockStaff = [
  { id: 1, name: 'John Doe' },
  { id: 2, name: 'Jane Smith' },
  { id: 3, name: 'Bob Johnson' },
]

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  businessId: 1,
  staff: mockStaff,
  isLoading: false,
  currentStep: 'configure' as const,
  progress: 0,
}

describe('AutoScheduleModal', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Modal Visibility and Basic Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<AutoScheduleModal {...defaultProps} isOpen={false} />)
      expect(screen.queryByText('Auto-Schedule Configuration')).not.toBeInTheDocument()
    })

    it('should render when isOpen is true', () => {
      render(<AutoScheduleModal {...defaultProps} />)
      expect(screen.getByText('Auto-Schedule Configuration')).toBeInTheDocument()
      expect(screen.getByText('Configure parameters for automatic schedule generation')).toBeInTheDocument()
    })

    it('should display all main sections', () => {
      render(<AutoScheduleModal {...defaultProps} />)
      
      expect(screen.getByText('Schedule Date Range')).toBeInTheDocument()
      expect(screen.getByText('Special Events & Busy Periods')).toBeInTheDocument()
      expect(screen.getByText('Staff Notes & Constraints')).toBeInTheDocument()
      expect(screen.getByText('Scheduling Constraints')).toBeInTheDocument()
      expect(screen.getByText('Notification Settings')).toBeInTheDocument()
    })

    it('should have close button that calls onClose', async () => {
      const onClose = vi.fn()
      render(<AutoScheduleModal {...defaultProps} onClose={onClose} />)
      
      const closeButton = screen.getByLabelText('Close modal')
      await user.click(closeButton)
      
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Date Range Configuration', () => {
    it('should allow changing date values', async () => {
      render(<AutoScheduleModal {...defaultProps} />)
      
      const startDateInput = screen.getByLabelText('Start Date')
      const endDateInput = screen.getByLabelText('End Date')
      
      await user.clear(startDateInput)
      await user.type(startDateInput, '2024-02-01')
      
      await user.clear(endDateInput)
      await user.type(endDateInput, '2024-02-07')
      
      expect(startDateInput).toHaveValue('2024-02-01')
      expect(endDateInput).toHaveValue('2024-02-07')
    })
  })

  describe('Special Events Management', () => {
    it('should show empty state when no events are added', () => {
      render(<AutoScheduleModal {...defaultProps} />)
      
      expect(screen.getByText(/No special events added/)).toBeInTheDocument()
    })

    it('should show event form when Add Event is clicked', async () => {
      render(<AutoScheduleModal {...defaultProps} />)
      
      const addEventButton = screen.getByText('Add Event')
      await user.click(addEventButton)
      
      expect(screen.getByPlaceholderText('e.g., Football Match, Holiday')).toBeInTheDocument()
      expect(screen.getByText('Select impact...')).toBeInTheDocument()
    })
  })

  describe('Form Submission', () => {
    it('should call onConfirm with correct parameters when form is submitted', async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined)
      render(<AutoScheduleModal {...defaultProps} onConfirm={onConfirm} />)
      
      // Fill in some basic data
      const startDateInput = screen.getByLabelText('Start Date')
      const endDateInput = screen.getByLabelText('End Date')
      
      await user.clear(startDateInput)
      await user.type(startDateInput, '2024-02-01')
      
      await user.clear(endDateInput)
      await user.type(endDateInput, '2024-02-07')
      
      // Submit form
      const generateButton = screen.getByText('Generate Schedule')
      await user.click(generateButton)
      
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith({
          dateRange: {
            start: '2024-02-01',
            end: '2024-02-07'
          },
          specialEvents: [],
          staffNotes: [],
          constraints: {
            maxHoursPerStaff: 40,
            minRestHours: 8,
            skillMatching: true,
            fairDistribution: true,
            considerPreferences: true,
            laborCostOptimization: false
          },
          notificationSettings: {
            notifyOnGeneration: false,
            notifyOnPublish: true,
            channels: ['email']
          }
        })
      })
    })

    it('should show loading state when isLoading is true', () => {
      render(<AutoScheduleModal {...defaultProps} isLoading={true} />)
      
      const generateButton = screen.getByText('Generating...')
      expect(generateButton).toBeDisabled()
    })
  })

  describe('Different Steps/States', () => {
    it('should show generating state', () => {
      render(<AutoScheduleModal {...defaultProps} currentStep="generating" progress={50} />)
      
      expect(screen.getByText('Generating Schedule...')).toBeInTheDocument()
      expect(screen.getByText('AI is creating your optimal schedule')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('should show review state with generated schedule', () => {
      const mockGeneratedSchedule = {
        totalShifts: 25,
        fullyStaffed: 20,
        averageConfidence: 0.85
      }
      
      render(
        <AutoScheduleModal 
          {...defaultProps} 
          currentStep="review" 
          generatedSchedule={mockGeneratedSchedule}
        />
      )
      
      expect(screen.getByText('Review Generated Schedule')).toBeInTheDocument()
      expect(screen.getByText('Schedule Generated Successfully!')).toBeInTheDocument()
      expect(screen.getByText('25')).toBeInTheDocument() // Total shifts
      expect(screen.getByText('20')).toBeInTheDocument() // Fully staffed
      expect(screen.getByText('85%')).toBeInTheDocument() // Average confidence
    })

    it('should show publishing state', () => {
      render(<AutoScheduleModal {...defaultProps} currentStep="publishing" progress={75} />)
      
      expect(screen.getByText('Publishing Schedule...')).toBeInTheDocument()
      expect(screen.getByText('Finalizing schedule and sending notifications to staff...')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<AutoScheduleModal {...defaultProps} />)
      
      expect(screen.getByLabelText('Close modal')).toBeInTheDocument()
      expect(screen.getByLabelText('Start Date')).toBeInTheDocument()
      expect(screen.getByLabelText('End Date')).toBeInTheDocument()
    })

    it('should have proper form structure', () => {
      render(<AutoScheduleModal {...defaultProps} />)
      
      // Check that form elements are properly associated with labels
      const startDateInput = screen.getByLabelText('Start Date')
      const endDateInput = screen.getByLabelText('End Date')
      const maxHoursInput = screen.getByLabelText('Maximum Hours per Staff Member')
      
      expect(startDateInput).toHaveAttribute('type', 'date')
      expect(endDateInput).toHaveAttribute('type', 'date')
      expect(maxHoursInput).toHaveAttribute('type', 'number')
    })
  })
})