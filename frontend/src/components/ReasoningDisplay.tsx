import React, { useState } from 'react'
import { 
  LightBulbIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UserGroupIcon,
  ClockIcon,
  CurrencyPoundIcon
} from '@heroicons/react/24/outline'

interface AssignmentReasoning {
  staff_id: number
  shift_id: number
  confidence_score: number
  primary_reasons: string[]
  considerations: string[]
  alternatives_considered: Array<{
    staff_id: number
    score: number
    reason: string
    pros?: string[]
    cons?: string[]
  }>
  risk_factors: string[]
}

interface ReasoningDisplayProps {
  reasoning: AssignmentReasoning
  staffName: string
  shiftTitle: string
  compact?: boolean
  showAlternatives?: boolean
  className?: string
}

const ReasoningDisplay: React.FC<ReasoningDisplayProps> = ({
  reasoning,
  staffName,
  shiftTitle,
  compact = false,
  showAlternatives = false,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(!compact)
  const [showFullAlternatives, setShowFullAlternatives] = useState(false)

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 0.6) return 'text-amber-600 bg-amber-50 border-amber-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.9) return 'Excellent'
    if (score >= 0.8) return 'Very Good'
    if (score >= 0.7) return 'Good'
    if (score >= 0.6) return 'Acceptable'
    if (score >= 0.5) return 'Marginal'
    return 'Poor'
  }

  const getConfidenceDescription = (score: number) => {
    if (score >= 0.9) return 'Excellent match - highly confident in this assignment'
    if (score >= 0.8) return 'Very good match - confident in this assignment'
    if (score >= 0.7) return 'Good match - reasonably confident in this assignment'
    if (score >= 0.6) return 'Acceptable match - some concerns but workable'
    if (score >= 0.5) return 'Marginal match - significant concerns to consider'
    return 'Poor match - high risk assignment, consider alternatives'
  }

  if (compact && !isExpanded) {
    return (
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <LightBulbIcon className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-900">Assignment Reasoning</span>
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getConfidenceColor(reasoning.confidence_score)}`}>
              {getConfidenceBadge(reasoning.confidence_score)} ({Math.round(reasoning.confidence_score * 100)}%)
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(true)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center space-x-1"
          >
            <span>Show details</span>
            <ChevronDownIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <LightBulbIcon className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900">Assignment Reasoning</h3>
          </div>
          {compact && (
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <ChevronUpIcon className="h-5 w-5" />
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Why {staffName} was assigned to {shiftTitle}
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Confidence Score */}
        <div className={`rounded-lg p-4 border ${getConfidenceColor(reasoning.confidence_score)}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-current opacity-60"></div>
              <span className="font-semibold">Confidence Score</span>
            </div>
            <span className="text-2xl font-bold">{Math.round(reasoning.confidence_score * 100)}%</span>
          </div>
          <p className="text-sm opacity-80">
            {getConfidenceDescription(reasoning.confidence_score)}
          </p>
        </div>

        {/* Primary Reasons */}
        {reasoning.primary_reasons.length > 0 && (
          <div>
            <h4 className="flex items-center space-x-2 text-sm font-semibold text-gray-900 mb-3">
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
              <span>Key Strengths</span>
            </h4>
            <div className="space-y-2">
              {reasoning.primary_reasons.map((reason, index) => (
                <div key={index} className="flex items-start space-x-2 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">{reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Considerations */}
        {reasoning.considerations.length > 0 && (
          <div>
            <h4 className="flex items-center space-x-2 text-sm font-semibold text-gray-900 mb-3">
              <InformationCircleIcon className="h-4 w-4 text-blue-500" />
              <span>Additional Considerations</span>
            </h4>
            <div className="space-y-2">
              {reasoning.considerations.map((consideration, index) => (
                <div key={index} className="flex items-start space-x-2 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">{consideration}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Factors */}
        {reasoning.risk_factors.length > 0 && (
          <div>
            <h4 className="flex items-center space-x-2 text-sm font-semibold text-gray-900 mb-3">
              <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
              <span>Risk Factors</span>
            </h4>
            <div className="space-y-2">
              {reasoning.risk_factors.map((risk, index) => (
                <div key={index} className="flex items-start space-x-2 text-sm">
                  <div className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">{risk}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alternatives */}
        {showAlternatives && reasoning.alternatives_considered.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="flex items-center space-x-2 text-sm font-semibold text-gray-900">
                <UserGroupIcon className="h-4 w-4 text-purple-500" />
                <span>Alternative Options</span>
              </h4>
              {reasoning.alternatives_considered.length > 2 && (
                <button
                  onClick={() => setShowFullAlternatives(!showFullAlternatives)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {showFullAlternatives ? 'Show less' : `Show all ${reasoning.alternatives_considered.length}`}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {(showFullAlternatives ? reasoning.alternatives_considered : reasoning.alternatives_considered.slice(0, 2))
                .map((alternative, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      Alternative #{index + 1}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">Match Score:</span>
                      <span className="text-xs font-medium text-gray-900">
                        {Math.round(alternative.score * 100)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{alternative.reason}</p>
                  
                  {(alternative.pros || alternative.cons) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      {alternative.pros && alternative.pros.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-green-700">Pros:</span>
                          <ul className="text-xs text-gray-600 mt-1 space-y-1">
                            {alternative.pros.map((pro, proIndex) => (
                              <li key={proIndex} className="flex items-start space-x-1">
                                <span className="text-green-500">+</span>
                                <span>{pro}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {alternative.cons && alternative.cons.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-red-700">Cons:</span>
                          <ul className="text-xs text-gray-600 mt-1 space-y-1">
                            {alternative.cons.map((con, conIndex) => (
                              <li key={conIndex} className="flex items-start space-x-1">
                                <span className="text-red-500">-</span>
                                <span>{con}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ReasoningDisplay