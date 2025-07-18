import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import ScheduleCalendarView, { Shift, Staff, ShiftAssignment } from '../ScheduleCalendarView'

// Mock data
const mockStaff: Staff[] = [
  {
    id: 1,
    name: 'John Doe',
    skills: ['kitchen', 'bar'],
    hourly_rate: 15.50,
    is_available: true
  },
  {
    id: 2,
    name: 'Jane Smith',
    skills: ['front_of_house'],
    hourly_rate: 14.00,
    is_available: true
  },
  {
    id: 3,
    name: 'Bob Wilson',
    skills: ['kitchen'],
    hourly_rate: 16.00,
    is_available: false
  }
]

const mockAssignments: ShiftAssignment[] = [
  {
    id: 1,
    staff_id: 1,
    staff_name: 'John Doe',
    status: 'assigned',
    confidence_score: 0.85,
    reasoning: 'High skill match and availability'
  }
]

const mockShifts: Shift[] = [
  {
    id: 1,
    title: 'Morning Kitchen',
    date: '2024-01-15',
    start_time: '08:00',
    end_time: '16:00',
    required_skill: 'kitchen',
    required_staff_count: 2,
    hourly_rate: 15.00,
    status: 'understaffed',
    assignments: mockAssignments,
    confidence_score: 0.75,
    ai_generated: true
  },
  {
    id: 2,
    title: 'Evening Service',
    date: '2024-01-15',
    start_time: '17:00',
    end_time: '23:00',
    required_skill: 'front_of_house',
    required_staff_count: 1,
    hourly_rate: 14.00,
    status: 'open',
    assignments: [],
    ai_generated: false
  }
]

const defaultProps = {
  businessId: 1,
  shifts: mockShifts,
  staff: mockStaff,
  selectedDate: new Date('2024-01-15'),
  onDateChange: vi.fn(),
  onStaffAssign: vi.fn(),
  onStaffUnassign: vi.fn(),
  onShiftEdit: vi.fn(),
  onAutoSchedule: vi.fn(),
  isLoading: false
}

describe('ScheduleCalendarView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders calendar header with correct week', () => {
      render(<ScheduleCalendarView {...defaultProps} />)
      
      expect(screen.getByText(/Week of Jan 15, 2024/)).toBeInTheDocument()
    })

    it('renders all weekday headers', () => {
      render(<ScheduleCalendarView {...defaultProps} />)
      
      const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      weekdays.forEach(day => {
        expect(screen.getByText(day)).toBeInTheDocument()
      })
    })

    it('renders shifts in correct day columns', () => {
      render(<ScheduleCalendarView {...defaultProps} />)
      
      expect(screen.getByText('Morning Kitchen')).toBeInTheDocument()
      expect(screen.getByText('Evening Service')).toBeInTheDocument()
      expect(screen.getByText('08:00-16:00')).toBeInTheDocument()
      expect(screen.getByText('17:00-23:00')).toBeInTheDocument()
    })

    it('displays available staff panel', () => {
      render(<ScheduleCalendarView {...defaultProps} />)
      
      expect(screen.getByText('Available Staff (2)')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument()
    })

    it('shows loading state when isLoading is true', () => {
      render(<ScheduleCalendarView {...defaultProps} isLoading={true} />)
      
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  describe('Shift Status Indicators', () => {
    it('displays correct staffing ratios', () => {
      render(<ScheduleCalendarView {...defaultProps} />)
      
      // Morning Kitchen: 1/2 staff (understaffed)
      expect(screen.getByText('1/2')).toBeInTheDocument()
      // Evening Service: 0/1 staff (open)
      expect(screen.getByText('0/1')).toBeInTheDocument()
    })

    it('shows AI confidence indicators for AI-generated shifts', () => {
      render(<ScheduleCalendarView {...defaultProps} />)
      
      expect(screen.getByText('AI')).toBeInTheDocument()
      expect(screen.getByTitle('AI Confidence: 75%')).toBeInTheDocument()
    })

    it('displays coverage progress bars with correct colors', () => {
      render(<ScheduleCalendarView {...defaultProps} />)
      
      // Progress bars are div elements, not proper progressbar role
      const progressBars = document.querySelectorAll('.bg-gray-200.rounded-full.h-1')
      expect(progressBars).toHaveLength(2)
    })
  })

  describe('Navigation', () => {
    it('calls onDateChange when clicking previous week', async () => {
      const user = userEvent.setup()
      render(<ScheduleCalendarView {...defaultProps} />)
      
      const prevButton = screen.getByRole('button', { name: /previous/i })
      await user.click(prevButton)
      
      expect(defaultProps.onDateChange).toHaveBeenCalledWith(
        new Date('2024-01-08')
      )
    })

    it('calls onDateChange when clicking next week', async () => {
      const user = userEvent.setup()
      render(<ScheduleCalendarView {...defaultProps} />)
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      expect(defaultProps.onDateChange).toHaveBeenCalledWith(
        new Date('2024-01-22')
      )
    })

    it('calls onDateChange when clicking Today button', async () => {
      const user = userEvent.setup()
      render(<ScheduleCalendarView {...defaultProps} />)
      
      const todayButton = screen.getByRole('button', { name: /today/i })
      await user.click(todayButton)
      
      expect(defaultProps.onDateChange).toHaveBeenCalled()
    })

    it('calls onAutoSchedule when clicking Auto-Schedule button', async () => {
      const user = userEvent.setup()
      render(<ScheduleCalendarView {...defaultProps} />)
      
      const autoScheduleButton = screen.getByRole('button', { name: /auto-schedule/i })
      await user.click(autoScheduleButton)
      
      expect(defaultProps.onAutoSchedule).toHaveBeenCalled()
    })
  })

  describe('Shift Interaction', () => {
    it('opens shift detail popover when clicking on a shift', async () => {
      const user = userEvent.setup()
      render(<ScheduleCalendarView {...defaultProps} />)
      
      const shiftElement = screen.getByText('Morning Kitchen')
      await user.click(shiftElement)
      
      expect(defaultProps.onShiftEdit).toHaveBeenCalledWith(mockShifts[0])
    })

    it('displays shift assignment reasoning in popover', async () => {
      const user = userEvent.setup()
      render(<ScheduleCalendarView {...defaultProps} />)
      
      const shiftElement = screen.getByText('Morning Kitchen')
      await user.click(shiftElement)
      
      await waitFor(() => {
        expect(screen.getByText('Assignment Reasoning')).toBeInTheDocument()
        expect(screen.getByText('High skill match and availability')).toBeInTheDocument()
      })
    })
  })

  describe('Staff Assignment', () => {
    it('displays assigned staff in shift cells', () => {
      render(<ScheduleCalendarView {...defaultProps} />)
      
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    it('shows confidence scores for assignments', () => {
      render(<ScheduleCalendarView {...defaultProps} />)
      
      expect(screen.getByText('85%')).toBeInTheDocument()
    })

    it('indicates sick leave status', () => {
      const shiftsWithSickLeave = [
        {
          ...mockShifts[0],
          assignments: [
            {
              ...mockAssignments[0],
              status: 'called_in_sick' as const
            }
          ]
        }
      ]
      
      render(<ScheduleCalendarView {...defaultProps} shifts={shiftsWithSickLeave} />)
      
      expect(screen.getAllByText('🤒')).toHaveLength(1)
    })
  })

  describe('Legend and Help', () => {
    it('displays staffing status legend', () => {
      render(<ScheduleCalendarView {...defaultProps} />)
      
      expect(screen.getByText('Fully Staffed (100%)')).toBeInTheDocument()
      expect(screen.getByText('Partially Staffed (70-99%)')).toBeInTheDocument()
      expect(screen.getByText('Understaffed (<70%)')).toBeInTheDocument()
    })

    it('displays AI confidence legend', () => {
      render(<ScheduleCalendarView {...defaultProps} />)
      
      expect(screen.getByText('High AI Confidence (80%+)')).toBeInTheDocument()
      expect(screen.getByText('Medium AI Confidence (60-79%)')).toBeInTheDocument()
      expect(screen.getByText('Low AI Confidence (<60%)')).toBeInTheDocument()
    })

    it('shows drag and drop instructions', () => {
      render(<ScheduleCalendarView {...defaultProps} />)
      
      expect(screen.getByText('Drag staff to assign shifts')).toBeInTheDocument()
    })
  })

  describe('Empty States', () => {
    it('shows message when no shifts are scheduled for a day', () => {
      const emptyShifts: Shift[] = []
      render(<ScheduleCalendarView {...defaultProps} shifts={emptyShifts} />)
      
      expect(screen.getAllByText('No shifts scheduled')).toHaveLength(7) // One for each day
    })

    it('shows message when all staff are assigned', () => {
      const shiftsWithAllStaff = [
        {
          ...mockShifts[0],
          assignments: mockStaff.map((staff, index) => ({
            id: index + 10,
            staff_id: staff.id,
            staff_name: staff.name,
            status: 'assigned' as const
          }))
        }
      ]
      
      render(<ScheduleCalendarView {...defaultProps} shifts={shiftsWithAllStaff} />)
      
      expect(screen.getByText('All staff are assigned')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for interactive elements', () => {
      render(<ScheduleCalendarView {...defaultProps} />)
      
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-label')
      })
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<ScheduleCalendarView {...defaultProps} />)
      
      const todayButton = screen.getByRole('button', { name: /today/i })
      todayButton.focus()
      
      await user.keyboard('{Enter}')
      expect(defaultProps.onDateChange).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('handles missing staff data gracefully', () => {
      const shiftsWithMissingStaff = [
        {
          ...mockShifts[0],
          assignments: [
            {
              id: 999,
              staff_id: 999, // Non-existent staff ID
              staff_name: 'Missing Staff',
              status: 'assigned' as const
            }
          ]
        }
      ]
      
      render(<ScheduleCalendarView {...defaultProps} shifts={shiftsWithMissingStaff} />)
      
      // Should not crash and should handle gracefully
      expect(screen.getByText('Morning Kitchen')).toBeInTheDocument()
    })

    it('handles invalid date formats gracefully', () => {
      const shiftsWithInvalidDate = [
        {
          ...mockShifts[0],
          date: 'invalid-date'
        }
      ]
      
      // Should not crash when rendering
      expect(() => {
        render(<ScheduleCalendarView {...defaultProps} shifts={shiftsWithInvalidDate} />)
      }).not.toThrow()
    })
  })
})