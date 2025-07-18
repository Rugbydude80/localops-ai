import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import NotificationStatusPanel from '../NotificationStatusPanel'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

const mockNotificationStatus = {
  success: true,
  notifications: [
    {
      id: 1,
      draft_id: 'test-draft-123',
      staff_id: 1,
      staff_name: 'John Doe',
      notification_type: 'new_schedule',
      channel: 'whatsapp',
      status: 'sent',
      sent_at: '2024-01-15T10:00:00Z',
      delivered_at: null,
      retry_count: 0,
      error_message: null,
      external_id: 'wa_123'
    },
    {
      id: 2,
      draft_id: 'test-draft-123',
      staff_id: 2,
      staff_name: 'Jane Smith',
      notification_type: 'new_schedule',
      channel: 'email',
      status: 'failed',
      sent_at: null,
      delivered_at: null,
      retry_count: 2,
      error_message: 'Invalid email address',
      external_id: null
    }
  ],
  summary: {
    sent: 1,
    failed: 1
  },
  total_notifications: 2,
  success_rate: 50.0
}

describe('NotificationStatusPanel', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('renders notification status panel when open', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotificationStatus
    })

    render(
      <NotificationStatusPanel
        draftId="test-draft-123"
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Notification Status')).toBeInTheDocument()
    expect(screen.getByText('Track delivery status of schedule notifications')).toBeInTheDocument()

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument() // Total notifications
      expect(screen.getByText('50%')).toBeInTheDocument() // Success rate
    })
  })

  it('displays notification details correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotificationStatus
    })

    render(
      <NotificationStatusPanel
        draftId="test-draft-123"
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      // Check staff names
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()

      // Check channels
      expect(screen.getByText('💬 whatsapp')).toBeInTheDocument()
      expect(screen.getByText('📧 email')).toBeInTheDocument()

      // Check statuses
      expect(screen.getByText('sent')).toBeInTheDocument()
      expect(screen.getByText('failed')).toBeInTheDocument()
    })
  })

  it('shows retry button for failed notifications', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotificationStatus
    })

    render(
      <NotificationStatusPanel
        draftId="test-draft-123"
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('1 notification failed to deliver')).toBeInTheDocument()
      expect(screen.getByText('Retry All Failed')).toBeInTheDocument()
    })
  })

  it('handles retry failed notifications', async () => {
    // Mock initial status fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotificationStatus
    })

    // Mock retry request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        retried_count: 1,
        successful_retries: 1,
        failed_retries: 0
      })
    })

    // Mock refresh after retry
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockNotificationStatus,
        notifications: mockNotificationStatus.notifications.map(n => 
          n.id === 2 ? { ...n, status: 'sent' } : n
        ),
        summary: { sent: 2, failed: 0 },
        success_rate: 100.0
      })
    })

    render(
      <NotificationStatusPanel
        draftId="test-draft-123"
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Retry All Failed')).toBeInTheDocument()
    })

    // Click retry button
    fireEvent.click(screen.getByText('Retry All Failed'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/notifications/schedule/test-draft-123/retry',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_ids: undefined })
        })
      )
    })
  })

  it('displays error details for failed notifications', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotificationStatus
    })

    render(
      <NotificationStatusPanel
        draftId="test-draft-123"
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Error Details')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith (email)')).toBeInTheDocument()
      expect(screen.getByText('Invalid email address')).toBeInTheDocument()
    })
  })

  it('handles refresh functionality', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockNotificationStatus
    })

    render(
      <NotificationStatusPanel
        draftId="test-draft-123"
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument()
    })

    // Click refresh button
    fireEvent.click(screen.getByText('Refresh'))

    // Should make another API call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  it('handles close functionality', () => {
    const mockOnClose = vi.fn()

    render(
      <NotificationStatusPanel
        draftId="test-draft-123"
        isOpen={true}
        onClose={mockOnClose}
      />
    )

    // Click close button
    fireEvent.click(screen.getByText('Close'))
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('does not render when closed', () => {
    render(
      <NotificationStatusPanel
        draftId="test-draft-123"
        isOpen={false}
        onClose={vi.fn()}
      />
    )

    expect(screen.queryByText('Notification Status')).not.toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API Error'))

    render(
      <NotificationStatusPanel
        draftId="test-draft-123"
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('No notification data available')).toBeInTheDocument()
    })
  })

  it('shows loading state', () => {
    mockFetch.mockImplementationOnce(() => new Promise(() => {})) // Never resolves

    render(
      <NotificationStatusPanel
        draftId="test-draft-123"
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Loading notification status...')).toBeInTheDocument()
  })

  it('displays correct status icons', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotificationStatus
    })

    render(
      <NotificationStatusPanel
        draftId="test-draft-123"
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      // Check for status indicators (icons are rendered as SVG elements)
      const statusElements = screen.getAllByText('sent')
      expect(statusElements.length).toBeGreaterThan(0)
      
      const failedElements = screen.getAllByText('failed')
      expect(failedElements.length).toBeGreaterThan(0)
    })
  })
})