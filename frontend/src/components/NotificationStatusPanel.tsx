import React, { useState, useEffect } from 'react'
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon, 
  ExclamationTriangleIcon,
  ArrowPathIcon,
  BellIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface NotificationStatus {
  id: number
  draft_id: string
  staff_id: number
  staff_name: string
  notification_type: string
  channel: string
  status: string
  sent_at: string | null
  delivered_at: string | null
  retry_count: number
  error_message: string | null
  external_id: string | null
}

interface NotificationStatusResponse {
  success: boolean
  notifications: NotificationStatus[]
  summary: Record<string, number>
  total_notifications: number
  success_rate: number
}

interface NotificationStatusPanelProps {
  draftId: string
  isOpen: boolean
  onClose: () => void
}

const NotificationStatusPanel: React.FC<NotificationStatusPanelProps> = ({
  draftId,
  isOpen,
  onClose
}) => {
  const [statusData, setStatusData] = useState<NotificationStatusResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const fetchNotificationStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/notifications/schedule/${draftId}/status`)
      if (!response.ok) {
        throw new Error('Failed to fetch notification status')
      }
      const data = await response.json()
      setStatusData(data)
    } catch (error) {
      console.error('Error fetching notification status:', error)
      toast.error('Failed to load notification status')
    } finally {
      setLoading(false)
    }
  }

  const retryFailedNotifications = async (notificationIds?: number[]) => {
    setRetrying(true)
    try {
      const response = await fetch(`/api/notifications/schedule/${draftId}/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notification_ids: notificationIds
        })
      })

      if (!response.ok) {
        throw new Error('Failed to retry notifications')
      }

      const result = await response.json()
      toast.success(`Retried ${result.retried_count} notifications. ${result.successful_retries} succeeded.`)
      
      // Refresh status after retry
      await fetchNotificationStatus()
    } catch (error) {
      console.error('Error retrying notifications:', error)
      toast.error('Failed to retry notifications')
    } finally {
      setRetrying(false)
    }
  }

  useEffect(() => {
    if (isOpen && draftId) {
      fetchNotificationStatus()
    }
  }, [isOpen, draftId])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      case 'retrying':
        return <ArrowPathIcon className="h-5 w-5 text-yellow-500 animate-spin" />
      case 'pending':
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return 'text-green-700 bg-green-50 border-green-200'
      case 'failed':
        return 'text-red-700 bg-red-50 border-red-200'
      case 'retrying':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200'
      case 'pending':
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200'
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return '💬'
      case 'sms':
        return '📱'
      case 'email':
        return '📧'
      default:
        return '📢'
    }
  }

  const failedNotifications = statusData?.notifications.filter(n => n.status === 'failed') || []

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <BellIcon className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Notification Status
              </h2>
              <p className="text-sm text-gray-500">
                Track delivery status of schedule notifications
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close panel"
          >
            <XCircleIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <ArrowPathIcon className="h-8 w-8 text-blue-600 animate-spin" />
              <span className="ml-2 text-gray-600">Loading notification status...</span>
            </div>
          ) : statusData ? (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="text-2xl font-bold text-blue-700">
                    {statusData.total_notifications}
                  </div>
                  <div className="text-sm text-blue-600">Total Notifications</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="text-2xl font-bold text-green-700">
                    {statusData.success_rate}%
                  </div>
                  <div className="text-sm text-green-600">Success Rate</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="text-2xl font-bold text-red-700">
                    {statusData.summary.failed || 0}
                  </div>
                  <div className="text-sm text-red-600">Failed</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="text-2xl font-bold text-yellow-700">
                    {statusData.summary.retrying || 0}
                  </div>
                  <div className="text-sm text-yellow-600">Retrying</div>
                </div>
              </div>

              {/* Retry Failed Button */}
              {failedNotifications.length > 0 && (
                <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
                    <span className="text-red-700">
                      {failedNotifications.length} notification{failedNotifications.length !== 1 ? 's' : ''} failed to deliver
                    </span>
                  </div>
                  <button
                    onClick={() => retryFailedNotifications()}
                    disabled={retrying}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {retrying ? (
                      <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowPathIcon className="h-4 w-4 mr-2" />
                    )}
                    Retry All Failed
                  </button>
                </div>
              )}

              {/* Notifications List */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-gray-900">Notification Details</h3>
                {statusData.notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(notification.status)}
                      <div>
                        <div className="font-medium text-gray-900">
                          {notification.staff_name}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center space-x-2">
                          <span>{getChannelIcon(notification.channel)} {notification.channel}</span>
                          {notification.retry_count > 0 && (
                            <span className="text-yellow-600">
                              • {notification.retry_count} retr{notification.retry_count !== 1 ? 'ies' : 'y'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(notification.status)}`}>
                        {notification.status}
                      </span>
                      {notification.status === 'failed' && (
                        <button
                          onClick={() => retryFailedNotifications([notification.id])}
                          disabled={retrying}
                          className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Error Details */}
              {statusData.notifications.some(n => n.error_message) && (
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-gray-900">Error Details</h3>
                  {statusData.notifications
                    .filter(n => n.error_message)
                    .map((notification) => (
                      <div
                        key={`error-${notification.id}`}
                        className="p-3 bg-red-50 border border-red-200 rounded-lg"
                      >
                        <div className="font-medium text-red-800">
                          {notification.staff_name} ({notification.channel})
                        </div>
                        <div className="text-sm text-red-600 mt-1">
                          {notification.error_message}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No notification data available
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200">
          <button
            onClick={fetchNotificationStatus}
            disabled={loading}
            className="px-4 py-2 text-blue-600 hover:text-blue-800 disabled:opacity-50 flex items-center"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default NotificationStatusPanel