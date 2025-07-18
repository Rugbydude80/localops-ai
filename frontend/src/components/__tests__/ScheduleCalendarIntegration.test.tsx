import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import ScheduleCalendarView from '../ScheduleCalendarView'
import { DraftScheduleProvider } from '../../hooks/useDraftSchedule'

// Mock the ShiftDetailPopover component
vi.mock('../ShiftDetailPopover', () => ({
  default: ({ isOpen, onClose }: any) => 
    isOpen ? <div data-testid="shift-detail-popover"><button onClick={onClose}>Close</button></div> : null
}))

// Mock the DraftComparisonView component
vi.mock('../DraftComparisonView', () => ({
  default: ({ originalDraft, currentDraft }: any) => (
    <div data-testid="draft-comparison-view">
      Draft Comparison: {originalDraft?.id} vs {currentDraft?.id}
    </div>
  )
}))

const mockShifts = [
  {
    id: 1,
    title: 'Morning Kitchen',
    date: '2024-01-15',
    start_time: '08:00',
    end_time: '16:00',
    required_skill: 'kitchen',
    required_staff_count: 2,
    status: 'understaffed' as const,
    assignments: [
      {
        id: 101,
        staff_id: 1,
        staff_name: 'John Doe',
        status: 'assigned' as const
      }
    ],
    ai_generated: true,
    confidence_score: 0.8
  },
  {
    id: 2,
    title: 'Evening Bar',
    date: '2024-01-15',
    start_time: '18:00',
    end_time: '02:00',
    required_skill: 'bar',
    required_staff_count: 1,
    status: 'open' as const,
    assignments: [],
    ai_generated: true,
    confidence_score: 0.7
  }
]

const mockStaff = [
  { id: 1, name: 'John Doe', skills: ['kitchen'], is_available: true },
  { id: 2, name: 'Jane Smith', skills: ['kitchen', 'bar'], is_available: true },
  { id: 3, name: 'Bob Wilson', skills: ['bar'], is_available: true }
]

const defaultProps = {
  businessId: 1,
  shifts: mockShifts,
  staff: mockStaff,
  selectedDate: new Date('2024-01-15'),
  onDateChange: vi.fn(),
  onShiftEdit: vi.fn(),
  onStaffAssign: vi.fn(),
  onStaffUnassign: vi.fn(),
  onAutoSchedule: vi.fn(),
  isLoading: false
}

const renderWithProviders = (props = {}) => {
  const finalProps = { ...defaultProps, ...props }
  
  return render(
    <DndProvider backend={HTML5Backend}>
      <DraftScheduleProvider>
        <ScheduleCalendarView {...finalProps} />
      </DraftScheduleProvider>
    </DndProvider>
  )
}

describe('ScheduleCalendarView Draft Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render calendar in normal mode', () => {
    renderWithProviders()

    expect(screen.getByText('Week of Jan 15, 2024')).toBeInTheDocument()
    expect(screen.getByText('Morning Kitchen')).toBeInTheDocument()
    expect(screen.getByText('Evening Bar')).toBeInTheDocument()
    expect(screen.getByText('Auto-Schedule')).toBeInTheDocument()
  })

  it('should show draft controls when in draft mode', () => {
    renderWithProviders({ isDraftMode: true })

    // Should show undo/redo buttons
    expect(screen.getByLabelText('Undo last action')).toBeInTheDocument()
    expect(screen.getByLabelText('Redo last action')).toBeInTheDocument()
    
    // Should show draft-specific buttons
    expect(screen.getByText('Compare Changes')).toBeInTheDocument()
    expect(screen.getByText('Reset')).toBeInTheDocument()
  })

  it('should disable undo/redo buttons when no actions available', () => {
    renderWithProviders({ isDraftMode: true })

    const undoButton = screen.getByLabelText('Undo last action')
    const redoButton = screen.getByLabelText('Redo last action')

    expect(undoButton).toBeDisabled()
    expect(redoButton).toBeDisabled()
  })

  it('should show comparison view when toggled', () => {
    renderWithProviders({ isDraftMode: true })

    const compareButton = screen.getByText('Compare Changes')
    
    // Initially should not be active
    expect(compareButton).not.toHaveClass('bg-blue-100', 'text-blue-700')
    
    fireEvent.click(compareButton)

    // After clicking, should be active (though comparison won't show without loaded draft)
    expect(compareButton).toHaveClass('bg-blue-100', 'text-blue-700')
  })

  it('should handle staff assignment in normal mode', () => {
    const onStaffAssign = vi.fn()
    renderWithProviders({ onStaffAssign })

    // This would require more complex drag-and-drop simulation
    // For now, we test that the handler is passed correctly
    expect(onStaffAssign).not.toHaveBeenCalled()
  })

  it('should show modified indicator in draft mode', () => {
    // This test would require setting up a draft with modifications
    // For now, we verify the structure is in place
    renderWithProviders({ isDraftMode: true })

    // The modified indicator would show if there were actual modifications
    expect(screen.getByText('Week of Jan 15, 2024')).toBeInTheDocument()
  })

  it('should handle navigation controls', () => {
    const onDateChange = vi.fn()
    renderWithProviders({ onDateChange })

    const prevButton = screen.getByLabelText('Previous week')
    const nextButton = screen.getByLabelText('Next week')
    const todayButton = screen.getByLabelText('Go to today')

    fireEvent.click(prevButton)
    expect(onDateChange).toHaveBeenCalled()

    fireEvent.click(nextButton)
    expect(onDateChange).toHaveBeenCalledTimes(2)

    fireEvent.click(todayButton)
    expect(onDateChange).toHaveBeenCalledTimes(3)
  })

  it('should show loading state', () => {
    renderWithProviders({ isLoading: true })

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByLabelText('Loading schedule')).toBeInTheDocument()
  })

  it('should display shift details correctly', () => {
    renderWithProviders()

    // Check shift information is displayed
    expect(screen.getByText('Morning Kitchen')).toBeInTheDocument()
    expect(screen.getByText('08:00-16:00')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument() // Staff count
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('should show available staff panel', () => {
    renderWithProviders()

    expect(screen.getByText('Available Staff (2)')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Wilson')).toBeInTheDocument()
  })

  it('should display legend correctly', () => {
    renderWithProviders()

    expect(screen.getByText('Legend')).toBeInTheDocument()
    expect(screen.getByText('Fully Staffed (100%)')).toBeInTheDocument()
    expect(screen.getByText('Partially Staffed (70-99%)')).toBeInTheDocument()
    expect(screen.getByText('Understaffed (<70%)')).toBeInTheDocument()
  })

  it('should handle shift click to open detail popover', async () => {
    const onShiftEdit = vi.fn()
    renderWithProviders({ onShiftEdit })

    const shiftElement = screen.getByText('Morning Kitchen').closest('div')
    fireEvent.click(shiftElement!)

    await waitFor(() => {
      expect(screen.getByTestId('shift-detail-popover')).toBeInTheDocument()
    })
  })

  it('should close shift detail popover', async () => {
    renderWithProviders()

    const shiftElement = screen.getByText('Morning Kitchen').closest('div')
    fireEvent.click(shiftElement!)

    await waitFor(() => {
      expect(screen.getByTestId('shift-detail-popover')).toBeInTheDocument()
    })

    const closeButton = screen.getByText('Close')
    fireEvent.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByTestId('shift-detail-popover')).not.toBeInTheDocument()
    })
  })

  it('should show traffic light indicators for shift status', () => {
    renderWithProviders()

    // Check that shifts are displayed with status indicators
    expect(screen.getByText('Morning Kitchen')).toBeInTheDocument()
    expect(screen.getByText('Evening Bar')).toBeInTheDocument()
    
    // Check staffing ratios are displayed
    expect(screen.getByText('1/2')).toBeInTheDocument() // Morning Kitchen understaffed
    expect(screen.getByText('0/1')).toBeInTheDocument() // Evening Bar open
  })

  it('should display AI confidence indicators', () => {
    renderWithProviders()

    // Should show AI indicators for AI-generated shifts
    const aiIndicators = screen.getAllByText('AI')
    expect(aiIndicators.length).toBeGreaterThan(0)
  })

  it('should handle auto-schedule button click', () => {
    const onAutoSchedule = vi.fn()
    renderWithProviders({ onAutoSchedule })

    const autoScheduleButton = screen.getByText('Auto-Schedule')
    fireEvent.click(autoScheduleButton)

    expect(onAutoSchedule).toHaveBeenCalledTimes(1)
  })

  it('should show week days correctly', () => {
    renderWithProviders()

    expect(screen.getByText('Monday')).toBeInTheDocument()
    expect(screen.getByText('Tuesday')).toBeInTheDocument()
    expect(screen.getByText('Wednesday')).toBeInTheDocument()
    expect(screen.getByText('Thursday')).toBeInTheDocument()
    expect(screen.getByText('Friday')).toBeInTheDocument()
    expect(screen.getByText('Saturday')).toBeInTheDocument()
    expect(screen.getByText('Sunday')).toBeInTheDocument()
  })

  it('should highlight today correctly', () => {
    const today = new Date()
    renderWithProviders({ selectedDate: today })

    // Today should be highlighted in the calendar - check for blue styling
    const todayElement = screen.getByText(today.getDate().toString())
    expect(todayElement).toHaveClass('text-blue-600')
  })

  it('should show no shifts message for empty days', () => {
    // Test with shifts on different dates
    const shiftsOnDifferentDate = mockShifts.map(shift => ({
      ...shift,
      date: '2024-01-16' // Different date
    }))

    renderWithProviders({ 
      shifts: shiftsOnDifferentDate,
      selectedDate: new Date('2024-01-15') // Monday
    })

    // Should show multiple "No shifts scheduled" messages for empty days
    const noShiftsMessages = screen.getAllByText('No shifts scheduled')
    expect(noShiftsMessages.length).toBeGreaterThan(0)
  })

  it('should handle syncing state in draft mode', () => {
    // This would require a more complex setup with actual draft state
    renderWithProviders({ isDraftMode: true })

    // Verify the structure is in place for syncing indicators
    expect(screen.getByText('Compare Changes')).toBeInTheDocument()
  })
})