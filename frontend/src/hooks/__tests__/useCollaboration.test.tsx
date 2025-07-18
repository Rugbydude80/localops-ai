import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { useCollaboration, UserPresence, EditConflict } from '../useCollaboration'
import { it } from 'date-fns/locale'
import { it } from 'date-fns/locale'
import { it } from 'date-fns/locale'
import { it } from 'date-fns/locale'
import { it } from 'date-fns/locale'
import { it } from 'date-fns/locale'
import { it } from 'date-fns/locale'
import { it } from 'date-fns/locale'
import { it } from 'date-fns/locale'
import { it } from 'date-fns/locale'
import { it } from 'date-fns/locale'
import { it } from 'date-fns/locale'
import { it } from 'date-fns/locale'
import { it } from 'date-fns/locale'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'

// Mock WebSocket
class MockWebSocket {
  public onopen: ((event: Event) => void) | null = null
  public onclose: ((event: CloseEvent) => void) | null = null
  public onmessage: ((event: MessageEvent) => void) | null = null
  public onerror: ((event: Event) => void) | null = null
  public readyState: number = WebSocket.CONNECTING
  public messages: string[] = []

  constructor(public url: string) {
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      this.onopen?.(new Event('open'))
    }, 10)
  }

  send(data: string) {
    this.messages.push(data)
  }

  close(code?: number, reason?: string) {
    this.readyState = WebSocket.CLOSED
    this.onclose?.(new CloseEvent('close', { code: code || 1000, reason }))
  }

  // Helper method to simulate receiving messages
  simulateMessage(data: any) {
    const event = new MessageEvent('message', {
      data: JSON.stringify(data)
    })
    this.onmessage?.(event)
  }

  // Helper method to simulate connection error
  simulateError() {
    this.onerror?.(new Event('error'))
  }
}

// Mock global WebSocket
const originalWebSocket = global.WebSocket
beforeAll(() => {
  global.WebSocket = MockWebSocket as any
})

afterAll(() => {
  global.WebSocket = originalWebSocket
})

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    protocol: 'http:',
    host: 'localhost:3000'
  },
  writable: true
})

describe('useCollaboration', () => {
  const defaultProps = {
    businessId: 123,
    userId: 1,
    userName: 'Test User',
    draftId: 'draft_123'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useCollaboration(defaultProps))

    expect(result.current.isConnected).toBe(false)
    expect(result.current.activeUsers).toEqual([])
    expect(result.current.conflicts).toEqual([])
    expect(result.current.connectionError).toBe(null)
  })

  it('should connect to WebSocket on mount', async () => {
    const { result } = renderHook(() => useCollaboration(defaultProps))

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })
  })

  it('should handle presence updates', async () => {
    const onUserJoined = vi.fn()
    const { result } = renderHook(() => 
      useCollaboration({ ...defaultProps, onUserJoined })
    )

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    // Simulate presence update message
    const mockUsers: UserPresence[] = [
      {
        user_id: 2,
        user_name: 'Other User',
        business_id: 123,
        draft_id: 'draft_123',
        action: 'viewing',
        last_seen: new Date().toISOString(),
        websocket_id: 'ws_123'
      }
    ]

    act(() => {
      const ws = (global.WebSocket as any).instances?.[0] || new MockWebSocket('')
      ws.simulateMessage({
        type: 'presence_update',
        users: mockUsers
      })
    })

    await waitFor(() => {
      expect(result.current.activeUsers).toHaveLength(1)
      expect(result.current.activeUsers[0].user_name).toBe('Other User')
      expect(onUserJoined).toHaveBeenCalledWith(mockUsers[0])
    })
  })

  it('should handle conflict detection', async () => {
    const onConflictDetected = vi.fn()
    const { result } = renderHook(() => 
      useCollaboration({ ...defaultProps, onConflictDetected })
    )

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    const mockConflict: EditConflict = {
      conflict_id: 'conflict_123',
      conflict_type: 'concurrent_assignment',
      edit1: {
        user_name: 'User 1',
        operation: 'assign_staff',
        timestamp: new Date().toISOString()
      },
      edit2: {
        user_name: 'User 2',
        operation: 'assign_staff',
        timestamp: new Date().toISOString()
      }
    }

    act(() => {
      const ws = (global.WebSocket as any).instances?.[0] || new MockWebSocket('')
      ws.simulateMessage({
        type: 'conflict_detected',
        ...mockConflict
      })
    })

    await waitFor(() => {
      expect(result.current.conflicts).toHaveLength(1)
      expect(result.current.conflicts[0].conflict_id).toBe('conflict_123')
      expect(onConflictDetected).toHaveBeenCalledWith(mockConflict)
    })
  })

  it('should update user presence', async () => {
    const { result } = renderHook(() => useCollaboration(defaultProps))

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    act(() => {
      result.current.updatePresence('editing', { shiftId: 456 })
    })

    // Check that message was sent
    const ws = (global.WebSocket as any).instances?.[0] || new MockWebSocket('')
    const lastMessage = JSON.parse(ws.messages[ws.messages.length - 1])
    expect(lastMessage.type).toBe('presence_update')
    expect(lastMessage.action).toBe('editing')
    expect(lastMessage.data).toEqual({ shiftId: 456 })
  })

  it('should acquire edit locks', async () => {
    const { result } = renderHook(() => useCollaboration(defaultProps))

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    // Mock successful lock response
    const lockPromise = act(async () => {
      return result.current.acquireLock('shift', 456)
    })

    // Simulate lock response
    act(() => {
      const ws = (global.WebSocket as any).instances?.[0] || new MockWebSocket('')
      ws.simulateMessage({
        type: 'lock_response',
        success: true,
        resource_type: 'shift',
        resource_id: 456
      })
    })

    const lockResult = await lockPromise
    expect(lockResult).toBe(true)
  })

  it('should handle lock conflicts', async () => {
    const onLockConflict = vi.fn()
    const { result } = renderHook(() => 
      useCollaboration({ ...defaultProps, onLockConflict })
    )

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    act(() => {
      const ws = (global.WebSocket as any).instances?.[0] || new MockWebSocket('')
      ws.simulateMessage({
        type: 'lock_conflict',
        resource_type: 'shift',
        resource_id: 456,
        locked_by_user_id: 2,
        locked_by_user_name: 'Other User'
      })
    })

    await waitFor(() => {
      expect(onLockConflict).toHaveBeenCalledWith({
        resource_type: 'shift',
        resource_id: 456,
        user_id: 2,
        user_name: 'Other User',
        action: 'acquired'
      })
    })
  })

  it('should record edits', async () => {
    const { result } = renderHook(() => useCollaboration(defaultProps))

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    act(() => {
      result.current.recordEdit(
        'assign_staff',
        'assignment',
        789,
        { staff_id: 5, shift_id: 456 }
      )
    })

    const ws = (global.WebSocket as any).instances?.[0] || new MockWebSocket('')
    const lastMessage = JSON.parse(ws.messages[ws.messages.length - 1])
    expect(lastMessage.type).toBe('record_edit')
    expect(lastMessage.operation).toBe('assign_staff')
    expect(lastMessage.target_type).toBe('assignment')
    expect(lastMessage.target_id).toBe(789)
  })

  it('should resolve conflicts', async () => {
    const { result } = renderHook(() => useCollaboration(defaultProps))

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    // Add a conflict first
    act(() => {
      const ws = (global.WebSocket as any).instances?.[0] || new MockWebSocket('')
      ws.simulateMessage({
        type: 'conflict_detected',
        conflict_id: 'conflict_123',
        conflict_type: 'concurrent_assignment',
        edit1: { user_name: 'User 1', operation: 'assign_staff', timestamp: new Date().toISOString() },
        edit2: { user_name: 'User 2', operation: 'assign_staff', timestamp: new Date().toISOString() }
      })
    })

    await waitFor(() => {
      expect(result.current.conflicts).toHaveLength(1)
    })

    // Resolve the conflict
    act(() => {
      result.current.resolveConflict('conflict_123', 'accept_edit1')
    })

    // Check that resolution message was sent
    const ws = (global.WebSocket as any).instances?.[0] || new MockWebSocket('')
    const lastMessage = JSON.parse(ws.messages[ws.messages.length - 1])
    expect(lastMessage.type).toBe('resolve_conflict')
    expect(lastMessage.conflict_id).toBe('conflict_123')
    expect(lastMessage.resolution).toBe('accept_edit1')

    // Conflict should be removed from local state
    expect(result.current.conflicts).toHaveLength(0)
  })

  it('should handle connection errors', async () => {
    const { result } = renderHook(() => useCollaboration(defaultProps))

    act(() => {
      const ws = (global.WebSocket as any).instances?.[0] || new MockWebSocket('')
      ws.simulateError()
    })

    await waitFor(() => {
      expect(result.current.connectionError).toBe('Connection error')
    })
  })

  it('should handle disconnection', async () => {
    const { result } = renderHook(() => useCollaboration(defaultProps))

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    act(() => {
      const ws = (global.WebSocket as any).instances?.[0] || new MockWebSocket('')
      ws.close(1000, 'Normal closure')
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false)
    })
  })

  it('should track resource locks', async () => {
    const { result } = renderHook(() => useCollaboration(defaultProps))

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    // Simulate lock update
    act(() => {
      const ws = (global.WebSocket as any).instances?.[0] || new MockWebSocket('')
      ws.simulateMessage({
        type: 'lock_update',
        resource_type: 'shift',
        resource_id: 456,
        user_id: 2,
        user_name: 'Other User',
        action: 'acquired'
      })
    })

    await waitFor(() => {
      const lock = result.current.isResourceLocked('shift', 456)
      expect(lock).not.toBeNull()
      expect(lock?.user_name).toBe('Other User')
    })
  })

  it('should count active users correctly', async () => {
    const { result } = renderHook(() => useCollaboration(defaultProps))

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    const mockUsers: UserPresence[] = [
      {
        user_id: 2,
        user_name: 'User 2',
        business_id: 123,
        action: 'viewing',
        last_seen: new Date().toISOString(),
        websocket_id: 'ws_2'
      },
      {
        user_id: 3,
        user_name: 'User 3',
        business_id: 123,
        action: 'editing',
        last_seen: new Date().toISOString(),
        websocket_id: 'ws_3'
      }
    ]

    act(() => {
      const ws = (global.WebSocket as any).instances?.[0] || new MockWebSocket('')
      ws.simulateMessage({
        type: 'presence_update',
        users: mockUsers
      })
    })

    await waitFor(() => {
      expect(result.current.getActiveUsersCount()).toBe(2)
      expect(result.current.getEditingUsers()).toHaveLength(1)
      expect(result.current.getEditingUsers()[0].user_name).toBe('User 3')
    })
  })

  it('should cleanup on unmount', async () => {
    const { result, unmount } = renderHook(() => useCollaboration(defaultProps))

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    unmount()

    // WebSocket should be closed
    const ws = (global.WebSocket as any).instances?.[0] || new MockWebSocket('')
    expect(ws.readyState).toBe(WebSocket.CLOSED)
  })
})