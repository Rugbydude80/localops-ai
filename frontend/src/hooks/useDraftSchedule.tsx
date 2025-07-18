import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

// Types
export interface DraftShift {
  id: number
  title: string
  date: string
  start_time: string
  end_time: string
  required_skill: string
  required_staff_count: number
  hourly_rate?: number
  status: 'open' | 'filled' | 'understaffed' | 'scheduled'
  assignments: DraftAssignment[]
  confidence_score?: number
  ai_generated?: boolean
  is_modified?: boolean
  original_assignments?: DraftAssignment[]
}

export interface DraftAssignment {
  id: number
  staff_id: number
  staff_name: string
  status: 'assigned' | 'called_in_sick' | 'no_show'
  confidence_score?: number
  reasoning?: string
  is_modified?: boolean
}

export interface ScheduleDraft {
  id: string
  business_id: number
  date_range_start: string
  date_range_end: string
  status: 'draft' | 'published' | 'archived'
  ai_generated: boolean
  confidence_score?: number
  shifts: DraftShift[]
  created_at: string
  modified_at: string
}

export interface DraftAction {
  type: string
  payload: any
  timestamp: number
  description: string
}

interface DraftState {
  currentDraft: ScheduleDraft | null
  originalDraft: ScheduleDraft | null
  history: DraftAction[]
  historyIndex: number
  isModified: boolean
  isSyncing: boolean
  lastSyncTime: number | null
  syncError: string | null
}

// Action types
const DRAFT_ACTIONS = {
  LOAD_DRAFT: 'LOAD_DRAFT',
  ASSIGN_STAFF: 'ASSIGN_STAFF',
  UNASSIGN_STAFF: 'UNASSIGN_STAFF',
  MOVE_STAFF: 'MOVE_STAFF',
  UPDATE_SHIFT: 'UPDATE_SHIFT',
  CREATE_SHIFT: 'CREATE_SHIFT',
  DELETE_SHIFT: 'DELETE_SHIFT',
  UNDO: 'UNDO',
  REDO: 'REDO',
  SYNC_START: 'SYNC_START',
  SYNC_SUCCESS: 'SYNC_SUCCESS',
  SYNC_ERROR: 'SYNC_ERROR',
  RESET_DRAFT: 'RESET_DRAFT'
} as const

// Initial state
const initialState: DraftState = {
  currentDraft: null,
  originalDraft: null,
  history: [],
  historyIndex: -1,
  isModified: false,
  isSyncing: false,
  lastSyncTime: null,
  syncError: null
}

// Reducer
function draftReducer(state: DraftState, action: { type: string; payload?: any }): DraftState {
  switch (action.type) {
    case DRAFT_ACTIONS.LOAD_DRAFT: {
      const draft = action.payload as ScheduleDraft
      return {
        ...state,
        currentDraft: draft,
        originalDraft: JSON.parse(JSON.stringify(draft)), // Deep clone
        history: [],
        historyIndex: -1,
        isModified: false,
        syncError: null
      }
    }

    case DRAFT_ACTIONS.ASSIGN_STAFF: {
      if (!state.currentDraft) return state
      
      const { shiftId, staffId, staffName } = action.payload
      const newDraft = JSON.parse(JSON.stringify(state.currentDraft))
      const shift = newDraft.shifts.find((s: DraftShift) => s.id === shiftId)
      
      if (!shift) return state

      // Check if staff is already assigned to this shift
      const existingAssignment = shift.assignments.find((a: DraftAssignment) => a.staff_id === staffId)
      if (existingAssignment) return state

      // Create new assignment
      const newAssignment: DraftAssignment = {
        id: Date.now(), // Temporary ID for new assignments
        staff_id: staffId,
        staff_name: staffName,
        status: 'assigned',
        is_modified: true
      }

      shift.assignments.push(newAssignment)
      shift.is_modified = true
      shift.status = shift.assignments.length >= shift.required_staff_count ? 'filled' : 'understaffed'

      const draftAction: DraftAction = {
        type: DRAFT_ACTIONS.ASSIGN_STAFF,
        payload: action.payload,
        timestamp: Date.now(),
        description: `Assigned ${staffName} to ${shift.title}`
      }

      return {
        ...state,
        currentDraft: newDraft,
        history: [...state.history.slice(0, state.historyIndex + 1), draftAction],
        historyIndex: state.historyIndex + 1,
        isModified: true
      }
    }

    case DRAFT_ACTIONS.UNASSIGN_STAFF: {
      if (!state.currentDraft) return state
      
      const { assignmentId } = action.payload
      const newDraft = JSON.parse(JSON.stringify(state.currentDraft))
      
      let targetShift: DraftShift | null = null
      let targetAssignment: DraftAssignment | null = null

      // Find the assignment and shift
      for (const shift of newDraft.shifts) {
        const assignment = shift.assignments.find((a: DraftAssignment) => a.id === assignmentId)
        if (assignment) {
          targetShift = shift
          targetAssignment = assignment
          break
        }
      }

      if (!targetShift || !targetAssignment) return state

      // Remove assignment
      targetShift.assignments = targetShift.assignments.filter((a: DraftAssignment) => a.id !== assignmentId)
      targetShift.is_modified = true
      targetShift.status = targetShift.assignments.length >= targetShift.required_staff_count ? 'filled' : 
                          targetShift.assignments.length > 0 ? 'understaffed' : 'open'

      const draftAction: DraftAction = {
        type: DRAFT_ACTIONS.UNASSIGN_STAFF,
        payload: { 
          ...action.payload, 
          staffId: targetAssignment.staff_id,
          staffName: targetAssignment.staff_name, 
          shiftTitle: targetShift.title,
          shiftId: targetShift.id
        },
        timestamp: Date.now(),
        description: `Unassigned ${targetAssignment.staff_name} from ${targetShift.title}`
      }

      return {
        ...state,
        currentDraft: newDraft,
        history: [...state.history.slice(0, state.historyIndex + 1), draftAction],
        historyIndex: state.historyIndex + 1,
        isModified: true
      }
    }

    case DRAFT_ACTIONS.MOVE_STAFF: {
      if (!state.currentDraft) return state
      
      const { assignmentId, fromShiftId, toShiftId } = action.payload
      const newDraft = JSON.parse(JSON.stringify(state.currentDraft))
      
      const fromShift = newDraft.shifts.find((s: DraftShift) => s.id === fromShiftId)
      const toShift = newDraft.shifts.find((s: DraftShift) => s.id === toShiftId)
      
      if (!fromShift || !toShift) return state

      const assignment = fromShift.assignments.find((a: DraftAssignment) => a.id === assignmentId)
      if (!assignment) return state

      // Check if staff is already assigned to target shift
      const existingAssignment = toShift.assignments.find((a: DraftAssignment) => a.staff_id === assignment.staff_id)
      if (existingAssignment) return state

      // Move assignment
      fromShift.assignments = fromShift.assignments.filter((a: DraftAssignment) => a.id !== assignmentId)
      toShift.assignments.push({ ...assignment, is_modified: true })

      // Update shift statuses
      fromShift.is_modified = true
      toShift.is_modified = true
      fromShift.status = fromShift.assignments.length >= fromShift.required_staff_count ? 'filled' : 
                        fromShift.assignments.length > 0 ? 'understaffed' : 'open'
      toShift.status = toShift.assignments.length >= toShift.required_staff_count ? 'filled' : 'understaffed'

      const draftAction: DraftAction = {
        type: DRAFT_ACTIONS.MOVE_STAFF,
        payload: { ...action.payload, staffName: assignment.staff_name, fromShiftTitle: fromShift.title, toShiftTitle: toShift.title },
        timestamp: Date.now(),
        description: `Moved ${assignment.staff_name} from ${fromShift.title} to ${toShift.title}`
      }

      return {
        ...state,
        currentDraft: newDraft,
        history: [...state.history.slice(0, state.historyIndex + 1), draftAction],
        historyIndex: state.historyIndex + 1,
        isModified: true
      }
    }

    case DRAFT_ACTIONS.UNDO: {
      if (state.historyIndex < 0) return state

      const actionToUndo = state.history[state.historyIndex]
      let newDraft = JSON.parse(JSON.stringify(state.currentDraft))

      // Reverse the action
      switch (actionToUndo.type) {
        case DRAFT_ACTIONS.ASSIGN_STAFF: {
          const { shiftId, staffId } = actionToUndo.payload
          const shift = newDraft.shifts.find((s: DraftShift) => s.id === shiftId)
          if (shift) {
            shift.assignments = shift.assignments.filter((a: DraftAssignment) => a.staff_id !== staffId)
            shift.status = shift.assignments.length >= shift.required_staff_count ? 'filled' : 
                          shift.assignments.length > 0 ? 'understaffed' : 'open'
          }
          break
        }
        case DRAFT_ACTIONS.UNASSIGN_STAFF: {
          const { assignmentId, staffId, staffName, shiftId } = actionToUndo.payload
          const shift = newDraft.shifts.find((s: DraftShift) => s.id === shiftId)
          if (shift) {
            shift.assignments.push({
              id: assignmentId,
              staff_id: staffId,
              staff_name: staffName,
              status: 'assigned',
              is_modified: true
            })
            shift.status = shift.assignments.length >= shift.required_staff_count ? 'filled' : 'understaffed'
          }
          break
        }
        case DRAFT_ACTIONS.MOVE_STAFF: {
          const { assignmentId, fromShiftId, toShiftId, staffId, staffName } = actionToUndo.payload
          const fromShift = newDraft.shifts.find((s: DraftShift) => s.id === fromShiftId)
          const toShift = newDraft.shifts.find((s: DraftShift) => s.id === toShiftId)
          
          if (fromShift && toShift) {
            // Remove from toShift
            toShift.assignments = toShift.assignments.filter((a: DraftAssignment) => a.staff_id !== staffId)
            // Add back to fromShift
            fromShift.assignments.push({
              id: assignmentId,
              staff_id: staffId,
              staff_name: staffName,
              status: 'assigned',
              is_modified: true
            })
            
            fromShift.status = fromShift.assignments.length >= fromShift.required_staff_count ? 'filled' : 'understaffed'
            toShift.status = toShift.assignments.length >= toShift.required_staff_count ? 'filled' : 
                            toShift.assignments.length > 0 ? 'understaffed' : 'open'
          }
          break
        }
      }

      return {
        ...state,
        currentDraft: newDraft,
        historyIndex: state.historyIndex - 1,
        isModified: state.historyIndex > 0
      }
    }

    case DRAFT_ACTIONS.REDO: {
      if (state.historyIndex >= state.history.length - 1) return state

      const actionToRedo = state.history[state.historyIndex + 1]
      
      // Re-apply the action by dispatching it again
      return draftReducer(
        { ...state, historyIndex: state.historyIndex + 1 },
        { type: actionToRedo.type, payload: actionToRedo.payload }
      )
    }

    case DRAFT_ACTIONS.SYNC_START: {
      return {
        ...state,
        isSyncing: true,
        syncError: null
      }
    }

    case DRAFT_ACTIONS.SYNC_SUCCESS: {
      return {
        ...state,
        isSyncing: false,
        lastSyncTime: Date.now(),
        syncError: null
      }
    }

    case DRAFT_ACTIONS.SYNC_ERROR: {
      return {
        ...state,
        isSyncing: false,
        syncError: action.payload.error
      }
    }

    case DRAFT_ACTIONS.RESET_DRAFT: {
      if (!state.originalDraft) return state
      
      return {
        ...state,
        currentDraft: JSON.parse(JSON.stringify(state.originalDraft)),
        history: [],
        historyIndex: -1,
        isModified: false,
        syncError: null
      }
    }

    default:
      return state
  }
}

// Context
interface DraftScheduleContextType {
  state: DraftState
  loadDraft: (draft: ScheduleDraft) => void
  assignStaff: (shiftId: number, staffId: number, staffName: string) => void
  unassignStaff: (assignmentId: number) => void
  moveStaff: (assignmentId: number, fromShiftId: number, toShiftId: number) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  syncDraft: () => Promise<void>
  resetDraft: () => void
  getChangeSummary: () => string[]
}

const DraftScheduleContext = createContext<DraftScheduleContextType | null>(null)

// Provider component
export function DraftScheduleProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(draftReducer, initialState)

  // Auto-sync functionality
  useEffect(() => {
    if (state.isModified && !state.isSyncing) {
      const syncTimer = setTimeout(() => {
        syncDraft()
      }, 2000) // Auto-sync after 2 seconds of inactivity

      return () => clearTimeout(syncTimer)
    }
  }, [state.isModified, state.currentDraft])

  const loadDraft = useCallback((draft: ScheduleDraft) => {
    dispatch({ type: DRAFT_ACTIONS.LOAD_DRAFT, payload: draft })
  }, [])

  const assignStaff = useCallback((shiftId: number, staffId: number, staffName: string) => {
    dispatch({ 
      type: DRAFT_ACTIONS.ASSIGN_STAFF, 
      payload: { shiftId, staffId, staffName } 
    })
  }, [])

  const unassignStaff = useCallback((assignmentId: number) => {
    dispatch({ 
      type: DRAFT_ACTIONS.UNASSIGN_STAFF, 
      payload: { assignmentId } 
    })
  }, [])

  const moveStaff = useCallback((assignmentId: number, fromShiftId: number, toShiftId: number) => {
    dispatch({ 
      type: DRAFT_ACTIONS.MOVE_STAFF, 
      payload: { assignmentId, fromShiftId, toShiftId } 
    })
  }, [])

  const undo = useCallback(() => {
    dispatch({ type: DRAFT_ACTIONS.UNDO })
    toast.success('Action undone')
  }, [])

  const redo = useCallback(() => {
    dispatch({ type: DRAFT_ACTIONS.REDO })
    toast.success('Action redone')
  }, [])

  const canUndo = state.historyIndex >= 0
  const canRedo = state.historyIndex < state.history.length - 1

  const syncDraft = useCallback(async () => {
    if (!state.currentDraft || !state.isModified) return

    dispatch({ type: DRAFT_ACTIONS.SYNC_START })

    try {
      // API call to sync draft with backend
      const response = await fetch(`/api/auto-schedule/${state.currentDraft.business_id}/draft/${state.currentDraft.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shifts: state.currentDraft.shifts.filter(s => s.is_modified),
          modified_at: new Date().toISOString()
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to sync draft')
      }

      dispatch({ type: DRAFT_ACTIONS.SYNC_SUCCESS })
    } catch (error) {
      console.error('Draft sync failed:', error)
      dispatch({ 
        type: DRAFT_ACTIONS.SYNC_ERROR, 
        payload: { error: error instanceof Error ? error.message : 'Sync failed' } 
      })
    }
  }, [state.currentDraft, state.isModified])

  const resetDraft = useCallback(() => {
    dispatch({ type: DRAFT_ACTIONS.RESET_DRAFT })
    toast.success('Draft reset to original state')
  }, [])

  const getChangeSummary = useCallback((): string[] => {
    if (!state.originalDraft || !state.currentDraft) return []

    const changes: string[] = []
    
    // Compare shifts and assignments
    state.currentDraft.shifts.forEach(currentShift => {
      const originalShift = state.originalDraft!.shifts.find(s => s.id === currentShift.id)
      
      if (!originalShift) {
        changes.push(`Added new shift: ${currentShift.title}`)
        return
      }

      // Check for assignment changes
      const currentAssignments = currentShift.assignments.map(a => a.staff_id).sort()
      const originalAssignments = originalShift.assignments.map(a => a.staff_id).sort()

      if (JSON.stringify(currentAssignments) !== JSON.stringify(originalAssignments)) {
        const added = currentAssignments.filter(id => !originalAssignments.includes(id))
        const removed = originalAssignments.filter(id => !currentAssignments.includes(id))

        added.forEach(staffId => {
          const assignment = currentShift.assignments.find(a => a.staff_id === staffId)
          if (assignment) {
            changes.push(`Assigned ${assignment.staff_name} to ${currentShift.title}`)
          }
        })

        removed.forEach(staffId => {
          const assignment = originalShift.assignments.find(a => a.staff_id === staffId)
          if (assignment) {
            changes.push(`Unassigned ${assignment.staff_name} from ${currentShift.title}`)
          }
        })
      }
    })

    return changes
  }, [state.originalDraft, state.currentDraft])

  const contextValue: DraftScheduleContextType = {
    state,
    loadDraft,
    assignStaff,
    unassignStaff,
    moveStaff,
    undo,
    redo,
    canUndo,
    canRedo,
    syncDraft,
    resetDraft,
    getChangeSummary
  }

  return (
    <DraftScheduleContext.Provider value={contextValue}>
      {children}
    </DraftScheduleContext.Provider>
  )
}

// Hook to use the context
export function useDraftSchedule() {
  const context = useContext(DraftScheduleContext)
  if (!context) {
    throw new Error('useDraftSchedule must be used within a DraftScheduleProvider')
  }
  return context
}