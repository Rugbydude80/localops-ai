import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScheduleCalendarView } from '@/components/ScheduleCalendarView'
import { AutoScheduleModal } from '@/components/AutoScheduleModal'
import { DraftComparisonView } from '@/components/DraftComparisonView'
import { ConfidenceIndicator } from '@/components/ConfidenceIndicator'
import { ReasoningDisplay } from '@/components/ReasoningDisplay'

// Mock data for consistent visual testing
const mockStaff = [
  { id: 1, name: 'John Doe', skills: ['server'], availability: [], hourly_rate: 15.0 },
  { id: 2, name: 'Jane Smith', skills: ['cook'], availability: [], hourly_rate: 18.0 },
  { id: 3, name: 'Bob Johnson', skills: ['bartender'], availability: [], hourly_rate: 16.0 },
  { id: 4, name: 'Alice Brown', skills: ['host'], availability: [], hourly_rate: 14.0 }
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
    title: 'Lunch Rush',
    startTime: '11:00',
    endTime: '15:00',
    date: new Date('2024-01-15'),
    requiredSkill: 'server',
    assignments: [
      { id: 2, staff_id: 2, staff_name: 'Jane Smith' },
      { id: 3, staff_id: 3, staff_name: 'Bob Johnson' }
    ],
    status: 'filled',
    confidenceScore: 0.85
  },
  {
    id: 3,
    title: 'Evening Shift',
    startTime: '16:00',
    endTime: '24:00',
    date: new Date('2024-01-15'),
    requiredSkill: 'cook',
    assignments: [],
    status: 'open',
    confidenceScore: 0.0
  },
  {
    id: 4,
    title: 'Weekend Brunch',
    startTime: '09:00',
    endTime: '15:00',
    date: new Date('2024-01-16'),
    requiredSkill: 'server',
    assignments: [{ id: 4, staff_id: 4, staff_name: 'Alice Brown' }],
    status: 'understaffed',
    confidenceScore: 0.6
  }
]

// Visual testing utilities
const takeSnapshot = (container: HTMLElement, testName: string) => {
  // In a real implementation, this would capture and compare screenshots
  // For this test, we'll simulate by checking key visual elements
  const snapshot = {
    testName,
    timestamp: new Date().toISOString(),
    elements: Array.from(container.querySelectorAll('[data-testid]')).map(el => ({
      testId: el.getAttribute('data-testid'),
      className: el.className,
      textContent: el.textContent?.trim(),
      styles: window.getComputedStyle(el)
    }))
  }
  return snapshot
}

const compareSnapshots = (current: any, baseline: any) => {
  // Simplified comparison - in real implementation would use image diff
  const differences = []
  
  if (current.elements.length !== baseline.elements.length) {
    differences.push(`Element count mismatch: ${current.elements.length} vs ${baseline.elements.length}`)
  }
  
  current.elements.forEach((currentEl: any, index: number) => {
    const baselineEl = baseline.elements[index]
    if (!baselineEl) return
    
    if (currentEl.className !== baselineEl.className) {
      differences.push(`Class mismatch for ${currentEl.testId}: ${currentEl.className} vs ${baselineEl.className}`)
    }
    
    if (currentEl.textContent !== baselineEl.textContent) {
      differences.push(`Text mismatch for ${currentEl.testId}: ${currentEl.textContent} vs ${baselineEl.textContent}`)
    }
  })
  
  return differences
}

describe('Visual Regression Tests', () => {
  const user = userEvent.setup()

  describe('ScheduleCalendarView Visual Tests', () => {
    it('should match baseline for default calendar view', () => {
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

      const snapshot = takeSnapshot(container, 'calendar-default-view')
      
      // Verify key visual elements are present
      expect(screen.getByTestId('calendar-grid')).toBeInTheDocument()
      expect(screen.getByTestId('week-navigation')).toBeInTheDocument()
      expect(screen.getByTestId('auto-schedule-btn')).toBeInTheDocument()
      
      // Check shift status colors
      const filledShift = screen.getByTestId('shift-1')
      expect(filledShift).toHaveClass('bg-green-100', 'border-green-500')
      
      const openShift = screen.getByTestId('shift-3')
      expect(openShift).toHaveClass('bg-red-100', 'border-red-500')
      
      const understaffedShift = screen.getByTestId('shift-4')
      expect(understaffedShift).toHaveClass('bg-yellow-100', 'border-yellow-500')
    })

    it('should match baseline for different shift statuses', () => {
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

      // Test each shift status visual appearance
      const shifts = screen.getAllByTestId(/^shift-\d+$/)
      
      shifts.forEach(shift => {
        const shiftData = mockShifts.find(s => shift.getAttribute('data-testid') === `shift-${s.id}`)
        if (!shiftData) return
        
        switch (shiftData.status) {
          case 'filled':
            expect(shift).toHaveClass('bg-green-100')
            expect(shift.querySelector('[data-testid="status-indicator"]')).toHaveClass('text-green-600')
            break
          case 'open':
            expect(shift).toHaveClass('bg-red-100')
            expect(shift.querySelector('[data-testid="status-indicator"]')).toHaveClass('text-red-600')
            break
          case 'understaffed':
            expect(shift).toHaveClass('bg-yellow-100')
            expect(shift.querySelector('[data-testid="status-indicator"]')).toHaveClass('text-yellow-600')
            break
        }
      })
    })

    it('should match baseline for confidence score indicators', () => {
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

      // Check confidence score visual indicators
      const highConfidenceShift = screen.getByTestId('shift-1')
      const confidenceIndicator = highConfidenceShift.querySelector('[data-testid="confidence-indicator"]')
      expect(confidenceIndicator).toHaveClass('bg-green-500')
      expect(confidenceIndicator).toHaveStyle({ width: '90%' })

      const mediumConfidenceShift = screen.getByTestId('shift-2')
      const mediumIndicator = mediumConfidenceShift.querySelector('[data-testid="confidence-indicator"]')
      expect(mediumIndicator).toHaveClass('bg-yellow-500')
      expect(mediumIndicator).toHaveStyle({ width: '85%' })

      const lowConfidenceShift = screen.getByTestId('shift-4')
      const lowIndicator = lowConfidenceShift.querySelector('[data-testid="confidence-indicator"]')
      expect(lowIndicator).toHaveClass('bg-orange-500')
      expect(lowIndicator).toHaveStyle({ width: '60%' })
    })

    it('should match baseline for drag and drop states', async () => {
      render(
        <ScheduleCalendarView
          businessId={1}
          weekStart={new Date('2024-01-15')}
          onWeekChange={vi.fn()}
          onShiftEdit={vi.fn()}
          onAutoSchedule={vi.fn()}
          staff={mockStaff}
          shifts={mockShifts}
          enableDragDrop={true}
        />
      )

      // Test drag state
      const draggableStaff = screen.getByTestId('staff-1')
      fireEvent.dragStart(draggableStaff)
      
      expect(draggableStaff).toHaveClass('opacity-50')
      
      // Test drop zone highlighting
      const dropZone = screen.getByTestId('shift-3')
      fireEvent.dragEnter(dropZone)
      
      expect(dropZone).toHaveClass('border-blue-500', 'bg-blue-50')
      
      fireEvent.dragLeave(dropZone)
      expect(dropZone).not.toHaveClass('border-blue-500', 'bg-blue-50')
    })

    it('should match baseline for responsive layout', () => {
      // Test mobile layout
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })
      
      const { container, rerender } = render(
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

      const mobileCalendar = screen.getByTestId('calendar-grid')
      expect(mobileCalendar).toHaveClass('grid-cols-1', 'md:grid-cols-7')

      // Test desktop layout
      Object.defineProperty(window, 'innerWidth', {
        value: 1024,
      })

      rerender(
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

      const desktopCalendar = screen.getByTestId('calendar-grid')
      expect(desktopCalendar).toHaveClass('grid-cols-7')
    })
  })

  describe('AutoScheduleModal Visual Tests', () => {
    it('should match baseline for modal appearance', () => {
      render(
        <AutoScheduleModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          businessId={1}
        />
      )

      const modal = screen.getByTestId('auto-schedule-modal')
      expect(modal).toHaveClass('fixed', 'inset-0', 'z-50')
      
      const modalContent = screen.getByTestId('modal-content')
      expect(modalContent).toHaveClass('bg-white', 'rounded-lg', 'shadow-xl')
      
      const backdrop = screen.getByTestId('modal-backdrop')
      expect(backdrop).toHaveClass('bg-black', 'bg-opacity-50')
    })

    it('should match baseline for form elements', () => {
      render(
        <AutoScheduleModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          businessId={1}
        />
      )

      const startDateInput = screen.getByTestId('start-date-input')
      expect(startDateInput).toHaveClass('border', 'rounded-md', 'px-3', 'py-2')
      
      const endDateInput = screen.getByTestId('end-date-input')
      expect(endDateInput).toHaveClass('border', 'rounded-md', 'px-3', 'py-2')
      
      const generateButton = screen.getByTestId('generate-button')
      expect(generateButton).toHaveClass('bg-blue-600', 'text-white', 'rounded-md')
    })

    it('should match baseline for loading state', async () => {
      const mockOnConfirm = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      render(
        <AutoScheduleModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={mockOnConfirm}
          businessId={1}
        />
      )

      const generateButton = screen.getByTestId('generate-button')
      await user.click(generateButton)

      await waitFor(() => {
        expect(generateButton).toHaveClass('opacity-50', 'cursor-not-allowed')
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      })
    })

    it('should match baseline for error states', async () => {
      render(
        <AutoScheduleModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          businessId={1}
        />
      )

      // Trigger validation error
      const generateButton = screen.getByTestId('generate-button')
      await user.click(generateButton)

      await waitFor(() => {
        const errorMessage = screen.getByTestId('error-message')
        expect(errorMessage).toHaveClass('text-red-600', 'bg-red-50', 'border-red-200')
      })
    })
  })

  describe('ConfidenceIndicator Visual Tests', () => {
    it('should match baseline for different confidence levels', () => {
      const { rerender } = render(
        <ConfidenceIndicator score={0.9} size="medium" />
      )

      let indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('bg-green-500')
      expect(indicator.querySelector('[data-testid="confidence-bar"]')).toHaveStyle({ width: '90%' })

      rerender(<ConfidenceIndicator score={0.6} size="medium" />)
      indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('bg-yellow-500')

      rerender(<ConfidenceIndicator score={0.3} size="medium" />)
      indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('bg-red-500')
    })

    it('should match baseline for different sizes', () => {
      const { rerender } = render(
        <ConfidenceIndicator score={0.8} size="small" />
      )

      let indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('h-2', 'w-16')

      rerender(<ConfidenceIndicator score={0.8} size="medium" />)
      indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('h-3', 'w-24')

      rerender(<ConfidenceIndicator score={0.8} size="large" />)
      indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('h-4', 'w-32')
    })
  })

  describe('ReasoningDisplay Visual Tests', () => {
    const mockReasoning = {
      factors: [
        { name: 'Availability', weight: 0.4, score: 0.9, description: 'Staff member is available during shift hours' },
        { name: 'Skills Match', weight: 0.3, score: 0.8, description: 'Has required server skills' },
        { name: 'Performance', weight: 0.2, score: 0.95, description: 'Excellent performance history' },
        { name: 'Preferences', weight: 0.1, score: 0.7, description: 'Prefers morning shifts' }
      ],
      overall_score: 0.85,
      explanation: 'John Doe is an excellent match for this shift based on availability and performance.'
    }

    it('should match baseline for reasoning display', () => {
      render(
        <ReasoningDisplay reasoning={mockReasoning} />
      )

      const reasoningContainer = screen.getByTestId('reasoning-display')
      expect(reasoningContainer).toHaveClass('bg-gray-50', 'rounded-lg', 'p-4')

      const factorsList = screen.getByTestId('reasoning-factors')
      expect(factorsList).toBeInTheDocument()

      mockReasoning.factors.forEach((factor, index) => {
        const factorElement = screen.getByTestId(`factor-${index}`)
        expect(factorElement).toHaveClass('flex', 'justify-between', 'items-center')
        
        const scoreBar = factorElement.querySelector('[data-testid="factor-score-bar"]')
        expect(scoreBar).toHaveStyle({ width: `${factor.score * 100}%` })
      })
    })

    it('should match baseline for expanded reasoning view', async () => {
      render(
        <ReasoningDisplay reasoning={mockReasoning} expandable={true} />
      )

      const expandButton = screen.getByTestId('expand-reasoning')
      await user.click(expandButton)

      await waitFor(() => {
        const expandedView = screen.getByTestId('expanded-reasoning')
        expect(expandedView).toBeInTheDocument()
        expect(expandedView).toHaveClass('mt-4', 'border-t', 'pt-4')
      })
    })
  })

  describe('DraftComparisonView Visual Tests', () => {
    const mockOriginalSchedule = {
      shifts: [
        {
          id: 1,
          title: 'Morning Shift',
          assignments: [{ id: 1, staff_id: 1, staff_name: 'John Doe' }]
        }
      ]
    }

    const mockDraftSchedule = {
      shifts: [
        {
          id: 1,
          title: 'Morning Shift',
          assignments: [{ id: 2, staff_id: 2, staff_name: 'Jane Smith' }]
        }
      ]
    }

    it('should match baseline for comparison view', () => {
      render(
        <DraftComparisonView
          originalSchedule={mockOriginalSchedule}
          draftSchedule={mockDraftSchedule}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
        />
      )

      const comparisonContainer = screen.getByTestId('draft-comparison')
      expect(comparisonContainer).toHaveClass('grid', 'grid-cols-2', 'gap-4')

      const originalColumn = screen.getByTestId('original-schedule')
      expect(originalColumn).toHaveClass('bg-gray-50')

      const draftColumn = screen.getByTestId('draft-schedule')
      expect(draftColumn).toHaveClass('bg-blue-50')

      const changeIndicator = screen.getByTestId('change-indicator')
      expect(changeIndicator).toHaveClass('bg-yellow-200', 'border-yellow-400')
    })

    it('should match baseline for change highlighting', () => {
      render(
        <DraftComparisonView
          originalSchedule={mockOriginalSchedule}
          draftSchedule={mockDraftSchedule}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
        />
      )

      const removedAssignment = screen.getByTestId('removed-assignment')
      expect(removedAssignment).toHaveClass('bg-red-100', 'line-through')

      const addedAssignment = screen.getByTestId('added-assignment')
      expect(addedAssignment).toHaveClass('bg-green-100', 'font-semibold')
    })
  })

  describe('Dark Mode Visual Tests', () => {
    beforeEach(() => {
      // Mock dark mode
      document.documentElement.classList.add('dark')
    })

    it('should match baseline for dark mode calendar', () => {
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

      const calendar = screen.getByTestId('calendar-grid')
      expect(calendar).toHaveClass('dark:bg-gray-800')

      const filledShift = screen.getByTestId('shift-1')
      expect(filledShift).toHaveClass('dark:bg-green-900', 'dark:border-green-400')
    })

    it('should match baseline for dark mode modal', () => {
      render(
        <AutoScheduleModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          businessId={1}
        />
      )

      const modalContent = screen.getByTestId('modal-content')
      expect(modalContent).toHaveClass('dark:bg-gray-800', 'dark:text-white')

      const input = screen.getByTestId('start-date-input')
      expect(input).toHaveClass('dark:bg-gray-700', 'dark:border-gray-600')
    })
  })

  describe('Print Styles Visual Tests', () => {
    it('should match baseline for print layout', () => {
      // Mock print media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === 'print',
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

      const calendar = screen.getByTestId('calendar-grid')
      expect(calendar).toHaveClass('print:shadow-none')

      const navigationControls = screen.getByTestId('week-navigation')
      expect(navigationControls).toHaveClass('print:hidden')
    })
  })
})