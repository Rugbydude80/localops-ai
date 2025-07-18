import React from 'react'
import { UserPresence } from '../hooks/useCollaboration'
import { UserIcon, EyeIcon, PencilIcon } from '@heroicons/react/24/outline'

interface UserPresenceIndicatorProps {
  users: UserPresence[]
  className?: string
  maxVisible?: number
  showActions?: boolean
}

const UserPresenceIndicator: React.FC<UserPresenceIndicatorProps> = ({
  users,
  className = '',
  maxVisible = 5,
  showActions = true
}) => {
  const visibleUsers = users.slice(0, maxVisible)
  const hiddenCount = Math.max(0, users.length - maxVisible)

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'editing':
        return <PencilIcon className="h-3 w-3" />
      case 'viewing':
        return <EyeIcon className="h-3 w-3" />
      default:
        return <UserIcon className="h-3 w-3" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'editing':
        return 'bg-green-500 border-green-600'
      case 'viewing':
        return 'bg-blue-500 border-blue-600'
      case 'idle':
        return 'bg-gray-400 border-gray-500'
      default:
        return 'bg-gray-400 border-gray-500'
    }
  }

  const getActionText = (action: string) => {
    switch (action) {
      case 'editing':
        return 'Editing'
      case 'viewing':
        return 'Viewing'
      case 'idle':
        return 'Idle'
      default:
        return 'Unknown'
    }
  }

  if (users.length === 0) {
    return null
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex items-center space-x-1">
        <span className="text-sm text-gray-600 font-medium">
          {users.length === 1 ? '1 other user' : `${users.length} other users`}
        </span>
        {users.length > 0 && (
          <span className="text-xs text-gray-500">online</span>
        )}
      </div>

      {/* User avatars */}
      <div className="flex -space-x-2">
        {visibleUsers.map((user) => (
          <div
            key={user.user_id}
            className="group relative"
            title={`${user.user_name} - ${getActionText(user.action)}`}
          >
            <div
              className={`
                w-8 h-8 rounded-full border-2 flex items-center justify-center text-white text-xs font-medium
                ${getActionColor(user.action)}
                hover:z-10 transition-all duration-200 hover:scale-110
              `}
            >
              {user.user_name.charAt(0).toUpperCase()}
            </div>
            
            {/* Action indicator */}
            {showActions && (
              <div
                className={`
                  absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white
                  flex items-center justify-center
                  ${getActionColor(user.action)}
                `}
              >
                {getActionIcon(user.action)}
              </div>
            )}

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
              <div className="font-medium">{user.user_name}</div>
              <div className="text-gray-300">{getActionText(user.action)}</div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        ))}

        {/* Show count of hidden users */}
        {hiddenCount > 0 && (
          <div
            className="w-8 h-8 rounded-full border-2 border-gray-300 bg-gray-100 flex items-center justify-center text-gray-600 text-xs font-medium"
            title={`${hiddenCount} more user${hiddenCount > 1 ? 's' : ''}`}
          >
            +{hiddenCount}
          </div>
        )}
      </div>
    </div>
  )
}

export default UserPresenceIndicator