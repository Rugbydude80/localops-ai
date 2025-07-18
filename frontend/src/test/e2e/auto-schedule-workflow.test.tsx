import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AutoScheduleModal } from '@/components/AutoScheduleModal'
import { ScheduleCalendarView } from '@/components/ScheduleCalendarView'
import { DraftComparisonView } from '@/components/DraftComparisonView'

// Mock API responses
const mockAutoScheduleResponse = {
  draft_id: 'draft-123',
  shifts: [
    {
      id: 1,
      title: 'Morning Shift',
      startTime: '08:00',
      endTime: '16:00',
      date: new Date('2024-01-15'),
      requiredSkill: 'server',
      assignments: [
        {
          id: 1,
          staff_id: 1,
          staff_name: 'John Doe',
          confidence_score: 0.9,
          reasoning: 'High availability and excellent performance history'
        }
      ],
      status: 'filled',
      confidenceScore: 0.9
    }
  ],
  overall_confidence: 0.85,
  generation_params: {
    date_range: { start: '2024-01-15', end: '2024-01-21' },
    special_events: []
  }
}

const mockPublishResponse = {
  success: true,
  notifications_sent: 5,
  failed_notifications: 0,
  published_at: new Date().toISOString()
}

// Mock fetch globally
global.fetch = vi.fn()

describe('Auto-Schedule Workflow E2E Tests', () => {
  const user = userEvent.setup()
  
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock successful API responses by default
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockAutoScheduleResponse
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Complete Auto-Schedule Generation Workflow', () => {
    it('should complete full workflow from generation to publishing', async () => {
      const mockOnWeekChange = vi.fn()
      const mockOnShiftEdit = vi.fn()
      const mockOnAutoSchedule = vi.fn()

      // Step 1: Render calendar view
      render(
        <ScheduleCalendarView
          businessId={1}
          weekStart={new Date('2024-01-15')}
          onWeekChange={mockOnWeekChange}
          onShiftEdit={mockOnShiftEdit}
          onAutoSchedule={mockOnAutoSchedule}
        />
      )

      // Step 2: Click auto-schedule button
      const autoScheduleBtn = screen.getByTestId('auto-schedule-btn')
      await user.click(autoScheduleBtn)
      expect(mockOnAutoSchedule).toHaveBeenCalled()

      // Step 3: Configure auto-schedule modal
      const mockOnClose = vi.fn()
      const mockOnConfirm = vi.fn()

      render(
        <AutoScheduleModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          businessId={1}
        />
      )

      // Configure date range
      const startDateInput = screen.getByLabelText(/start date/i)
      const endDateInput = screen.getByLabelText(/end date/i)
      
      await user.clear(startDateInput)
      await user.type(startDateInput, '2024-01-15')
      await user.clear(endDateInput)
      await user.type(endDateInput, '2024-01-21')

      // Add special event
      const addEventBtn = screen.getByText(/add special event/i)
      await user.click(addEventBtn)

      const eventNameInput = screen.getByLabelText(/event name/i)
      await user.type(eventNameInput, 'Football Match')

      const eventImpactSelect = screen.getByLabelText(/expected impact/i)
      await user.selectOptions(eventImpactSelect, 'high')

      // Step 4: Generate schedule
      const generateBtn = screen.getByText(/generate schedule/i)
      await user.click(generateBtn)

      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith({
          dateRange: {
            start: expect.any(Date),
            end: expect.any(Date)
          },
          specialEvents: [{
            name: 'Football Match',
            expectedImpact: 'high',
            date: expect.any(Date)
          }],
          staffNotes: [],
          constraints: expect.any(Object)
        })
      })

      // Verify API call was made
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auto-schedule/1/generate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Football Match')
        })
      )
    })

    it('should handle draft schedule editing and comparison', async () => {
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

      render(
        <DraftComparisonView
          originalSchedule={mockOriginalSchedule}
          draftSchedule={mockDraftSchedule}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
        />
      )

      // Verify changes are highlighted
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText(/changed from/i)).toBeInTheDocument()

      // Test accepting changes
      const acceptBtn = screen.getByText(/accept change/i)
      await user.click(acceptBtn)

      // Verify change acceptance
      await waitFor(() => {
        expect(screen.getByText(/change accepted/i)).toBeInTheDocument()
      })
    })

    it('should complete publishing workflow with notifications', async () => {
      // Mock publish API response
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPublishResponse
      })

      const mockOnPublish = vi.fn()
      
      // Simulate publish button click
      render(
        <button 
          onClick={() => mockOnPublish({ 
            draftId: 'draft-123',
            notifyStaff: true,
            channels: ['whatsapp', 'email']
          })}
          data-testid="publish-schedule"
        >
          Publish Schedule
        </button>
      )

      const publishBtn = screen.getByTestId('publish-schedule')
      await user.click(publishBtn)

      expect(mockOnPublish).toHaveBeenCalledWith({
        draftId: 'draft-123',
        notifyStaff: true,
        channels: ['whatsapp', 'email']
      })

      // Verify publish API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/auto-schedule/1/publish/draft-123',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
        )
      })
    })
  })

  describe('Error Handling in Workflow', () => {
    it('should handle API failures gracefully', async () => {
      // Mock API failure
      ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

      const mockOnConfirm = vi.fn()

      render(
        <AutoScheduleModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={mockOnConfirm}
          businessId={1}
        />
      )

      const generateBtn = screen.getByText(/generate schedule/i)
      await user.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText(/error generating schedule/i)).toBeInTheDocument()
      })
    })

    it('should handle insufficient staff scenarios', async () => {
      // Mock insufficient staff response
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 'INSUFFICIENT_STAFF',
            message: 'Not enough staff with required skills',
            details: { required_skills: ['server'], available_count: 0 }
          }
        })
      })

      const mockOnConfirm = vi.fn()

      render(
        <AutoScheduleModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={mockOnConfirm}
          businessId={1}
        />
      )

      const generateBtn = screen.getByText(/generate schedule/i)
      await user.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText(/not enough staff/i)).toBeInTheDocument()
        expect(screen.getByText(/server/i)).toBeInTheDocument()
      })
    })
  })

  describe('Real-time Updates During Workflow', () => {
    it('should handle WebSocket updates during editing', async () => {
      // Mock WebSocket
      const mockWebSocket = {
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }

      global.WebSocket = vi.fn(() => mockWebSocket) as any

      const mockOnShiftEdit = vi.fn()

      render(
        <ScheduleCalendarView
          businessId={1}
          weekStart={new Date('2024-01-15')}
          onWeekChange={vi.fn()}
          onShiftEdit={mockOnShiftEdit}
          onAutoSchedule={vi.fn()}
        />
      )

      // Simulate WebSocket message for real-time update
      const wsMessageHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'message')?.[1]

      if (wsMessageHandler) {
        wsMessageHandler({
          data: JSON.stringify({
            type: 'schedule_update',
            data: {
              shift_id: 1,
              new_assignment: { staff_id: 2, staff_name: 'Jane Smith' }
            }
          })
        })
      }

      // Verify real-time update is reflected
      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      })
    })
  })

  describe('Performance Under Load', () => {
    it('should handle large datasets efficiently', async () => {
      const largeStaffList = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `Staff Member ${i + 1}`,
        skills: ['server', 'kitchen'],
        availability: []
      }))

      const largeShiftList = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        title: `Shift ${i + 1}`,
        startTime: '08:00',
        endTime: '16:00',
        date: new Date('2024-01-15'),
        assignments: []
      }))

      const startTime = performance.now()

      render(
        <ScheduleCalendarView
          businessId={1}
          weekStart={new Date('2024-01-15')}
          onWeekChange={vi.fn()}
          onShiftEdit={vi.fn()}
          onAutoSchedule={vi.fn()}
          staff={largeStaffList}
          shifts={largeShiftList}
        />
      )

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Verify render time is reasonable (less than 1 second)
      expect(renderTime).toBeLessThan(1000)

      // Verify all shifts are rendered
      expect(screen.getAllByText(/Shift \d+/)).toHaveLength(50)
    })
  })
})