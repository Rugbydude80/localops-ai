import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  BellIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon, 
  XMarkIcon,
  ClockIcon,
  UserIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import apiClient from '../lib/api'

interface Notification {
  id: number
  message: string
  priority: 'low' | 'normal' | 'high'
  created_at: string
  read_at?: string
  metadata?: {
    sick_leave_id?: number
    shift_id?: number
    required_skill?: string
    shift_date?: string
    shift_time?: string
    response?: string
    response_message?: string
    response_at?: string
  }
}

interface NotificationPanelProps {
  staffId: number
  isOpen: boolean
  onClose: () => void
}

export default function NotificationPanel({ staffId, isOpen, onClose }: NotificationPanelProps) {
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [showResponseForm, setShowResponseForm] = useState(false)
  const [responseMessage, setResponseMessage] = useState('')
  const queryClient = useQueryClient()

  // Get notifications
  const { data: rawNotifications = [], isLoading, refetch } = useQuery({
    queryKey: ['notifications', staffId],
    queryFn: () => apiClient.getStaffNotifications(staffId, false, 50),
    enabled: isOpen,
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  const notifications = rawNotifications as Notification[]

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: (notificationId: number) => apiClient.markNotificationRead(notificationId, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', staffId] })
    }
  })

  // Respond to notification mutation
  const respondMutation = useMutation({
    mutationFn: ({ notificationId, response, message }: { notificationId: number, response: string, message?: string }) => 
      apiClient.respondToNotification(notificationId, staffId, response, message),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['notifications', staffId] })
      setShowResponseForm(false)
      setSelectedNotification(null)
      setResponseMessage('')
      
      if (data?.shift_assigned) {
        toast.success('Shift accepted! You have been assigned to cover this shift.')
      } else {
        toast.success('Response recorded successfully.')
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to respond to notification')
    }
  })

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification)
    
    // Mark as read if not already read
    if (!notification.read_at) {
      markReadMutation.mutate(notification.id)
    }
  }

  const handleResponse = (response: string) => {
    if (!selectedNotification) return
    
    respondMutation.mutate({
      notificationId: selectedNotification.id,
      response: response,
      message: responseMessage || undefined
    })
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-50'
      case 'normal': return 'border-blue-500 bg-blue-50'
      case 'low': return 'border-gray-500 bg-gray-50'
      default: return 'border-gray-500 bg-gray-50'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
      case 'normal': return <BellIcon className="h-5 w-5 text-blue-600" />
      case 'low': return <BellIcon className="h-5 w-5 text-gray-600" />
      default: return <BellIcon className="h-5 w-5 text-gray-600" />
    }
  }

  const unreadCount = notifications.filter(n => !n.read_at).length

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <BellIcon className="h-6 w-6 mr-2" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex h-96">
          {/* Notification List */}
          <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center">
                <BellIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 ${
                      !notification.read_at ? 'bg-blue-50' : ''
                    } ${
                      selectedNotification?.id === notification.id ? 'bg-blue-100' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        {getPriorityIcon(notification.priority)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center mt-1 space-x-2">
                          <ClockIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {format(new Date(notification.created_at), 'MMM d, HH:mm')}
                          </span>
                          {!notification.read_at && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notification Detail */}
          <div className="w-1/2 overflow-y-auto">
            {selectedNotification ? (
              <div className="p-6">
                <div className="flex items-start space-x-3 mb-4">
                  <div className="flex-shrink-0">
                    {getPriorityIcon(selectedNotification.priority)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(selectedNotification.priority)}`}>
                        {selectedNotification.priority.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(selectedNotification.created_at), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 mb-4">
                      {selectedNotification.message}
                    </p>

                    {/* Shift Details */}
                    {selectedNotification.metadata && (
                      <div className="bg-gray-50 p-3 rounded-lg mb-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Shift Details</h4>
                        <div className="space-y-1 text-xs text-gray-600">
                          {selectedNotification.metadata.shift_date && (
                            <div>Date: {format(new Date(selectedNotification.metadata.shift_date), 'EEEE, MMM d, yyyy')}</div>
                          )}
                          {selectedNotification.metadata.shift_time && (
                            <div>Time: {selectedNotification.metadata.shift_time}</div>
                          )}
                          {selectedNotification.metadata.required_skill && (
                            <div>Required Skill: {selectedNotification.metadata.required_skill}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Response Status */}
                    {selectedNotification.metadata?.response ? (
                      <div className="bg-green-50 p-3 rounded-lg mb-4">
                        <h4 className="text-sm font-medium text-green-900 mb-2">Your Response</h4>
                        <div className="text-sm text-green-800">
                          <div className="capitalize font-medium">{selectedNotification.metadata.response}</div>
                          {selectedNotification.metadata.response_message && (
                            <div className="mt-1 text-xs">{selectedNotification.metadata.response_message}</div>
                          )}
                          {selectedNotification.metadata.response_at && (
                            <div className="mt-1 text-xs text-green-600">
                              Responded on {format(new Date(selectedNotification.metadata.response_at), 'MMM d, HH:mm')}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      // Response Actions (only for sick leave replacement notifications)
                      selectedNotification.message.includes('called in sick') && (
                        <div className="space-y-3">
                          {!showResponseForm ? (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleResponse('accept')}
                                disabled={respondMutation.isPending}
                                className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                              >
                                Accept Shift
                              </button>
                              <button
                                onClick={() => handleResponse('decline')}
                                disabled={respondMutation.isPending}
                                className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                              >
                                Decline
                              </button>
                              <button
                                onClick={() => setShowResponseForm(true)}
                                className="px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700"
                              >
                                Maybe
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <textarea
                                value={responseMessage}
                                onChange={(e) => setResponseMessage(e.target.value)}
                                placeholder="Add a message (optional)..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                rows={3}
                              />
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleResponse('maybe')}
                                  disabled={respondMutation.isPending}
                                  className="flex-1 px-3 py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                                >
                                  {respondMutation.isPending ? 'Sending...' : 'Send Maybe'}
                                </button>
                                <button
                                  onClick={() => setShowResponseForm(false)}
                                  className="px-3 py-2 bg-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-400"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">
                <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p>Select a notification to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 