import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import DraftComparisonView from '../DraftComparisonView'
import { ScheduleDraft } from '../../hooks/useDraftSchedule'

const mockOriginalDraft: ScheduleDraft = {
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

const mockCurrentDraft: ScheduleDraft = {
  ...mockOriginalDraft,
  modified_at: '2024-01-15T11:30:00Z',
  shifts: [
    {
      id: 1,
      title: 'Morning Kitchen',
      date: '2024-01-15',
      start_time: '08:00',
      end_time: '16:00',
      required_skill: 'kitchen',
      required_staff_count: 2,
      status: 'filled',
      assignments: [
        {
          id: 101,
          staff_id: 1,
          staff_name: 'John Doe',
          status: 'assigned',
          confidence_score: 0.9
        },
        {
          id: 102,
          staff_id: 2,
          staff_name: 'Jane Smith',
          status: 'assigned',
          is_modified: true
        }
      ],
      ai_generated: true,
      confidence_score: 0.8,
      is_modified: true
    },
    {
      id: 2,
      title: 'Evening Bar',
      date: '2024-01-15',
      start_time: '18:00',
      end_time: '02:00',
      required_skill: 'bar',
      required_staff_count: 1,
      status: 'filled',
      assignments: [
        {
          id: 103,
          staff_id: 3,
          staff_name: 'Bob Wilson',
          status: 'assigned',
          is_modified: true
        }
      ],
      ai_generated: true,
      confidence_score: 0.7,
      is_modified: true
    }
  ]
}

const mockNoChangesDraft: ScheduleDraft = {
  ...mockOriginalDraft,
  modified_at: '2024-01-15T10:00:00Z'
}

describe('DraftComparisonView', () => {
  it('should render no changes message when drafts are identical', () => {
    render(
      <DraftComparisonView
        originalDraft={mockOriginalDraft}
        currentDraft={mockNoChangesDraft}
      />
    )

    expect(screen.getByText('No Changes Made')).toBeInTheDocument()
    expect(screen.getByText('The current schedule matches the original AI-generated schedule.')).toBeInTheDocument()
  })

  it('should display change statistics correctly', () => {
    render(
      <DraftComparisonView
        originalDraft={mockOriginalDraft}
        currentDraft={mockCurrentDraft}
      />
    )

    expect(screen.getByText('Schedule Changes')).toBeInTheDocument()
    
    // Check for statistics labels
    expect(screen.getByText('Total Changes')).toBeInTheDocument()
    expect(screen.getByText('Added')).toBeInTheDocument()
    expect(screen.getByText('Removed')).toBeInTheDocument()
    expect(screen.getByText('Moved')).toBeInTheDocument()

    // Check for specific values using more specific queries
    const totalChangesElement = screen.getByText('Total Changes').previousElementSibling
    expect(totalChangesElement).toHaveTextContent('2')
    
    const addedElement = screen.getByText('Added').previousElementSibling
    expect(addedElement).toHaveTextContent('2')
  })

  it('should show assignment added changes', () => {
    render(
      <DraftComparisonView
        originalDraft={mockOriginalDraft}
        currentDraft={mockCurrentDraft}
      />
    )

    expect(screen.getByText('Jane Smith assigned to Morning Kitchen')).toBeInTheDocument()
    expect(screen.getByText('Bob Wilson assigned to Evening Bar')).toBeInTheDocument()
  })

  it('should expand and collapse changes section', () => {
    render(
      <DraftComparisonView
        originalDraft={mockOriginalDraft}
        currentDraft={mockCurrentDraft}
      />
    )

    const changesButton = screen.getByRole('button', { name: /Changes/ })
    
    // Changes should be expanded by default
    expect(screen.getByText('Jane Smith assigned to Morning Kitchen')).toBeInTheDocument()

    // Click to collapse
    fireEvent.click(changesButton)
    expect(screen.queryByText('Jane Smith assigned to Morning Kitchen')).not.toBeInTheDocument()

    // Click to expand again
    fireEvent.click(changesButton)
    expect(screen.getByText('Jane Smith assigned to Morning Kitchen')).toBeInTheDocument()
  })

  it('should expand and collapse impact analysis section', () => {
    render(
      <DraftComparisonView
        originalDraft={mockOriginalDraft}
        currentDraft={mockCurrentDraft}
      />
    )

    const impactButton = screen.getByRole('button', { name: /Impact Analysis/ })
    
    // Impact should be collapsed by default
    expect(screen.queryByText('Coverage Impact')).not.toBeInTheDocument()

    // Click to expand
    fireEvent.click(impactButton)
    expect(screen.getByText('Coverage Impact')).toBeInTheDocument()
    expect(screen.getByText('AI Confidence Impact')).toBeInTheDocument()
  })

  it('should show coverage impact changes', () => {
    render(
      <DraftComparisonView
        originalDraft={mockOriginalDraft}
        currentDraft={mockCurrentDraft}
      />
    )

    // Expand impact analysis
    const impactButton = screen.getByRole('button', { name: /Impact Analysis/ })
    fireEvent.click(impactButton)

    // Morning Kitchen went from 50% to 100% coverage (+50%)
    expect(screen.getByText('Morning Kitchen')).toBeInTheDocument()
    expect(screen.getByText('+50%')).toBeInTheDocument()

    // Evening Bar went from 0% to 100% coverage (+100%)
    expect(screen.getByText('Evening Bar')).toBeInTheDocument()
    expect(screen.getByText('+100%')).toBeInTheDocument()
  })

  it('should handle assignment removal changes', () => {
    const draftWithRemovedAssignment: ScheduleDraft = {
      ...mockOriginalDraft,
      modified_at: '2024-01-15T11:30:00Z',
      shifts: [
        {
          ...mockOriginalDraft.shifts[0],
          assignments: [], // John removed
          status: 'open',
          is_modified: true
        },
        mockOriginalDraft.shifts[1]
      ]
    }

    render(
      <DraftComparisonView
        originalDraft={mockOriginalDraft}
        currentDraft={draftWithRemovedAssignment}
      />
    )

    expect(screen.getByText('John Doe unassigned from Morning Kitchen')).toBeInTheDocument()
  })

  it('should handle assignment moved changes', () => {
    const draftWithMovedAssignment: ScheduleDraft = {
      ...mockOriginalDraft,
      modified_at: '2024-01-15T11:30:00Z',
      shifts: [
        {
          ...mockOriginalDraft.shifts[0],
          assignments: [], // John removed from Morning Kitchen
          status: 'open',
          is_modified: true
        },
        {
          ...mockOriginalDraft.shifts[1],
          assignments: [
            {
              id: 101,
              staff_id: 1,
              staff_name: 'John Doe',
              status: 'assigned',
              is_modified: true
            }
          ], // John moved to Evening Bar
          status: 'filled',
          is_modified: true
        }
      ]
    }

    render(
      <DraftComparisonView
        originalDraft={mockOriginalDraft}
        currentDraft={draftWithMovedAssignment}
      />
    )

    expect(screen.getByText('John Doe moved from Morning Kitchen to Evening Bar')).toBeInTheDocument()
  })

  it('should show change details when clicked', () => {
    render(
      <DraftComparisonView
        originalDraft={mockOriginalDraft}
        currentDraft={mockCurrentDraft}
      />
    )

    const changeItem = screen.getByText('Jane Smith assigned to Morning Kitchen').closest('div')
    expect(changeItem).toBeInTheDocument()

    // Click to expand details
    fireEvent.click(changeItem!)

    expect(screen.getByText('Shift: Morning Kitchen')).toBeInTheDocument()
    expect(screen.getByText('Staff: Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Time: 08:00 - 16:00')).toBeInTheDocument()
  })

  it('should call onRevertChange when revert button is clicked', () => {
    const mockOnRevertChange = vi.fn()

    render(
      <DraftComparisonView
        originalDraft={mockOriginalDraft}
        currentDraft={mockCurrentDraft}
        onRevertChange={mockOnRevertChange}
      />
    )

    const revertButtons = screen.getAllByText('Revert')
    expect(revertButtons).toHaveLength(2) // Two changes

    fireEvent.click(revertButtons[0])
    expect(mockOnRevertChange).toHaveBeenCalledWith(expect.stringContaining('assignment-added'))
  })

  it('should display severity indicators correctly', () => {
    const draftWithHighSeverityChange: ScheduleDraft = {
      ...mockOriginalDraft,
      modified_at: '2024-01-15T11:30:00Z',
      shifts: [
        {
          ...mockOriginalDraft.shifts[0],
          assignments: [], // John removed - high severity
          status: 'open',
          is_modified: true
        },
        mockOriginalDraft.shifts[1]
      ]
    }

    render(
      <DraftComparisonView
        originalDraft={mockOriginalDraft}
        currentDraft={draftWithHighSeverityChange}
      />
    )

    // High severity change should have red styling - find the parent container
    const changeText = screen.getByText('John Doe unassigned from Morning Kitchen')
    const changeContainer = changeText.closest('.p-3')
    expect(changeContainer).toHaveClass('text-red-600', 'bg-red-50', 'border-red-200')
  })

  it('should sort changes by severity', () => {
    const draftWithMixedSeverityChanges: ScheduleDraft = {
      ...mockOriginalDraft,
      modified_at: '2024-01-15T11:30:00Z',
      shifts: [
        {
          ...mockOriginalDraft.shifts[0],
          assignments: [
            ...mockOriginalDraft.shifts[0].assignments,
            {
              id: 102,
              staff_id: 2,
              staff_name: 'Jane Smith',
              status: 'assigned',
              is_modified: true
            }
          ], // Low severity - assignment added
          status: 'filled',
          is_modified: true
        },
        {
          ...mockOriginalDraft.shifts[1],
          assignments: [], // Would be high severity if someone was removed
          status: 'open',
          is_modified: true
        }
      ]
    }

    render(
      <DraftComparisonView
        originalDraft={mockOriginalDraft}
        currentDraft={draftWithMixedSeverityChanges}
      />
    )

    const changes = screen.getAllByText(/assigned to|unassigned from/)
    // Changes should be sorted by severity (high first)
    expect(changes[0]).toHaveTextContent('Jane Smith assigned to Morning Kitchen')
  })

  it('should handle custom className prop', () => {
    const { container } = render(
      <DraftComparisonView
        originalDraft={mockOriginalDraft}
        currentDraft={mockCurrentDraft}
        className="custom-class"
      />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('should display modification timestamp', () => {
    render(
      <DraftComparisonView
        originalDraft={mockOriginalDraft}
        currentDraft={mockCurrentDraft}
      />
    )

    // Should show the modified time
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument()
  })
})