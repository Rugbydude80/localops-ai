import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EnhancedShiftCalendar from '../EnhancedShiftCalendar'

// Mock the API functions
vi.mock('../../lib/api', () => ({
  getShifts: vi.fn(),
  getStaff: vi.fn(),
  assignStaffToShift: vi.fn(),
  unassignStaff: vi.fn(),
  generateAISchedule: vi.fn(),
}))

// Mock React DnD
vi.mock('react-dnd', () => ({
  useDrag: vi.fn(() => [{ isDragging: false }, vi.fn()]),
  useDrop: vi.fn(() => [{ isOver: false }, vi.fn()]),
  DndProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('react-dnd-html5-backend', () => ({
  HTML5Backend: vi.fn(),
}))

const mockShifts = [
  {
    id: 1,
    title: 'Morning Kitchen',
    date: '2024-01-15',
    start_time: '06:00',
    end_time: '14:00',
    required_skill: 'kitchen',
    required_staff_count: 2,
    hourly_rate: 15.00,
    status: 'scheduled' as const,
    assignments: [
      {
        id: 1,
        staff_id: 1,
        staff_name: 'Chef Michael',
        status: 'assigned' as const,
        confidence_score: 0.9,
        is_ai_generated: true,
        manual_override: false,
      }
    ],
    confidence_score: 0.85,
    ai_generated: true,
    notes: 'Morning kitchen prep shift'
  },
  {
    id: 2,
    title: 'Lunch Service',
    date: '2024-01-15',
    start_time: '11:00',
    end_time: '16:00',
    required_skill: 'front_of_house',
    required_staff_count: 3,
    hourly_rate: 12.50,
    status: 'open' as const,
    assignments: [],
    confidence_score: 0.0,
    ai_generated: false,
    notes: 'Lunch service shift'
  }
]

const mockStaff = [
  {
    id: 1,
    name: 'Chef Michael',
    skills: ['kitchen', 'management'],
    hourly_rate: 18.50,
    is_available: true,
    reliability_score: 9.2,
    role: 'head_chef',
    availability: {
      monday: ['06:00-16:00'],
      tuesday: ['06:00-16:00'],
      wednesday: ['06:00-16:00'],
      thursday: ['06:00-16:00'],
      friday: ['06:00-16:00'],
      saturday: ['06:00-16:00'],
      sunday: ['06:00-16:00']
    }
  },
  {
    id: 2,
    name: 'Server Emma',
    skills: ['front_of_house'],
    hourly_rate: 12.75,
    is_available: true,
    reliability_score: 8.7,
    role: 'server',
    availability: {
      monday: ['11:00-19:00'],
      tuesday: ['11:00-19:00'],
      wednesday: ['11:00-19:00'],
      thursday: ['11:00-19:00'],
      friday: ['11:00-19:00'],
      saturday: ['11:00-19:00'],
      sunday: ['11:00-19:00']
    }
  }
]

describe('EnhancedShiftCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders calendar with shifts and staff', async () => {
    render(
      <EnhancedShiftCalendar
        shifts={mockShifts as any}
        staff={mockStaff}
        businessId={1}
        selectedDate={new Date('2024-01-15')}
        onDateChange={vi.fn()}
        onStaffAssign={vi.fn()}
        onStaffUnassign={vi.fn()}
      />
    )

    // Check that shifts are rendered
    await waitFor(() => {
      expect(screen.getByText('Morning Kitchen')).toBeInTheDocument()
      expect(screen.getByText('Lunch Service')).toBeInTheDocument()
    })

    // Check that staff are rendered
    expect(screen.getByText('Chef Michael')).toBeInTheDocument()
    expect(screen.getByText('Server Emma')).toBeInTheDocument()
  })

  it('displays shift details correctly', async () => {
    render(
      <EnhancedShiftCalendar
        shifts={mockShifts}
        staff={mockStaff}
        businessId={1}
        onShiftUpdate={vi.fn()}
        onStaffAssign={vi.fn()}
        onStaffUnassign={vi.fn()}
      />
    )

    await waitFor(() => {
      // Check shift times
      expect(screen.getByText('06:00-14:00')).toBeInTheDocument()
      expect(screen.getByText('11:00-16:00')).toBeInTheDocument()
      
      // Check required skills
      expect(screen.getByText('kitchen')).toBeInTheDocument()
      expect(screen.getByText('front_of_house')).toBeInTheDocument()
      
      // Check staff counts
      expect(screen.getByText('1/2')).toBeInTheDocument() // Morning Kitchen has 1 assigned, needs 2
      expect(screen.getByText('0/3')).toBeInTheDocument() // Lunch Service has 0 assigned, needs 3
    })
  })

  it('shows AI confidence indicators', async () => {
    render(
      <EnhancedShiftCalendar
        shifts={mockShifts}
        staff={mockStaff}
        businessId={1}
        onShiftUpdate={vi.fn()}
        onStaffAssign={vi.fn()}
        onStaffUnassign={vi.fn()}
      />
    )

    await waitFor(() => {
      // Check AI confidence score is displayed
      expect(screen.getByText('85%')).toBeInTheDocument()
    })
  })

  it('displays staff skills with icons', async () => {
    render(
      <EnhancedShiftCalendar
        shifts={mockShifts}
        staff={mockStaff}
        businessId={1}
        onShiftUpdate={vi.fn()}
        onStaffAssign={vi.fn()}
        onStaffUnassign={vi.fn()}
      />
    )

    await waitFor(() => {
      // Check that staff skills are displayed
      expect(screen.getByText('kitchen')).toBeInTheDocument()
      expect(screen.getByText('management')).toBeInTheDocument()
      expect(screen.getByText('front_of_house')).toBeInTheDocument()
    })
  })

  it('shows coverage status indicators', async () => {
    render(
      <EnhancedShiftCalendar
        shifts={mockShifts}
        staff={mockStaff}
        businessId={1}
        onShiftUpdate={vi.fn()}
        onStaffAssign={vi.fn()}
        onStaffUnassign={vi.fn()}
      />
    )

    await waitFor(() => {
      // Check coverage percentages
      expect(screen.getByText('50%')).toBeInTheDocument() // Morning Kitchen: 1/2 = 50%
      expect(screen.getByText('0%')).toBeInTheDocument() // Lunch Service: 0/3 = 0%
    })
  })

  it('displays staff reliability scores', async () => {
    render(
      <EnhancedShiftCalendar
        shifts={mockShifts}
        staff={mockStaff}
        businessId={1}
        onShiftUpdate={vi.fn()}
        onStaffAssign={vi.fn()}
        onStaffUnassign={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('9.2')).toBeInTheDocument() // Chef Michael's reliability
      expect(screen.getByText('8.7')).toBeInTheDocument() // Server Emma's reliability
    })
  })

  it('shows AI vs manual assignment indicators', async () => {
    render(
      <EnhancedShiftCalendar
        shifts={mockShifts}
        staff={mockStaff}
        businessId={1}
        onShiftUpdate={vi.fn()}
        onStaffAssign={vi.fn()}
        onStaffUnassign={vi.fn()}
      />
    )

    await waitFor(() => {
      // Check that AI-generated assignment is indicated
      expect(screen.getByText('AI')).toBeInTheDocument()
    })
  })

  it('handles empty shifts and staff gracefully', () => {
    render(
      <EnhancedShiftCalendar
        shifts={[]}
        staff={[]}
        businessId={1}
        onShiftUpdate={vi.fn()}
        onStaffAssign={vi.fn()}
        onStaffUnassign={vi.fn()}
      />
    )

    // Should render without crashing
    expect(screen.getByText('No shifts available')).toBeInTheDocument()
  })

  it('displays shift status correctly', async () => {
    render(
      <EnhancedShiftCalendar
        shifts={mockShifts}
        staff={mockStaff}
        businessId={1}
        onShiftUpdate={vi.fn()}
        onStaffAssign={vi.fn()}
        onStaffUnassign={vi.fn()}
      />
    )

    await waitFor(() => {
      // Check status indicators
      expect(screen.getByText('scheduled')).toBeInTheDocument()
      expect(screen.getByText('open')).toBeInTheDocument()
    })
  })

  it('shows hourly rates for shifts', async () => {
    render(
      <EnhancedShiftCalendar
        shifts={mockShifts}
        staff={mockStaff}
        businessId={1}
        onShiftUpdate={vi.fn()}
        onStaffAssign={vi.fn()}
        onStaffUnassign={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('£15.00')).toBeInTheDocument()
      expect(screen.getByText('£12.50')).toBeInTheDocument()
    })
  })

  it('displays staff hourly rates', async () => {
    render(
      <EnhancedShiftCalendar
        shifts={mockShifts}
        staff={mockStaff}
        businessId={1}
        onShiftUpdate={vi.fn()}
        onStaffAssign={vi.fn()}
        onStaffUnassign={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('£18.50')).toBeInTheDocument() // Chef Michael
      expect(screen.getByText('£12.75')).toBeInTheDocument() // Server Emma
    })
  })
}) 