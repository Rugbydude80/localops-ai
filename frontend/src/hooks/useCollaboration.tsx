import { useState, useEffect, useCallback, useRef } from 'react'

export interface UserPresence {
  user_id: number
  user_name: string
  business_id: number
  draft_id?: string
  action: 'viewing' | 'editing' | 'idle'
  last_seen: string
  websocket_id: string
}

export interface EditConflict {
  conflict_id: string
  conflict_type: string
  edit1: {
    user_name: string
    operation: string
    timestamp: string
  }
  edit2: {
    user_name: string
    operation: string
    timestamp: string
  }
}

export interface EditLock {
  resource_type: string
  resource_id: number
  user_id: number
  user_name: string
  action: 'acquired' | 'released'
}

interface CollaborationState {
  isConnected: boolean
  activeUsers: UserPresence[]
  conflicts: EditConflict[]
  locks: Map<string, EditLock>
  connectionError: string | null
}

interface UseCollaborationProps {
  businessId: number
  userId: number
  userName: string
  draftId?: string
  onConflictDetected?: (conflict: EditConflict) => void
  onUserJoined?: (user: UserPresence) => void
  onUserLeft?: (userId: number) => void
  onLockConflict?: (lock: EditLock) => void
}

export const useCollaboration = ({
  businessId,
  userId,
  userName,
  draftId,
  onConflictDetected,
  onUserJoined,
  onUserLeft,
  onLockConflict
}: UseCollaborationProps) => {
  const [state, setState] = useState<CollaborationState>({
    isConnected: false,
    activeUsers: [],
    conflicts: [],
    locks: new Map(),
    connectionError: null
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const wsUrl = `${protocol}//${host}/ws/collaboration/${businessId}?user_id=${userId}&user_name=${encodeURIComponent(userName)}${draftId ? `&draft_id=${draftId}` : ''}`
      
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        console.log('Collaboration WebSocket connected')
        setState(prev => ({ 
          ...prev, 
          isConnected: true, 
          connectionError: null 
        }))
        reconnectAttempts.current = 0

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30000)
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleMessage(message)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      wsRef.current.onclose = (event) => {
        console.log('Collaboration WebSocket disconnected:', event.code, event.reason)
        setState(prev => ({ 
          ...prev, 
          isConnected: false,
          connectionError: event.code !== 1000 ? 'Connection lost' : null
        }))

        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
          heartbeatIntervalRef.current = null
        }

        // Attempt reconnection if not a normal closure
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++
            connect()
          }, delay)
        }
      }

      wsRef.current.onerror = (error) => {
        console.error('Collaboration WebSocket error:', error)
        setState(prev => ({ 
          ...prev, 
          connectionError: 'Connection error' 
        }))
      }

    } catch (error) {
      console.error('Error creating WebSocket connection:', error)
      setState(prev => ({ 
        ...prev, 
        connectionError: 'Failed to connect' 
      }))
    }
  }, [businessId, userId, userName, draftId])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected')
      wsRef.current = null
    }

    setState(prev => ({ 
      ...prev, 
      isConnected: false, 
      activeUsers: [],
      connectionError: null
    }))
  }, [])

  const handleMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'pong':
        // Heartbeat response
        break

      case 'presence_update':
      case 'current_presence':
        setState(prev => {
          const newUsers = message.users || []
          const previousUserIds = new Set(prev.activeUsers.map(u => u.user_id))
          const currentUserIds = new Set(newUsers.map((u: UserPresence) => u.user_id))

          // Detect new users
          newUsers.forEach((user: UserPresence) => {
            if (!previousUserIds.has(user.user_id) && user.user_id !== userId) {
              onUserJoined?.(user)
            }
          })

          // Detect users who left
          prev.activeUsers.forEach(user => {
            if (!currentUserIds.has(user.user_id)) {
              onUserLeft?.(user.user_id)
            }
          })

          return {
            ...prev,
            activeUsers: newUsers
          }
        })
        break

      case 'conflict_detected':
        const conflict: EditConflict = {
          conflict_id: message.conflict_id,
          conflict_type: message.conflict_type,
          edit1: message.edit1,
          edit2: message.edit2
        }
        
        setState(prev => ({
          ...prev,
          conflicts: [...prev.conflicts, conflict]
        }))
        
        onConflictDetected?.(conflict)
        break

      case 'conflict_resolved':
        setState(prev => ({
          ...prev,
          conflicts: prev.conflicts.filter(c => c.conflict_id !== message.conflict.conflict_id)
        }))
        break

      case 'lock_response':
        // Handle lock acquisition response
        break

      case 'lock_update':
        const lockKey = `${message.resource_type}:${message.resource_id}`
        const lockInfo: EditLock = {
          resource_type: message.resource_type,
          resource_id: message.resource_id,
          user_id: message.user_id,
          user_name: message.user_name,
          action: message.action
        }

        setState(prev => {
          const newLocks = new Map(prev.locks)
          if (message.action === 'acquired') {
            newLocks.set(lockKey, lockInfo)
          } else {
            newLocks.delete(lockKey)
          }
          return { ...prev, locks: newLocks }
        })
        break

      case 'lock_conflict':
        const conflictLock: EditLock = {
          resource_type: message.resource_type,
          resource_id: message.resource_id,
          user_id: message.locked_by_user_id,
          user_name: message.locked_by_user_name,
          action: 'acquired'
        }
        onLockConflict?.(conflictLock)
        break

      default:
        console.log('Unknown collaboration message type:', message.type)
    }
  }, [userId, onConflictDetected, onUserJoined, onUserLeft, onLockConflict])

  // Connection management
  useEffect(() => {
    connect()
    return disconnect
  }, [connect, disconnect])

  // Collaboration actions
  const updatePresence = useCallback((action: 'viewing' | 'editing' | 'idle', data?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'presence_update',
        action,
        data
      }))
    }
  }, [])

  const acquireLock = useCallback(async (resourceType: string, resourceId: number): Promise<boolean> => {
    return new Promise((resolve) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const messageHandler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data)
            if (message.type === 'lock_response' && 
                message.resource_type === resourceType && 
                message.resource_id === resourceId) {
              wsRef.current?.removeEventListener('message', messageHandler)
              resolve(message.success)
            }
          } catch (error) {
            console.error('Error parsing lock response:', error)
            resolve(false)
          }
        }

        wsRef.current.addEventListener('message', messageHandler)
        wsRef.current.send(JSON.stringify({
          type: 'acquire_lock',
          resource_type: resourceType,
          resource_id: resourceId
        }))

        // Timeout after 5 seconds
        setTimeout(() => {
          wsRef.current?.removeEventListener('message', messageHandler)
          resolve(false)
        }, 5000)
      } else {
        resolve(false)
      }
    })
  }, [])

  const releaseLock = useCallback((resourceType: string, resourceId: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'release_lock',
        resource_type: resourceType,
        resource_id: resourceId
      }))
    }
  }, [])

  const recordEdit = useCallback((
    operation: string,
    targetType: string,
    targetId: number,
    data: any
  ) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'record_edit',
        operation,
        target_type: targetType,
        target_id: targetId,
        data
      }))
    }
  }, [])

  const resolveConflict = useCallback((
    conflictId: string,
    resolution: string,
    resolutionData?: any
  ) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'resolve_conflict',
        conflict_id: conflictId,
        resolution,
        resolution_data: resolutionData
      }))
    }

    // Remove conflict from local state
    setState(prev => ({
      ...prev,
      conflicts: prev.conflicts.filter(c => c.conflict_id !== conflictId)
    }))
  }, [])

  const isResourceLocked = useCallback((resourceType: string, resourceId: number): EditLock | null => {
    const lockKey = `${resourceType}:${resourceId}`
    return state.locks.get(lockKey) || null
  }, [state.locks])

  const getActiveUsersCount = useCallback(() => {
    return state.activeUsers.filter(user => user.user_id !== userId).length
  }, [state.activeUsers, userId])

  const getEditingUsers = useCallback(() => {
    return state.activeUsers.filter(user => 
      user.user_id !== userId && user.action === 'editing'
    )
  }, [state.activeUsers, userId])

  return {
    // State
    isConnected: state.isConnected,
    activeUsers: state.activeUsers.filter(user => user.user_id !== userId),
    conflicts: state.conflicts,
    connectionError: state.connectionError,
    
    // Actions
    updatePresence,
    acquireLock,
    releaseLock,
    recordEdit,
    resolveConflict,
    
    // Utilities
    isResourceLocked,
    getActiveUsersCount,
    getEditingUsers,
    
    // Connection management
    reconnect: connect,
    disconnect
  }
}