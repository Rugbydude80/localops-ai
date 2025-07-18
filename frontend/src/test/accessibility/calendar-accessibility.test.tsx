import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { ScheduleCalendarView } from '@/components/ScheduleCalendarView'
import { AutoScheduleModal } from '@/components/AutoScheduleModal'
import { ShiftDetailPopover } from '@/components/ShiftDetailPopover'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// Mock data for testing
const mockStaff = [
  { id: 1, name: 'John Doe', skills: ['server'], availability: [] },
  { id: 2, name: 'Jane Smith', skills: ['cook'], availability: [] },
  { id: 3, name: 'Bob Johnson', skills: ['bartender'], availability: [] }
]

const mockShifts = [
  {
    id: 1,
    title: 'Morning Shift',
    startTime: '08:00',
    endTime: '16:00',
    date: new Date('2024-01-15'),
    requiredSkill: 'server',
    assignments: [{ id: 1, staff_id: 1, staff_name: 'John Doe' }],
    status: 'filled',
    confidenceScore: 0.9
  },
  {
    id: 2,
    title: 'Evening Shift',
    startTime: '16:00',
    endTime: '24:00',
    date: new Date('2024-01-15'),
    requiredSkill: 'cook',
    assignments: [],
    status: 'open',
    confidenceScore: 0.0
  }
]

describe('Calendar Accessibility Tests', () => {
  const user = userEvent.setup()

  describe('ScheduleCalendarView Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <ScheduleCalendarView
          businessId={1}
          weekStart={new Date('2024-01-15')}
          onWeekChange={vi.fn()}
          onShiftEdit={vi.fn()}
          onAutoSchedule={vi.fn()}
          staff={mockStaff}
          shifts={mockShifts}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper ARIA labels and roles', () => {
      render(
        <ScheduleCalendarView
          businessId={1}
          weekStart={new Date('2024-01-15')}
          onWeekChange={vi.fn()}
          onShiftEdit={vi.fn()}
          onAutoSchedule={vi.fn()}
          staff={mockStaff}
          shifts={mockShifts}
        />
      )

      // Calendar should have proper role
      const calendar = screen.getByRole('grid', { name: /schedule calendar/i })
      expect(calendar).toBeInTheDocument()

      // Week navigation should be accessible
      const prevWeekBtn = screen.getByRole('button', { name: /previous week/i })
      const nextWeekBtn = screen.getByRole('button', { name: /next week/i })
      expect(prevWeekBtn).toBeInTheDocument()
      expect(nextWeekBtn).toBeInTheDocument()

      // Current week should be announced
      const weekLabel = screen.getByText(/week of/i)
      expect(weekLabel).toHaveAttribute('aria-live', 'polite')
    })

    it('should support keyboard navigation', async () => {
      render(
        <ScheduleCalendarView
          businessId={1}
          weekStart={new Date('2024-01-15')}
          onWeekChange={vi.fn()}
          onShiftEdit={vi.fn()}
          onAutoSchedule={vi.fn()}
          staff={mockStaff}
          shifts={mockShifts}
        />
      )

      // Tab through calendar elements
      await user.tab()
      expect(screen.getByRole('button', { name: /previous week/i })).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: /next week/i })).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: /auto-schedule/i })).toHaveFocus()

      // Arrow key navigation within calendar grid
      const calendarGrid = screen.getByRole('grid')
      calendarGrid.focus()

      // Right arrow should move to next day
      await user.keyboard('{ArrowRight}')
      const focusedCell = document.activeElement
      expect(focusedCell).toHaveAttribute('role', 'gridcell')

      // Down arrow should move to next week
      await user.keyboard('{ArrowDown}')
      // Should move focus down one row
    })

    it('should announce shift status changes', async () => {
      const mockOnShiftEdit = vi.fn()
      
      render(
        <ScheduleCalendarView
          businessId={1}
          weekStart={new Date('2024-01-15')}
          onWeekChange={vi.fn()}
          onShiftEdit={mockOnShiftEdit}
          onAutoSchedule={vi.fn()}
          staff={mockStaff}
          shifts={mockShifts}
        />
      )

      // Find shift element
      const shiftElement = screen.getByText('Morning Shift')
      expect(shiftElement).toHaveAttribute('aria-describedby')
      
      // Status should be announced
      const statusElement = screen.getByText(/filled/i)
      expect(statusElement).toHaveAttribute('aria-live', 'polite')
    })

    it('should provide proper color contrast for shift status indicators', () => {
      render(
        <ScheduleCalendarView
          businessId={1}
          weekStart={new Date('2024-01-15')}
          onWeekChange={vi.fn()}
          onShiftEdit={vi.fn()}
          onAutoSchedule={vi.fn()}
          staff={mockStaff}
          shifts={mockShifts}
        />
      )

      // Check that status indicators have proper contrast
      const filledShift = screen.getByText('Morning Shift').closest('[data-status="filled"]')
      const openShift = screen.getByText('Evening Shift').closest('[data-status="open"]')

      expect(filledShift).toHaveClass('bg-green-100', 'border-green-500')
      expect(openShift).toHaveClass('bg-red-100', 'border-red-500')
    })

    it('should support screen reader announcements for drag and drop', async () => {
      const mockOnShiftEdit = vi.fn()
      
      render(
        <ScheduleCalendarView
          businessId={1}
          weekStart={new Date('2024-01-15')}
          onWeekChange={vi.fn()}
          onShiftEdit={mockOnShiftEdit}
          onAutoSchedule={vi.fn()}
          staff={mockStaff}
          shifts={mockShifts}
          enableDragDrop={true}
        />
      )

      // Draggable elements should have proper ARIA attributes
      const draggableStaff = screen.getByText('John Doe')
      expect(draggableStaff).toHaveAttribute('draggable', 'true')
      expect(draggableStaff).toHaveAttribute('aria-describedby')
      expect(draggableStaff).toHaveAttribute('role', 'button')

      // Drop zones should be properly labeled
      const dropZone = screen.getByText('Evening Shift').closest('[data-droppable="true"]')
      expect(dropZone).toHaveAttribute('aria-dropeffect', 'move')
      expect(dropZone).toHaveAttribute('aria-label')
    })

    it('should handle high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      render(
        <ScheduleCalendarView
          businessId={1}
          weekStart={new Date('2024-01-15')}
          onWeekChange={vi.fn()}
          onShiftEdit={vi.fn()}
          onAutoSchedule={vi.fn()}
          staff={mockStaff}
          shifts={mockShifts}
        />
      )

      // Should apply high contrast styles
      const calendar = screen.getByRole('grid')
      expect(calendar).toHaveClass('high-contrast')
    })
  })

  describe('AutoScheduleModal Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <AutoScheduleModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          businessId={1}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should trap focus within modal', async () => {
      render(
        <AutoScheduleModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          businessId={1}
        />
      )

      // First focusable element should receive focus
      const firstInput = screen.getByLabelText(/start date/i)
      expect(firstInput).toHaveFocus()

      // Tab to last element
      const closeButton = screen.getByRole('button', { name: /close/i })
      closeButton.focus()

      // Tab should cycle back to first element
      await user.tab()
      expect(firstInput).toHaveFocus()

      // Shift+Tab should go to last element
      await user.keyboard('{Shift>}{Tab}{/Shift}')
      expect(closeButton).toHaveFocus()
    })

    it('should handle escape key to close modal', async () => {
      const mockOnClose = vi.fn()
      
      render(
        <AutoScheduleModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={vi.fn()}
          businessId={1}
        />
      )

      await user.keyboard('{Escape}')
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should have proper ARIA attributes', () => {
      render(
        <AutoScheduleModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          businessId={1}
        />
      )

      const modal = screen.getByRole('dialog')
      expect(modal).toHaveAttribute('aria-modal', 'true')
      expect(modal).toHaveAttribute('aria-labelledby')
      expect(modal).toHaveAttribute('aria-describedby')

      const title = screen.getByRole('heading', { level: 2 })
      expect(title).toBeInTheDocument()
    })

    it('should announce form validation errors', async () => {
      render(
        <AutoScheduleModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          businessId={1}
        />
      )

      // Submit form without required fields
      const submitButton = screen.getByRole('button', { name: /generate schedule/i })
      await user.click(submitButton)

      // Error messages should be announced
      await waitFor(() => {
        const errorMessage = screen.getByRole('alert')
        expect(errorMessage).toBeInTheDocument()
        expect(errorMessage).toHaveAttribute('aria-live', 'assertive')
      })
    })

    it('should support date picker accessibility', async () => {
      render(
        <AutoScheduleModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          businessId={1}
        />
      )

      const startDateInput = screen.getByLabelText(/start date/i)
      expect(startDateInput).toHaveAttribute('type', 'date')
      expect(startDateInput).toHaveAttribute('aria-describedby')

      // Should support keyboard navigation
      startDateInput.focus()
      await user.keyboard('{ArrowUp}')  // Should increment date
      await user.keyboard('{ArrowDown}')  // Should decrement date
    })

    it('should handle loading states accessibly', async () => {
      const mockOnConfirm = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))
      
      render(
        <AutoScheduleModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={mockOnConfirm}
          businessId={1}
        />
      )

      const submitButton = screen.getByRole('button', { name: /generate schedule/i })
      await user.click(submitButton)

      // Loading state should be announced
      await waitFor(() => {
        const loadingIndicator = screen.getByRole('status')
        expect(loadingIndicator).toBeInTheDocument()
        expect(loadingIndicator).toHaveAttribute('aria-live', 'polite')
        expect(loadingIndicator).toHaveTextContent(/generating/i)
      })

      // Button should be disabled during loading
      expect(submitButton).toBeDisabled()
      expect(submitButton).toHaveAttribute('aria-describedby')
    })
  })

  describe('ShiftDetailPopover Accessibility', () => {
    const mockShift = {
      id: 1,
      title: 'Morning Shift',
      startTime: '08:00',
      endTime: '16:00',
      date: new Date('2024-01-15'),
      requiredSkill: 'server',
      assignments: [{ id: 1, staff_id: 1, staff_name: 'John Doe' }],
      status: 'filled',
      confidenceScore: 0.9,
      reasoning: 'Assigned based on availability and performance history'
    }

    it('should have no accessibility violations', async () => {
      const { container } = render(
        <ShiftDetailPopover
          shift={mockShift}
          isOpen={true}
          onClose={vi.fn()}
          onEdit={vi.fn()}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should be properly associated with trigger element', () => {
      render(
        <div>
          <button id="shift-trigger" aria-describedby="shift-popover">
            Morning Shift
          </button>
          <ShiftDetailPopover
            shift={mockShift}
            isOpen={true}
            onClose={vi.fn()}
            onEdit={vi.fn()}
            triggerId="shift-trigger"
          />
        </div>
      )

      const popover = screen.getByRole('tooltip')
      expect(popover).toHaveAttribute('id', 'shift-popover')
    })

    it('should support keyboard navigation', async () => {
      render(
        <ShiftDetailPopover
          shift={mockShift}
          isOpen={true}
          onClose={vi.fn()}
          onEdit={vi.fn()}
        />
      )

      // Should be able to tab through interactive elements
      const editButton = screen.getByRole('button', { name: /edit shift/i })
      const closeButton = screen.getByRole('button', { name: /close/i })

      await user.tab()
      expect(editButton).toHaveFocus()

      await user.tab()
      expect(closeButton).toHaveFocus()
    })

    it('should announce confidence scores accessibly', () => {
      render(
        <ShiftDetailPopover
          shift={mockShift}
          isOpen={true}
          onClose={vi.fn()}
          onEdit={vi.fn()}
        />
      )

      const confidenceScore = screen.getByText(/confidence/i)
      expect(confidenceScore).toHaveAttribute('aria-label', 'Confidence score: 90%')
      
      // Visual indicator should have text alternative
      const confidenceBar = screen.getByRole('progressbar')
      expect(confidenceBar).toHaveAttribute('aria-valuenow', '90')
      expect(confidenceBar).toHaveAttribute('aria-valuemin', '0')
      expect(confidenceBar).toHaveAttribute('aria-valuemax', '100')
    })
  })

  describe('Reduced Motion Support', () => {
    beforeEach(() => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })
    })

    it('should respect reduced motion preferences', () => {
      render(
        <ScheduleCalendarView
          businessId={1}
          weekStart={new Date('2024-01-15')}
          onWeekChange={vi.fn()}
          onShiftEdit={vi.fn()}
          onAutoSchedule={vi.fn()}
          staff={mockStaff}
          shifts={mockShifts}
        />
      )

      // Animations should be disabled
      const calendar = screen.getByRole('grid')
      expect(calendar).toHaveClass('motion-reduce:transition-none')
    })

    it('should provide alternative feedback for animations', async () => {
      render(
        <AutoScheduleModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          businessId={1}
        />
      )

      // Instead of loading animation, should provide text feedback
      const submitButton = screen.getByRole('button', { name: /generate schedule/i })
      await user.click(submitButton)

      // Should announce progress textually instead of visually
      await waitFor(() => {
        const statusText = screen.getByText(/generating schedule/i)
        expect(statusText).toHaveAttribute('aria-live', 'polite')
      })
    })
  })

  describe('Screen Reader Compatibility', () => {
    it('should provide comprehensive shift information to screen readers', () => {
      render(
        <ScheduleCalendarView
          businessId={1}
          weekStart={new Date('2024-01-15')}
          onWeekChange={vi.fn()}
          onShiftEdit={vi.fn()}
          onAutoSchedule={vi.fn()}
          staff={mockStaff}
          shifts={mockShifts}
        />
      )

      const shiftElement = screen.getByText('Morning Shift')
      const shiftContainer = shiftElement.closest('[role="gridcell"]')
      
      expect(shiftContainer).toHaveAttribute('aria-label', 
        'Morning Shift, January 15th, 8:00 AM to 4:00 PM, Server position, Filled, Assigned to John Doe, Confidence: 90%'
      )
    })

    it('should provide context for empty shifts', () => {
      render(
        <ScheduleCalendarView
          businessId={1}
          weekStart={new Date('2024-01-15')}
          onWeekChange={vi.fn()}
          onShiftEdit={vi.fn()}
          onAutoSchedule={vi.fn()}
          staff={mockStaff}
          shifts={mockShifts}
        />
      )

      const emptyShift = screen.getByText('Evening Shift')
      const shiftContainer = emptyShift.closest('[role="gridcell"]')
      
      expect(shiftContainer).toHaveAttribute('aria-label', 
        'Evening Shift, January 15th, 4:00 PM to 12:00 AM, Cook position, Open, No assignments'
      )
    })

    it('should announce schedule updates', async () => {
      const { rerender } = render(
        <ScheduleCalendarView
          businessId={1}
          weekStart={new Date('2024-01-15')}
          onWeekChange={vi.fn()}
          onShiftEdit={vi.fn()}
          onAutoSchedule={vi.fn()}
          staff={mockStaff}
          shifts={mockShifts}
        />
      )

      // Update shifts with new assignment
      const updatedShifts = [...mockShifts]
      updatedShifts[1].assignments = [{ id: 2, staff_id: 2, staff_name: 'Jane Smith' }]
      updatedShifts[1].status = 'filled'

      rerender(
        <ScheduleCalendarView
          businessId={1}
          weekStart={new Date('2024-01-15')}
          onWeekChange={vi.fn()}
          onShiftEdit={vi.fn()}
          onAutoSchedule={vi.fn()}
          staff={mockStaff}
          shifts={updatedShifts}
        />
      )

      // Should announce the change
      const announcement = screen.getByRole('status')
      expect(announcement).toHaveTextContent(/evening shift updated.*jane smith assigned/i)
    })
  })
})