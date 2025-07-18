import React, { useState } from 'react'
import { EditConflict } from '../hooks/useCollaboration'
import { ExclamationTriangleIcon, ClockIcon, UserIcon } from '@heroicons/react/24/outline'

interface ConflictResolutionModalProps {
  conflict: EditConflict
  isOpen: boolean
  onClose: () => void
  onResolve: (conflictId: string, resolution: string, data?: any) => void
}

const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  conflict,
  isOpen,
  onClose,
  onResolve
}) => {
  const [selectedResolution, setSelectedResolution] = useState<string>('')
  const [isResolving, setIsResolving] = useState(false)

  if (!isOpen) return null

  const handleResolve = async () => {
    if (!selectedResolution) return

    setIsResolving(true)
    try {
      await onResolve(conflict.conflict_id, selectedResolution)
      onClose()
    } catch (error) {
      console.error('Error resolving conflict:', error)
    } finally {
      setIsResolving(false)
    }
  }

  const getConflictDescription = () => {
    switch (conflict.conflict_type) {
      case 'concurrent_assignment':
        return 'Multiple users are trying to assign staff to shifts at the same time.'
      case 'concurrent_modification':
        return 'Multiple users are modifying the same schedule element simultaneously.'
      case 'duplicate_operation':
        return 'The same operation is being performed by multiple users.'
      case 'resource_conflict':
        return 'There is a conflict with resource allocation (e.g., staff double-booking).'
      default:
        return 'A scheduling conflict has been detected.'
    }
  }

  const getResolutionOptions = () => {
    const baseOptions = [
      {
        id: 'accept_edit1',
        title: `Keep ${conflict.edit1.user_name}'s changes`,
        description: `Accept the changes made by ${conflict.edit1.user_name} and discard ${conflict.edit2.user_name}'s changes.`,
        icon: <UserIcon className="h-5 w-5 text-blue-600" />
      },
      {
        id: 'accept_edit2',
        title: `Keep ${conflict.edit2.user_name}'s changes`,
        description: `Accept the changes made by ${conflict.edit2.user_name} and discard ${conflict.edit1.user_name}'s changes.`,
        icon: <UserIcon className="h-5 w-5 text-green-600" />
      }
    ]

    // Add merge option for compatible conflicts
    if (conflict.conflict_type === 'concurrent_modification') {
      baseOptions.push({
        id: 'merge',
        title: 'Merge both changes',
        description: 'Attempt to combine both sets of changes where possible.',
        icon: <ClockIcon className="h-5 w-5 text-purple-600" />
      })
    }

    return baseOptions
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-8 w-8 text-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Schedule Conflict Detected
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {getConflictDescription()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="sr-only">Close</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Conflict Details */}
        <div className="p-6 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Conflicting Changes:</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Edit 1 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <UserIcon className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900">{conflict.edit1.user_name}</span>
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                  {formatTimestamp(conflict.edit1.timestamp)}
                </span>
              </div>
              <p className="text-sm text-blue-800">
                Operation: <span className="font-medium">{conflict.edit1.operation}</span>
              </p>
            </div>

            {/* Edit 2 */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <UserIcon className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-900">{conflict.edit2.user_name}</span>
                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                  {formatTimestamp(conflict.edit2.timestamp)}
                </span>
              </div>
              <p className="text-sm text-green-800">
                Operation: <span className="font-medium">{conflict.edit2.operation}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Resolution Options */}
        <div className="p-6">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Choose Resolution:</h4>
          
          <div className="space-y-3">
            {getResolutionOptions().map((option) => (
              <label
                key={option.id}
                className={`
                  flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-all
                  ${selectedResolution === option.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
              >
                <input
                  type="radio"
                  name="resolution"
                  value={option.id}
                  checked={selectedResolution === option.id}
                  onChange={(e) => setSelectedResolution(e.target.value)}
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    {option.icon}
                    <span className="font-medium text-gray-900">{option.title}</span>
                  </div>
                  <p className="text-sm text-gray-600">{option.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isResolving}
          >
            Cancel
          </button>
          <button
            onClick={handleResolve}
            disabled={!selectedResolution || isResolving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResolving ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Resolving...</span>
              </div>
            ) : (
              'Resolve Conflict'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConflictResolutionModal