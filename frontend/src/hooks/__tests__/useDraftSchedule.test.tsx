import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DraftScheduleProvider, useDraftSchedule, ScheduleDraft } from '../useDraftSchedule'
import toast from 'react-hot-toast'

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

// Mock fetch
global.fetch = vi.fn()

const mockDraft: ScheduleDraft = {
  id: 'draft-123',
  business_id: 1,
  date_range_start: '2024-01-15',
  date_range_end: '2024-01-21',
  status: 'draft',
  ai_generated: true,
  confidence_score: 0.85,
  created_at: '2024-01-15T10:00:00Z',
  modified_at: '2024-01-15T10:00:00Z',
  shifts: [
    {
      id: 1,
      title: 'Morning Kitchen',
      date: '2024-01-15',
      start_time: '08:00',
      end_time: '16:00',
      required_skill: 'kitchen',
      required_staff_count: 2,
      status: 'understaffed',
      assignments: [
        {
          id: 101,
          staff_id: 1,
          staff_name: 'John Doe',
          status: 'assigned',
          confidence_score: 0.9
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
      status: 'open',
      assignments: [],
      ai_generated: true,
      confidence_score: 0.7
    }
  ]
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DraftScheduleProvider>{children}</DraftScheduleProvider>
)

describe('useDraftSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(fetch as any).mockClear()
  })

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useDraftSchedule(), { wrapper })

    expect(result.current.state.currentDraft).toBeNull()
    expect(result.current.state.originalDraft).toBeNull()
    expect(result.current.state.history).toEqual([])
    expect(result.current.state.historyIndex).toBe(-1)
    expect(result.current.state.isModified).toBe(false)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('should load draft correctly', () => {
    const { result } = renderHook(() => useDraftSchedule(), { wrapper })

    act(() => {
      result.current.loadDraft(mockDraft)
    })

    expect(result.current.state.currentDraft).toEqual(mockDraft)
    expect(result.current.state.originalDraft).toEqual(mockDraft)
    expect(result.current.state.isModified).toBe(false)
  })

  it('should assign staff to shift', () => {
    const { result } = renderHook(() => useDraftSchedule(), { wrapper })

    act(() => {
      result.current.loadDraft(mockDraft)
    })

    act(() => {
      result.current.assignStaff(2, 2, 'Jane Smith')
    })

    const currentDraft = result.current.state.currentDraft!
    const eveningBarShift = currentDraft.shifts.find(s => s.id === 2)!
    
    expect(eveningBarShift.assignments).toHaveLength(1)
    expect(eveningBarShift.assignments[0].staff_name).toBe('Jane Smith')
    expect(eveningBarShift.assignments[0].staff_id).toBe(2)
    expect(eveningBarShift.status).toBe('filled')
    expect(result.current.state.isModified).toBe(true)
    expect(result.current.canUndo).toBe(true)
  })

  it('should not assign staff if already assigned to same shift', () => {
    const { result } = renderHook(() => useDraftSchedule(), { wrapper })

    act(() => {
      result.current.loadDraft(mockDraft)
    })

    act(() => {
      result.current.assignStaff(1, 1, 'John Doe') // Already assigned
    })

    const currentDraft = result.current.state.currentDraft!
    const morningKitchenShift = currentDraft.shifts.find(s => s.id === 1)!
    
    expect(morningKitchenShift.assignments).toHaveLength(1) // Should remain 1
    expect(result.current.state.isModified).toBe(false) // No change
  })

  it('should unassign staff from shift', () => {
    const { result } = renderHook(() => useDraftSchedule(), { wrapper })

    act(() => {
      result.current.loadDraft(mockDraft)
    })

    act(() => {
      result.current.unassignStaff(101)
    })

    const currentDraft = result.current.state.currentDraft!
    const morningKitchenShift = currentDraft.shifts.find(s => s.id === 1)!
    
    expect(morningKitchenShift.assignments).toHaveLength(0)
    expect(morningKitchenShift.status).toBe('open')
    expect(result.current.state.isModified).toBe(true)
    expect(result.current.canUndo).toBe(true)
  })

  it('should handle undo functionality', () => {
    const { result } = renderHook(() => useDraftSchedule(), { wrapper })

    act(() => {
      result.current.loadDraft(mockDraft)
    })

    // Assign staff
    act(() => {
      result.current.assignStaff(2, 2, 'Jane Smith')
    })

    expect(result.current.state.isModified).toBe(true)

    // Undo
    act(() => {
      result.current.undo()
    })

    const currentDraft = result.current.state.currentDraft!
    const eveningBarShift = currentDraft.shifts.find(s => s.id === 2)!
    
    expect(eveningBarShift.assignments).toHaveLength(0)
    expect(result.current.state.isModified).toBe(false)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
    expect(toast.success).toHaveBeenCalledWith('Action undone')
  })

  it('should handle redo functionality', () => {
    const { result } = renderHook(() => useDraftSchedule(), { wrapper })

    act(() => {
      result.current.loadDraft(mockDraft)
    })

    // Assign staff
    act(() => {
      result.current.assignStaff(2, 2, 'Jane Smith')
    })

    // Undo
    act(() => {
      result.current.undo()
    })

    // Redo
    act(() => {
      result.current.redo()
    })

    const currentDraft = result.current.state.currentDraft!
    const eveningBarShift = currentDraft.shifts.find(s => s.id === 2)!
    
    expect(eveningBarShift.assignments).toHaveLength(1)
    expect(eveningBarShift.assignments[0].staff_name).toBe('Jane Smith')
    expect(result.current.state.isModified).toBe(true)
    expect(result.current.canRedo).toBe(false)
    expect(toast.success).toHaveBeenCalledWith('Action redone')
  })

  it('should handle move staff between shifts', () => {
    const { result } = renderHook(() => useDraftSchedule(), { wrapper })

    act(() => {
      result.current.loadDraft(mockDraft)
    })

    // Move John from shift 1 to shift 2
    act(() => {
      result.current.moveStaff(101, 1, 2)
    })

    const currentDraft = result.current.state.currentDraft!
    const morningKitchenShift = currentDraft.shifts.find(s => s.id === 1)!
    const eveningBarShift = currentDraft.shifts.find(s => s.id === 2)!
    
    expect(morningKitchenShift.assignments).toHaveLength(0)
    expect(morningKitchenShift.status).toBe('open')
    expect(eveningBarShift.assignments).toHaveLength(1)
    expect(eveningBarShift.assignments[0].staff_name).toBe('John Doe')
    expect(eveningBarShift.status).toBe('filled')
    expect(result.current.state.isModified).toBe(true)
  })

  it('should not move staff if already assigned to target shift', () => {
    const { result } = renderHook(() => useDraftSchedule(), { wrapper })

    // Create a draft where John is assigned to both shifts
    const modifiedDraft = {
      ...mockDraft,
      shifts: [
        mockDraft.shifts[0], // Keep original shift 1 with John
        {
          ...mockDraft.shifts[1],
          assignments: [
            {
              id: 102,
              staff_id: 1,
              staff_name: 'John Doe',
              status: 'assigned' as const
            }
          ]
        }
      ]
    }

    act(() => {
      result.current.loadDraft(modifiedDraft)
    })

    act(() => {
      result.current.moveStaff(101, 1, 2) // Try to move John from shift 1 to shift 2
    })

    // Should not change anything since John is already in shift 2
    expect(result.current.state.isModified).toBe(false)
  })

  it('should reset draft to original state', () => {
    const { result } = renderHook(() => useDraftSchedule(), { wrapper })

    act(() => {
      result.current.loadDraft(mockDraft)
    })

    // Make some changes
    act(() => {
      result.current.assignStaff(2, 2, 'Jane Smith')
    })

    expect(result.current.state.isModified).toBe(true)

    // Reset
    act(() => {
      result.current.resetDraft()
    })

    expect(result.current.state.currentDraft).toEqual(mockDraft)
    expect(result.current.state.isModified).toBe(false)
    expect(result.current.state.history).toEqual([])
    expect(result.current.state.historyIndex).toBe(-1)
    expect(toast.success).toHaveBeenCalledWith('Draft reset to original state')
  })

  it('should generate change summary', () => {
    const { result } = renderHook(() => useDraftSchedule(), { wrapper })

    act(() => {
      result.current.loadDraft(mockDraft)
    })

    // Make changes
    act(() => {
      result.current.assignStaff(2, 2, 'Jane Smith')
    })

    act(() => {
      result.current.unassignStaff(101)
    })

    const changes = result.current.getChangeSummary()
    
    expect(changes).toContain('Assigned Jane Smith to Evening Bar')
    expect(changes).toContain('Unassigned John Doe from Morning Kitchen')
  })

  it('should handle sync draft successfully', async () => {
    const { result } = renderHook(() => useDraftSchedule(), { wrapper })

    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    })

    act(() => {
      result.current.loadDraft(mockDraft)
    })

    act(() => {
      result.current.assignStaff(2, 2, 'Jane Smith')
    })

    await act(async () => {
      await result.current.syncDraft()
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/auto-schedule/1/draft/draft-123',
      expect.objectContaining({
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('Jane Smith')
      })
    )

    expect(result.current.state.isSyncing).toBe(false)
    expect(result.current.state.lastSyncTime).toBeTruthy()
    expect(result.current.state.syncError).toBeNull()
  })

  it('should handle sync draft error', async () => {
    const { result } = renderHook(() => useDraftSchedule(), { wrapper })

    ;(fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500
    })

    act(() => {
      result.current.loadDraft(mockDraft)
    })

    act(() => {
      result.current.assignStaff(2, 2, 'Jane Smith')
    })

    await act(async () => {
      await result.current.syncDraft()
    })

    expect(result.current.state.isSyncing).toBe(false)
    expect(result.current.state.syncError).toBe('Failed to sync draft')
  })

  it('should not sync if no changes made', async () => {
    const { result } = renderHook(() => useDraftSchedule(), { wrapper })

    act(() => {
      result.current.loadDraft(mockDraft)
    })

    await act(async () => {
      await result.current.syncDraft()
    })

    expect(fetch).not.toHaveBeenCalled()
  })

  it('should handle complex undo scenarios', () => {
    const { result } = renderHook(() => useDraftSchedule(), { wrapper })

    act(() => {
      result.current.loadDraft(mockDraft)
    })

    // Multiple actions
    act(() => {
      result.current.assignStaff(2, 2, 'Jane Smith')
    })

    act(() => {
      result.current.assignStaff(1, 3, 'Bob Wilson')
    })

    act(() => {
      result.current.unassignStaff(101)
    })

    expect(result.current.state.history).toHaveLength(3)
    expect(result.current.canUndo).toBe(true)

    // Undo last action (unassign John)
    act(() => {
      result.current.undo()
    })

    let currentDraft = result.current.state.currentDraft!
    let morningKitchenShift = currentDraft.shifts.find(s => s.id === 1)!
    expect(morningKitchenShift.assignments).toHaveLength(2) // John should be back

    // Undo second action (assign Bob)
    act(() => {
      result.current.undo()
    })

    currentDraft = result.current.state.currentDraft!
    morningKitchenShift = currentDraft.shifts.find(s => s.id === 1)!
    expect(morningKitchenShift.assignments).toHaveLength(1) // Only John

    // Undo first action (assign Jane)
    act(() => {
      result.current.undo()
    })

    currentDraft = result.current.state.currentDraft!
    const eveningBarShift = currentDraft.shifts.find(s => s.id === 2)!
    expect(eveningBarShift.assignments).toHaveLength(0) // Jane should be gone

    expect(result.current.state.isModified).toBe(false)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
  })

  it('should update shift status correctly based on assignments', () => {
    const { result } = renderHook(() => useDraftSchedule(), { wrapper })

    act(() => {
      result.current.loadDraft(mockDraft)
    })

    // Assign second staff to morning kitchen (required: 2)
    act(() => {
      result.current.assignStaff(1, 2, 'Jane Smith')
    })

    const currentDraft = result.current.state.currentDraft!
    const morningKitchenShift = currentDraft.shifts.find(s => s.id === 1)!
    
    expect(morningKitchenShift.assignments).toHaveLength(2)
    expect(morningKitchenShift.status).toBe('filled') // Should be filled now
  })
})