import React from 'react'
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'

interface ConfidenceIndicatorProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  showPercentage?: boolean
  showIcon?: boolean
  className?: string
}

const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  score,
  size = 'md',
  showLabel = true,
  showPercentage = true,
  showIcon = true,
  className = ''
}) => {
  const getConfidenceData = (score: number) => {
    if (score >= 0.9) {
      return {
        label: 'Excellent',
        color: 'text-green-700 bg-green-100 border-green-300',
        icon: CheckCircleIcon,
        description: 'Highly confident assignment'
      }
    } else if (score >= 0.8) {
      return {
        label: 'Very Good',
        color: 'text-green-600 bg-green-50 border-green-200',
        icon: CheckCircleIcon,
        description: 'Confident assignment'
      }
    } else if (score >= 0.7) {
      return {
        label: 'Good',
        color: 'text-blue-600 bg-blue-50 border-blue-200',
        icon: InformationCircleIcon,
        description: 'Reasonably confident'
      }
    } else if (score >= 0.6) {
      return {
        label: 'Acceptable',
        color: 'text-amber-600 bg-amber-50 border-amber-200',
        icon: ExclamationTriangleIcon,
        description: 'Some concerns but workable'
      }
    } else if (score >= 0.5) {
      return {
        label: 'Marginal',
        color: 'text-orange-600 bg-orange-50 border-orange-200',
        icon: ExclamationTriangleIcon,
        description: 'Significant concerns'
      }
    } else {
      return {
        label: 'Poor',
        color: 'text-red-600 bg-red-50 border-red-200',
        icon: XCircleIcon,
        description: 'High risk assignment'
      }
    }
  }

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'sm':
        return {
          container: 'px-2 py-1 text-xs',
          icon: 'h-3 w-3',
          text: 'text-xs'
        }
      case 'lg':
        return {
          container: 'px-4 py-2 text-base',
          icon: 'h-5 w-5',
          text: 'text-base'
        }
      default:
        return {
          container: 'px-3 py-1.5 text-sm',
          icon: 'h-4 w-4',
          text: 'text-sm'
        }
    }
  }

  const confidenceData = getConfidenceData(score)
  const sizeClasses = getSizeClasses(size)
  const IconComponent = confidenceData.icon

  return (
    <div 
      className={`inline-flex items-center space-x-1.5 rounded-full border font-medium ${confidenceData.color} ${sizeClasses.container} ${className}`}
      title={confidenceData.description}
    >
      {showIcon && (
        <IconComponent className={sizeClasses.icon} />
      )}
      
      <div className="flex items-center space-x-1">
        {showLabel && (
          <span className={sizeClasses.text}>
            {confidenceData.label}
          </span>
        )}
        
        {showPercentage && (
          <span className={`${sizeClasses.text} font-semibold`}>
            {showLabel && '('}
            {Math.round(score * 100)}%
            {showLabel && ')'}
          </span>
        )}
      </div>
    </div>
  )
}

interface ConfidenceBarProps {
  score: number
  height?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({
  score,
  height = 'md',
  showLabel = true,
  className = ''
}) => {
  const getBarColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500'
    if (score >= 0.6) return 'bg-amber-500'
    return 'bg-red-500'
  }

  const getHeightClass = (height: string) => {
    switch (height) {
      case 'sm': return 'h-1'
      case 'lg': return 'h-3'
      default: return 'h-2'
    }
  }

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">Confidence</span>
          <span className="text-sm text-gray-600">{Math.round(score * 100)}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full ${getHeightClass(height)}`}>
        <div 
          className={`${getHeightClass(height)} rounded-full transition-all duration-300 ${getBarColor(score)}`}
          style={{ width: `${Math.min(100, score * 100)}%` }}
        />
      </div>
    </div>
  )
}

interface ConfidenceGridProps {
  assignments: Array<{
    id: number
    staffName: string
    shiftTitle: string
    confidence_score: number
  }>
  onAssignmentClick?: (assignmentId: number) => void
}

export const ConfidenceGrid: React.FC<ConfidenceGridProps> = ({
  assignments,
  onAssignmentClick
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {assignments.map((assignment) => (
        <div 
          key={assignment.id}
          className={`bg-white rounded-lg border border-gray-200 p-4 ${
            onAssignmentClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
          }`}
          onClick={() => onAssignmentClick?.(assignment.id)}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="font-medium text-gray-900">{assignment.staffName}</h4>
              <p className="text-sm text-gray-600">{assignment.shiftTitle}</p>
            </div>
          </div>
          
          <div className="mt-3">
            <ConfidenceBar 
              score={assignment.confidence_score}
              height="sm"
              showLabel={false}
            />
            <div className="flex items-center justify-between mt-1">
              <ConfidenceIndicator
                score={assignment.confidence_score}
                size="sm"
                showPercentage={false}
                showIcon={false}
              />
              <span className="text-xs text-gray-500">
                {Math.round(assignment.confidence_score * 100)}%
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default ConfidenceIndicator