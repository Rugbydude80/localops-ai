import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import ScheduleCalendarView, { Shift, Staff, ShiftAssignment } from '../ScheduleCalendarView'

// Test backend for drag and drop
import { TestBackend } from 'react-dnd-test-backend'

// Mock data for drag and drop tests
const mockStaff: Staff[] = [
  {
    id: 1,
    name: 'John Doe',
    skills: ['kitchen'],
    hourly_rate: 15.50,
    is_available: true
  },
  {
    id: 2,
    name: 'Jane Smith',
    skills: ['front_of_house'],
    hourly_rate: 14.00,
    is_available: true
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
    status: 'open',
    assignments: []
  },
  {
    id: 2,
    title: 'Evening Service',
    date: '2024-01-15',
    start_time: '17:00',
    end_time: '23:00',
    required_skill: 'front_of_house',
    required_staff_count: 1,
    status: 'open',
    assignments: []
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
  isLoading: false
}

// Wrapper component with test backend
const DragDropTestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DndProvider backend={TestBackend}>
    {children}
  </DndProvider>
)

describe('Drag and Drop Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Staff Card Dragging', () => {
    it('makes staff cards draggable', () => {
      render(
        <DragDropTestWrapper>
          <ScheduleCalendarView {...defaultProps} />
        </DragDropTestWrapper>
      )
      
      const staffCards = screen.getAllByText(/John Doe|Jane Smith/)
      staffCards.forEach(card => {
        expect(card.closest('[draggable]')).toBeTruthy()
      })
    })

    it('shows visual feedback when dragging staff', async () => {
      render(
        <DragDropTestWrapper>
          <ScheduleCalendarView {...defaultProps} />
        </DragDropTestWrapper>
      )
      
      const johnCard = screen.getByText('John Doe')
      
      // Simulate drag start
      fireEvent.dragStart(johnCard, {
        dataTransfer: {
          setData: vi.fn(),
          getData: vi.fn(),
        }
      })
      
      // Card should have dragging styles
      expect(johnCard.closest('.opacity-50')).toBeTruthy()
    })
  })

  describe('Shift Drop Zones', () => {
    it('accepts staff drops on shift cells', () => {
      render(
        <DragDropTestWrapper>
          <ScheduleCalendarView {...defaultProps} />
        </DragDropTestWrapper>
      )
      
      const shiftCells = screen.getAllByText(/Morning Kitchen|Evening Service/)
      shiftCells.forEach(cell => {
        expect(cell.closest('[data-testid*="drop-zone"]')).toBeTruthy()
      })
    })

    it('shows drop indicator when hovering over valid drop zone', async () => {
      render(
        <DragDropTestWrapper>
          <ScheduleCalendarView {...defaultProps} />
        </DragDropTestWrapper>
      )
      
      const johnCard = screen.getByText('John Doe')
      const morningShift = screen.getByText('Morning Kitchen')
      
      // Simulate drag over
      fireEvent.dragStart(johnCard)
      fireEvent.dragEnter(morningShift)
      fireEvent.dragOver(morningShift)
      
      // Should show drop indicator
      expect(screen.getByText('Drop to assign')).toBeInTheDocument()
    })

    it('calls onStaffAssign when dropping staff on shift', async () => {
      render(
        <DragDropTestWrapper>
          <ScheduleCalendarView {...defaultProps} />
        </DragDropTestWrapper>
      )
      
      const johnCard = screen.getByText('John Doe')
      const morningShift = screen.getByText('Morning Kitchen')
      
      // Simulate complete drag and drop
      fireEvent.dragStart(johnCard, {
        dataTransfer: {
          setData: vi.fn(),
          getData: () => JSON.stringify({ staffId: 1, type: 'staff' })
        }
      })
      fireEvent.dragEnter(morningShift)
      fireEvent.dragOver(morningShift)
      fireEvent.drop(morningShift, {
        dataTransfer: {
          getData: () => JSON.stringify({ staffId: 1, type: 'staff' })
        }
      })
      
      expect(defaultProps.onStaffAssign).toHaveBeenCalledWith(1, 1) // shiftId, staffId
    })
  })

  describe('Assignment Movement', () => {
    it('allows moving existing assignments between shifts', async () => {
      const shiftsWithAssignment = [
        {
          ...mockShifts[0],
          assignments: [{
            id: 1,
            staff_id: 1,
            staff_name: 'John Doe',
            status: 'assigned' as const
          }]
        },
        mockShifts[1]
      ]
      
      render(
        <DragDropTestWrapper>
          <ScheduleCalendarView {...defaultProps} shifts={shiftsWithAssignment} />
        </DragDropTestWrapper>
      )
      
      const assignedJohn = screen.getByText('John Doe')
      const eveningShift = screen.getByText('Evening Service')
      
      // Simulate moving assignment
      fireEvent.dragStart(assignedJohn, {
        dataTransfer: {
          setData: vi.fn(),
          getData: () => JSON.stringify({ 
            staffId: 1, 
            assignmentId: 1, 
            type: 'staff' 
          })
        }
      })
      fireEvent.drop(eveningShift, {
        dataTransfer: {
          getData: () => JSON.stringify({ 
            staffId: 1, 
            assignmentId: 1, 
            type: 'staff' 
          })
        }
      })
      
      // Should unassign from original shift and assign to new shift
      expect(defaultProps.onStaffUnassign).toHaveBeenCalledWith(1)
      expect(defaultProps.onStaffAssign).toHaveBeenCalledWith(2, 1)
    })
  })

  describe('Visual Feedback', () => {
    it('highlights compatible drop zones during drag', async () => {
      render(
        <DragDropTestWrapper>
          <ScheduleCalendarView {...defaultProps} />
        </DragDropTestWrapper>
      )
      
      const johnCard = screen.getByText('John Doe') // Kitchen skill
      const morningShift = screen.getByText('Morning Kitchen') // Kitchen required
      
      fireEvent.dragStart(johnCard)
      fireEvent.dragEnter(morningShift)
      
      // Should highlight compatible shift
      expect(morningShift.closest('.ring-2.ring-blue-400')).toBeTruthy()
    })

    it('shows rejection indicator for incompatible drops', async () => {
      render(
        <DragDropTestWrapper>
          <ScheduleCalendarView {...defaultProps} />
        </DragDropTestWrapper>
      )
      
      const johnCard = screen.getByText('John Doe') // Kitchen skill
      const eveningShift = screen.getByText('Evening Service') // Front of house required
      
      fireEvent.dragStart(johnCard)
      fireEvent.dragEnter(eveningShift)
      
      // Should show rejection indicator
      expect(eveningShift.closest('.ring-2.ring-red-400')).toBeTruthy()
    })

    it('updates staff availability in real-time during drag', async () => {
      render(
        <DragDropTestWrapper>
          <ScheduleCalendarView {...defaultProps} />
        </DragDropTestWrapper>
      )
      
      // Initially shows 2 available staff
      expect(screen.getByText('Available Staff (2)')).toBeInTheDocument()
      
      const johnCard = screen.getByText('John Doe')
      const morningShift = screen.getByText('Morning Kitchen')
      
      // Complete assignment
      fireEvent.dragStart(johnCard)
      fireEvent.drop(morningShift)
      
      // Should update available count (this would happen via props update in real app)
      // For this test, we verify the callback was called
      expect(defaultProps.onStaffAssign).toHaveBeenCalled()
    })
  })

  describe('Accessibility for Drag and Drop', () => {
    it('provides keyboard alternatives for drag and drop', () => {
      render(
        <DragDropTestWrapper>
          <ScheduleCalendarView {...defaultProps} />
        </DragDropTestWrapper>
      )
      
      // Staff cards should be focusable
      const staffCards = screen.getAllByText(/John Doe|Jane Smith/)
      staffCards.forEach(card => {
        expect(card.closest('[tabindex]')).toBeTruthy()
      })
    })

    it('announces drag and drop actions to screen readers', () => {
      render(
        <DragDropTestWrapper>
          <ScheduleCalendarView {...defaultProps} />
        </DragDropTestWrapper>
      )
      
      // Should have appropriate ARIA labels
      const johnCard = screen.getByText('John Doe')
      expect(johnCard.closest('[aria-label*="drag"]')).toBeTruthy()
    })
  })

  describe('Error Handling in Drag and Drop', () => {
    it('handles failed drop operations gracefully', async () => {
      const onStaffAssignError = vi.fn().mockRejectedValue(new Error('Assignment failed'))
      
      render(
        <DragDropTestWrapper>
          <ScheduleCalendarView {...defaultProps} onStaffAssign={onStaffAssignError} />
        </DragDropTestWrapper>
      )
      
      const johnCard = screen.getByText('John Doe')
      const morningShift = screen.getByText('Morning Kitchen')
      
      // Should not crash on failed assignment
      expect(() => {
        fireEvent.dragStart(johnCard)
        fireEvent.drop(morningShift)
      }).not.toThrow()
    })

    it('prevents invalid drag operations', async () => {
      render(
        <DragDropTestWrapper>
          <ScheduleCalendarView {...defaultProps} />
        </DragDropTestWrapper>
      )
      
      // Try to drag a shift (should not be draggable)
      const shiftElement = screen.getByText('Morning Kitchen')
      
      fireEvent.dragStart(shiftElement)
      
      // Should not trigger any assignment callbacks
      expect(defaultProps.onStaffAssign).not.toHaveBeenCalled()
    })
  })

  describe('Performance', () => {
    it('does not re-render unnecessarily during drag operations', async () => {
      const renderSpy = vi.fn()
      
      const TestComponent = () => {
        renderSpy()
        return <ScheduleCalendarView {...defaultProps} />
      }
      
      render(
        <DragDropTestWrapper>
          <TestComponent />
        </DragDropTestWrapper>
      )
      
      const initialRenderCount = renderSpy.mock.calls.length
      
      const johnCard = screen.getByText('John Doe')
      fireEvent.dragStart(johnCard)
      fireEvent.dragEnd(johnCard)
      
      // Should not cause excessive re-renders
      expect(renderSpy.mock.calls.length - initialRenderCount).toBeLessThan(5)
    })
  })
})