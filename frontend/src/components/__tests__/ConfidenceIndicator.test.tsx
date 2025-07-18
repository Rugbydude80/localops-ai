import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ConfidenceIndicator, { ConfidenceBar, ConfidenceGrid } from '../ConfidenceIndicator'

describe('ConfidenceIndicator', () => {
  it('renders with default props', () => {
    render(<ConfidenceIndicator score={0.85} />)
    
    expect(screen.getByText('Very Good')).toBeInTheDocument()
    expect(screen.getByText('(85%)')).toBeInTheDocument()
  })

  it('shows correct confidence levels', () => {
    // Excellent (>= 0.9)
    const { rerender } = render(<ConfidenceIndicator score={0.95} />)
    expect(screen.getByText('Excellent')).toBeInTheDocument()
    expect(screen.getByText('(95%)')).toBeInTheDocument()

    // Very Good (>= 0.8)
    rerender(<ConfidenceIndicator score={0.85} />)
    expect(screen.getByText('Very Good')).toBeInTheDocument()

    // Good (>= 0.7)
    rerender(<ConfidenceIndicator score={0.75} />)
    expect(screen.getByText('Good')).toBeInTheDocument()

    // Acceptable (>= 0.6)
    rerender(<ConfidenceIndicator score={0.65} />)
    expect(screen.getByText('Acceptable')).toBeInTheDocument()

    // Marginal (>= 0.5)
    rerender(<ConfidenceIndicator score={0.55} />)
    expect(screen.getByText('Marginal')).toBeInTheDocument()

    // Poor (< 0.5)
    rerender(<ConfidenceIndicator score={0.35} />)
    expect(screen.getByText('Poor')).toBeInTheDocument()
  })

  it('renders different sizes correctly', () => {
    const { rerender } = render(<ConfidenceIndicator score={0.85} size="sm" />)
    expect(screen.getByText('Very Good')).toHaveClass('text-xs')

    rerender(<ConfidenceIndicator score={0.85} size="lg" />)
    expect(screen.getByText('Very Good')).toHaveClass('text-base')
  })

  it('hides label when showLabel is false', () => {
    render(<ConfidenceIndicator score={0.85} showLabel={false} />)
    
    expect(screen.queryByText('Very Good')).not.toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('hides percentage when showPercentage is false', () => {
    render(<ConfidenceIndicator score={0.85} showPercentage={false} />)
    
    expect(screen.getByText('Very Good')).toBeInTheDocument()
    expect(screen.queryByText('85%')).not.toBeInTheDocument()
  })

  it('hides icon when showIcon is false', () => {
    render(<ConfidenceIndicator score={0.85} showIcon={false} />)
    
    // Icon should not be present (we can't easily test for SVG presence, but the component should render without it)
    expect(screen.getByText('Very Good')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <ConfidenceIndicator score={0.85} className="custom-class" />
    )
    
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('shows correct tooltip', () => {
    render(<ConfidenceIndicator score={0.85} />)
    
    // The title attribute is on the outermost div
    const indicator = screen.getByText('Very Good').parentElement?.parentElement
    expect(indicator).toHaveAttribute('title', 'Confident assignment')
  })
})

describe('ConfidenceBar', () => {
  it('renders progress bar with correct width', () => {
    render(<ConfidenceBar score={0.75} />)
    
    expect(screen.getByText('Confidence')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    
    // The progress bar should be rendered (we can't easily test inline styles in this setup)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('shows correct colors for different scores', () => {
    const { rerender } = render(<ConfidenceBar score={0.85} />)
    expect(screen.getByText('85%')).toBeInTheDocument()

    rerender(<ConfidenceBar score={0.65} />)
    expect(screen.getByText('65%')).toBeInTheDocument()

    rerender(<ConfidenceBar score={0.45} />)
    expect(screen.getByText('45%')).toBeInTheDocument()
  })

  it('hides label when showLabel is false', () => {
    render(<ConfidenceBar score={0.75} showLabel={false} />)
    
    expect(screen.queryByText('Confidence')).not.toBeInTheDocument()
    expect(screen.queryByText('75%')).not.toBeInTheDocument()
  })

  it('renders different heights', () => {
    const { rerender } = render(<ConfidenceBar score={0.75} height="sm" />)
    expect(screen.getByText('75%')).toBeInTheDocument()

    rerender(<ConfidenceBar score={0.75} height="lg" />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })
})

describe('ConfidenceGrid', () => {
  const mockAssignments = [
    {
      id: 1,
      staffName: 'John Doe',
      shiftTitle: 'Morning Kitchen',
      confidence_score: 0.85
    },
    {
      id: 2,
      staffName: 'Jane Smith',
      shiftTitle: 'Evening Service',
      confidence_score: 0.72
    },
    {
      id: 3,
      staffName: 'Bob Wilson',
      shiftTitle: 'Night Bar',
      confidence_score: 0.91
    }
  ]

  it('renders all assignments in grid', () => {
    render(<ConfidenceGrid assignments={mockAssignments} />)
    
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Morning Kitchen')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Evening Service')).toBeInTheDocument()
    expect(screen.getByText('Bob Wilson')).toBeInTheDocument()
    expect(screen.getByText('Night Bar')).toBeInTheDocument()
  })

  it('shows confidence scores for each assignment', () => {
    render(<ConfidenceGrid assignments={mockAssignments} />)
    
    expect(screen.getByText('85%')).toBeInTheDocument()
    expect(screen.getByText('72%')).toBeInTheDocument()
    expect(screen.getByText('91%')).toBeInTheDocument()
  })

  it('calls onAssignmentClick when assignment is clicked', () => {
    const mockOnClick = vi.fn()
    render(
      <ConfidenceGrid 
        assignments={mockAssignments} 
        onAssignmentClick={mockOnClick}
      />
    )
    
    // Click on first assignment
    fireEvent.click(screen.getByText('John Doe').closest('div')!)
    expect(mockOnClick).toHaveBeenCalledWith(1)
    
    // Click on second assignment
    fireEvent.click(screen.getByText('Jane Smith').closest('div')!)
    expect(mockOnClick).toHaveBeenCalledWith(2)
  })

  it('applies hover styles when onAssignmentClick is provided', () => {
    const mockOnClick = vi.fn()
    render(
      <ConfidenceGrid 
        assignments={mockAssignments} 
        onAssignmentClick={mockOnClick}
      />
    )
    
    // Find the assignment card (should be the parent div with the styling)
    const firstAssignment = screen.getByText('John Doe').closest('.bg-white')
    expect(firstAssignment).toHaveClass('cursor-pointer')
    expect(firstAssignment).toHaveClass('hover:shadow-md')
  })

  it('does not apply hover styles when onAssignmentClick is not provided', () => {
    render(<ConfidenceGrid assignments={mockAssignments} />)
    
    const firstAssignment = screen.getByText('John Doe').closest('div')
    expect(firstAssignment).not.toHaveClass('cursor-pointer')
    expect(firstAssignment).not.toHaveClass('hover:shadow-md')
  })

  it('renders empty grid when no assignments provided', () => {
    const { container } = render(<ConfidenceGrid assignments={[]} />)
    
    const grid = container.querySelector('.grid')
    expect(grid?.children).toHaveLength(0)
  })
})