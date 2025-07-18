import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ReasoningDisplay from '../ReasoningDisplay'

const mockReasoning = {
  staff_id: 1,
  shift_id: 1,
  confidence_score: 0.85,
  primary_reasons: [
    '✓ Has required kitchen skill',
    '✓ Excellent reliability (8.5/10)',
    '✓ Available during shift time'
  ],
  considerations: [
    'Skill level: Expert',
    'Good availability with minor conflicts',
    'Cost efficiency: Moderate cost'
  ],
  alternatives_considered: [
    {
      staff_id: 2,
      score: 0.75,
      reason: 'Alternative with good availability',
      pros: ['Available', 'Has required skills'],
      cons: ['Less experience']
    },
    {
      staff_id: 3,
      score: 0.70,
      reason: 'Backup option with required skills',
      pros: ['Reliable', 'Good skills'],
      cons: ['Higher cost', 'Limited availability']
    }
  ],
  risk_factors: [
    '⚠ Potential overwork: 35 hours this week'
  ]
}

describe('ReasoningDisplay', () => {
  it('renders reasoning display with all sections', () => {
    render(
      <ReasoningDisplay
        reasoning={mockReasoning}
        staffName="John Doe"
        shiftTitle="Morning Kitchen"
      />
    )

    // Check header
    expect(screen.getByText('Assignment Reasoning')).toBeInTheDocument()
    expect(screen.getByText('Why John Doe was assigned to Morning Kitchen')).toBeInTheDocument()

    // Check confidence score
    expect(screen.getByText('85%')).toBeInTheDocument()
    expect(screen.getByText('Very good match - confident in this assignment')).toBeInTheDocument()

    // Check primary reasons
    expect(screen.getByText('Key Strengths')).toBeInTheDocument()
    expect(screen.getByText('✓ Has required kitchen skill')).toBeInTheDocument()
    expect(screen.getByText('✓ Excellent reliability (8.5/10)')).toBeInTheDocument()

    // Check considerations
    expect(screen.getByText('Additional Considerations')).toBeInTheDocument()
    expect(screen.getByText('Skill level: Expert')).toBeInTheDocument()

    // Check risk factors
    expect(screen.getByText('Risk Factors')).toBeInTheDocument()
    expect(screen.getByText('⚠ Potential overwork: 35 hours this week')).toBeInTheDocument()
  })

  it('renders in compact mode initially', () => {
    render(
      <ReasoningDisplay
        reasoning={mockReasoning}
        staffName="John Doe"
        shiftTitle="Morning Kitchen"
        compact={true}
      />
    )

    // Should show compact view initially
    expect(screen.getByText('Show details')).toBeInTheDocument()
    expect(screen.queryByText('Key Strengths')).not.toBeInTheDocument()
  })

  it('expands from compact mode when clicked', () => {
    render(
      <ReasoningDisplay
        reasoning={mockReasoning}
        staffName="John Doe"
        shiftTitle="Morning Kitchen"
        compact={true}
      />
    )

    // Click to expand
    fireEvent.click(screen.getByText('Show details'))

    // Should now show full details
    expect(screen.getByText('Key Strengths')).toBeInTheDocument()
    expect(screen.getByText('Additional Considerations')).toBeInTheDocument()
  })

  it('shows alternatives when enabled', () => {
    render(
      <ReasoningDisplay
        reasoning={mockReasoning}
        staffName="John Doe"
        shiftTitle="Morning Kitchen"
        showAlternatives={true}
      />
    )

    expect(screen.getByText('Alternative Options')).toBeInTheDocument()
    expect(screen.getByText('Alternative #1')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument() // Alternative score
    expect(screen.getByText('Alternative with good availability')).toBeInTheDocument()
  })

  it('shows pros and cons for alternatives', () => {
    render(
      <ReasoningDisplay
        reasoning={mockReasoning}
        staffName="John Doe"
        shiftTitle="Morning Kitchen"
        showAlternatives={true}
      />
    )

    expect(screen.getAllByText('Pros:')).toHaveLength(2) // Two alternatives, each with pros
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getAllByText('Cons:')).toHaveLength(2) // Two alternatives, each with cons
    expect(screen.getByText('Less experience')).toBeInTheDocument()
  })

  it('handles show all alternatives toggle', () => {
    const manyAlternatives = {
      ...mockReasoning,
      alternatives_considered: [
        ...mockReasoning.alternatives_considered,
        {
          staff_id: 4,
          score: 0.65,
          reason: 'Third alternative',
          pros: ['Available'],
          cons: ['New employee']
        }
      ]
    }

    render(
      <ReasoningDisplay
        reasoning={manyAlternatives}
        staffName="John Doe"
        shiftTitle="Morning Kitchen"
        showAlternatives={true}
      />
    )

    // Should show "Show all" button when more than 2 alternatives
    expect(screen.getByText('Show all 3')).toBeInTheDocument()
    
    // Should only show first 2 alternatives initially
    expect(screen.getByText('Alternative #1')).toBeInTheDocument()
    expect(screen.getByText('Alternative #2')).toBeInTheDocument()
    expect(screen.queryByText('Third alternative')).not.toBeInTheDocument()

    // Click to show all
    fireEvent.click(screen.getByText('Show all 3'))
    expect(screen.getByText('Third alternative')).toBeInTheDocument()
  })

  it('displays correct confidence levels and colors', () => {
    const highConfidenceReasoning = {
      ...mockReasoning,
      confidence_score: 0.95
    }

    render(
      <ReasoningDisplay
        reasoning={highConfidenceReasoning}
        staffName="John Doe"
        shiftTitle="Morning Kitchen"
      />
    )

    expect(screen.getByText('95%')).toBeInTheDocument()
    expect(screen.getByText('Excellent match - highly confident in this assignment')).toBeInTheDocument()
  })

  it('handles low confidence scores appropriately', () => {
    const lowConfidenceReasoning = {
      ...mockReasoning,
      confidence_score: 0.45
    }

    render(
      <ReasoningDisplay
        reasoning={lowConfidenceReasoning}
        staffName="John Doe"
        shiftTitle="Morning Kitchen"
      />
    )

    expect(screen.getByText('45%')).toBeInTheDocument()
    expect(screen.getByText('Poor match - high risk assignment, consider alternatives')).toBeInTheDocument()
  })

  it('handles empty sections gracefully', () => {
    const minimalReasoning = {
      staff_id: 1,
      shift_id: 1,
      confidence_score: 0.75,
      primary_reasons: ['✓ Has required skill'],
      considerations: [],
      alternatives_considered: [],
      risk_factors: []
    }

    render(
      <ReasoningDisplay
        reasoning={minimalReasoning}
        staffName="John Doe"
        shiftTitle="Morning Kitchen"
      />
    )

    // Should still render confidence and primary reasons
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('✓ Has required skill')).toBeInTheDocument()

    // Empty sections should not be rendered
    expect(screen.queryByText('Additional Considerations')).not.toBeInTheDocument()
    expect(screen.queryByText('Risk Factors')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <ReasoningDisplay
        reasoning={mockReasoning}
        staffName="John Doe"
        shiftTitle="Morning Kitchen"
        className="custom-class"
      />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })
})