import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import UserPresenceIndicator from '../UserPresenceIndicator'
import { UserPresence } from '../../hooks/useCollaboration'

const mockUsers: UserPresence[] = [
  {
    user_id: 1,
    user_name: 'John Doe',
    business_id: 123,
    draft_id: 'draft_123',
    action: 'editing',
    last_seen: new Date().toISOString(),
    websocket_id: 'ws_1'
  },
  {
    user_id: 2,
    user_name: 'Jane Smith',
    business_id: 123,
    draft_id: 'draft_123',
    action: 'viewing',
    last_seen: new Date().toISOString(),
    websocket_id: 'ws_2'
  },
  {
    user_id: 3,
    user_name: 'Bob Johnson',
    business_id: 123,
    draft_id: 'draft_123',
    action: 'idle',
    last_seen: new Date().toISOString(),
    websocket_id: 'ws_3'
  }
]

describe('UserPresenceIndicator', () => {
  it('renders nothing when no users are provided', () => {
    const { container } = render(<UserPresenceIndicator users={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('displays correct user count for single user', () => {
    render(<UserPresenceIndicator users={[mockUsers[0]]} />)
    expect(screen.getByText('1 other user')).toBeInTheDocument()
    expect(screen.getByText('online')).toBeInTheDocument()
  })

  it('displays correct user count for multiple users', () => {
    render(<UserPresenceIndicator users={mockUsers} />)
    expect(screen.getByText('3 other users')).toBeInTheDocument()
    expect(screen.getByText('online')).toBeInTheDocument()
  })

  it('displays user avatars with correct initials', () => {
    render(<UserPresenceIndicator users={mockUsers} />)
    
    // Check that user initials are displayed
    expect(screen.getByText('J')).toBeInTheDocument() // John Doe
    expect(screen.getByText('B')).toBeInTheDocument() // Bob Johnson
    
    // Jane Smith's 'J' might conflict with John Doe's 'J', so we check for multiple J's
    const jElements = screen.getAllByText('J')
    expect(jElements.length).toBeGreaterThanOrEqual(1)
  })

  it('applies correct styling based on user action', () => {
    render(<UserPresenceIndicator users={mockUsers} showActions={true} />)
    
    const avatars = screen.getAllByRole('generic').filter(el => 
      el.className.includes('rounded-full') && el.className.includes('border-2')
    )
    
    // Check that different action colors are applied
    expect(avatars.some(avatar => 
      avatar.className.includes('bg-green-500')
    )).toBe(true) // editing user
    
    expect(avatars.some(avatar => 
      avatar.className.includes('bg-blue-500')
    )).toBe(true) // viewing user
    
    expect(avatars.some(avatar => 
      avatar.className.includes('bg-gray-400')
    )).toBe(true) // idle user
  })

  it('shows tooltip on hover', async () => {
    render(<UserPresenceIndicator users={[mockUsers[0]]} />)
    
    const avatar = screen.getByText('J')
    
    // Check that tooltip attributes are present
    expect(avatar.closest('[title]')).toHaveAttribute('title', 'John Doe - Editing')
  })

  it('limits visible users based on maxVisible prop', () => {
    render(<UserPresenceIndicator users={mockUsers} maxVisible={2} />)
    
    // Should show 2 user avatars plus a "+1" indicator
    const avatars = screen.getAllByRole('generic').filter(el => 
      el.className.includes('rounded-full')
    )
    
    // Should have 2 user avatars + 1 overflow indicator
    expect(avatars).toHaveLength(3)
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  it('hides action indicators when showActions is false', () => {
    render(<UserPresenceIndicator users={mockUsers} showActions={false} />)
    
    // Action indicator icons should not be present
    const actionIndicators = screen.queryAllByRole('generic').filter(el => 
      el.className.includes('absolute') && el.className.includes('-bottom-1')
    )
    
    expect(actionIndicators).toHaveLength(0)
  })

  it('shows action indicators when showActions is true', () => {
    render(<UserPresenceIndicator users={mockUsers} showActions={true} />)
    
    // Action indicator icons should be present
    const actionIndicators = screen.getAllByRole('generic').filter(el => 
      el.className.includes('absolute') && el.className.includes('-bottom-1')
    )
    
    expect(actionIndicators.length).toBeGreaterThan(0)
  })

  it('applies custom className', () => {
    const { container } = render(
      <UserPresenceIndicator users={mockUsers} className="custom-class" />
    )
    
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('handles overflow correctly with many users', () => {
    const manyUsers = Array.from({ length: 10 }, (_, i) => ({
      ...mockUsers[0],
      user_id: i + 1,
      user_name: `User ${i + 1}`,
      websocket_id: `ws_${i + 1}`
    }))
    
    render(<UserPresenceIndicator users={manyUsers} maxVisible={3} />)
    
    // Should show 3 user avatars plus a "+7" indicator
    expect(screen.getByText('+7')).toBeInTheDocument()
  })

  it('shows correct action text in tooltips', () => {
    const editingUser = { ...mockUsers[0], action: 'editing' as const }
    const viewingUser = { ...mockUsers[1], action: 'viewing' as const }
    const idleUser = { ...mockUsers[2], action: 'idle' as const }
    
    render(<UserPresenceIndicator users={[editingUser, viewingUser, idleUser]} />)
    
    // Check tooltip titles
    expect(screen.getByTitle('John Doe - Editing')).toBeInTheDocument()
    expect(screen.getByTitle('Jane Smith - Viewing')).toBeInTheDocument()
    expect(screen.getByTitle('Bob Johnson - Idle')).toBeInTheDocument()
  })

  it('handles empty user names gracefully', () => {
    const userWithEmptyName = { ...mockUsers[0], user_name: '' }
    
    render(<UserPresenceIndicator users={[userWithEmptyName]} />)
    
    // Should still render but might show empty initial or fallback
    expect(screen.getByText('1 other user')).toBeInTheDocument()
  })

  it('handles users with single character names', () => {
    const userWithSingleChar = { ...mockUsers[0], user_name: 'A' }
    
    render(<UserPresenceIndicator users={[userWithSingleChar]} />)
    
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('handles special characters in user names', () => {
    const userWithSpecialChars = { ...mockUsers[0], user_name: 'José María' }
    
    render(<UserPresenceIndicator users={[userWithSpecialChars]} />)
    
    expect(screen.getByText('J')).toBeInTheDocument()
    expect(screen.getByTitle('José María - Editing')).toBeInTheDocument()
  })
})