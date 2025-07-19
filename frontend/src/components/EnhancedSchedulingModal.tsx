import React, { useState, useEffect } from 'react'
import { Dialog } from '@headlessui/react'
import { 
  CalendarIcon, 
  ClockIcon, 
  UserGroupIcon, 
  CogIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns'

interface ShiftTemplate {
  id: number
  name: string
  description?: string
  start_time: string
  end_time: string
  break_start?: string
  break_duration?: number
  required_skills: string[]
  min_staff_count: number
  max_staff_count?: number
  hourly_rate?: number
}

interface EmployeeAvailability {
  id: number
  staff_id: number
  staff_name: string
  day_of_week: number
  availability_type: 'available' | 'if_needed' | 'unavailable'
  start_time?: string
  end_time?: string
  priority: string
  notes?: string
}

interface WeeklyHourAllocation {
  id: number
  staff_id: number
  staff_name: string
  week_start: string
  target_hours: number
  allocated_hours: number
  actual_hours?: number
  overtime_hours: number
  status: string
}

interface EnhancedSchedulingModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (params: any) => void
  businessId: number
  selectedDate: Date
}

const EnhancedSchedulingModal: React.FC<EnhancedSchedulingModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  businessId,
  selectedDate
}) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'availability' | 'hours' | 'settings'>('templates')
  const [selectedTemplates, setSelectedTemplates] = useState<number[]>([])
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [availability, setAvailability] = useState<EmployeeAvailability[]>([])
  const [hourAllocations, setHourAllocations] = useState<WeeklyHourAllocation[]>([])
  const [schedulingParams, setSchedulingParams] = useState({
    use_templates: true,
    respect_availability: true,
    optimize_hours: true,
    strategy: 'balanced',
    special_events: [],
    staff_notes: [],
    constraints: {}
  })
  const [isLoading, setIsLoading] = useState(false)

  // Calculate week range
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
      loadAvailability()
      loadHourAllocations()
    }
  }, [isOpen, businessId])

  const loadTemplates = async () => {
    try {
      const response = await fetch(`/api/shift-templates/${businessId}`)
      const data = await response.json()
      setTemplates(data)
    } catch (error) {
      console.error('Failed to load templates:', error)
    }
  }

  const loadAvailability = async () => {
    try {
      const response = await fetch(`/api/employee-availability/${businessId}`)
      const data = await response.json()
      setAvailability(data)
    } catch (error) {
      console.error('Failed to load availability:', error)
    }
  }

  const loadHourAllocations = async () => {
    try {
      const response = await fetch(`/api/weekly-hour-allocations/${businessId}?week_start=${weekStart.toISOString().split('T')[0]}`)
      const data = await response.json()
      setHourAllocations(data)
    } catch (error) {
      console.error('Failed to load hour allocations:', error)
    }
  }

  const handleGenerate = async () => {
    setIsLoading(true)
    try {
      const params = {
        date_range_start: weekStart.toISOString().split('T')[0],
        date_range_end: weekEnd.toISOString().split('T')[0],
        ...schedulingParams,
        template_configs: selectedTemplates.map(id => ({
          template_id: id,
          days_to_apply: [0, 1, 2, 3, 4, 5, 6] // Apply to all days
        }))
      }
      
      await onGenerate(params)
      onClose()
    } catch (error) {
      console.error('Failed to generate schedule:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getDayName = (dayOfWeek: number) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    return days[dayOfWeek]
  }

  const getAvailabilityColor = (type: string) => {
    switch (type) {
      case 'available': return 'text-green-600 bg-green-50'
      case 'if_needed': return 'text-amber-600 bg-amber-50'
      case 'unavailable': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getHourStatusColor = (allocation: WeeklyHourAllocation) => {
    const percentage = (allocation.allocated_hours / allocation.target_hours) * 100
    if (percentage >= 100) return 'text-green-600'
    if (percentage >= 80) return 'text-amber-600'
    return 'text-red-600'
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-6xl w-full bg-white rounded-xl shadow-2xl">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <Dialog.Title className="text-2xl font-bold text-gray-900">
                Enhanced AI Scheduling
              </Dialog.Title>
              <p className="text-gray-600 mt-1">
                Generate optimal schedules using templates, availability, and hour optimization
              </p>
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

          <div className="flex">
            {/* Sidebar Navigation */}
            <div className="w-64 border-r border-gray-200 bg-gray-50">
              <nav className="p-4 space-y-2">
                <button
                  onClick={() => setActiveTab('templates')}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'templates'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <CogIcon className="h-5 w-5 mr-3" />
                  Shift Templates
                </button>
                
                <button
                  onClick={() => setActiveTab('availability')}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'availability'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <UserGroupIcon className="h-5 w-5 mr-3" />
                  Employee Availability
                </button>
                
                <button
                  onClick={() => setActiveTab('hours')}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'hours'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <ClockIcon className="h-5 w-5 mr-3" />
                  Weekly Hours
                </button>
                
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'settings'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <CalendarIcon className="h-5 w-5 mr-3" />
                  Scheduling Settings
                </button>
              </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6">
              {/* Templates Tab */}
              {activeTab === 'templates' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Shift Templates
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Select shift templates to apply to the week of {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          selectedTemplates.includes(template.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => {
                          if (selectedTemplates.includes(template.id)) {
                            setSelectedTemplates(selectedTemplates.filter(id => id !== template.id))
                          } else {
                            setSelectedTemplates([...selectedTemplates, template.id])
                          }
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{template.name}</h4>
                          {selectedTemplates.includes(template.id) && (
                            <CheckCircleIcon className="h-5 w-5 text-blue-500" />
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Time:</span>
                            <span className="font-medium">{template.start_time} - {template.end_time}</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-gray-500">Staff:</span>
                            <span className="font-medium">{template.min_staff_count} - {template.max_staff_count || '∞'}</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-gray-500">Skills:</span>
                            <span className="font-medium">{template.required_skills.join(', ')}</span>
                          </div>
                          
                          {template.hourly_rate && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Rate:</span>
                              <span className="font-medium">${template.hourly_rate}/hr</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {templates.length === 0 && (
                    <div className="text-center py-8">
                      <CogIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No shift templates found. Create templates to get started.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Availability Tab */}
              {activeTab === 'availability' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Employee Availability
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Review and manage employee availability preferences
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Employee
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Day
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Availability
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Time
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Priority
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {availability.map((item) => (
                          <tr key={item.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {item.staff_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {getDayName(item.day_of_week)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getAvailabilityColor(item.availability_type)}`}>
                                {item.availability_type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.start_time && item.end_time ? `${item.start_time} - ${item.end_time}` : 'Any time'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.priority}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {availability.length === 0 && (
                    <div className="text-center py-8">
                      <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No availability preferences set. Employees can set their preferences.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Hours Tab */}
              {activeTab === 'hours' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Weekly Hour Allocations
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Track and manage weekly hour targets for employees
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Employee
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Target Hours
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Allocated
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Progress
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Overtime
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {hourAllocations.map((allocation) => (
                          <tr key={allocation.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {allocation.staff_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {allocation.target_hours}h
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {allocation.allocated_hours}h
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      (allocation.allocated_hours / allocation.target_hours) * 100 >= 100
                                        ? 'bg-green-500'
                                        : (allocation.allocated_hours / allocation.target_hours) * 100 >= 80
                                        ? 'bg-amber-500'
                                        : 'bg-red-500'
                                    }`}
                                    style={{
                                      width: `${Math.min((allocation.allocated_hours / allocation.target_hours) * 100, 100)}%`
                                    }}
                                  />
                                </div>
                                <span className={`text-sm font-medium ${getHourStatusColor(allocation)}`}>
                                  {Math.round((allocation.allocated_hours / allocation.target_hours) * 100)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {allocation.overtime_hours > 0 ? (
                                <span className="text-red-600 font-medium">+{allocation.overtime_hours}h</span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                allocation.status === 'completed' ? 'bg-green-100 text-green-800' :
                                allocation.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {allocation.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {hourAllocations.length === 0 && (
                    <div className="text-center py-8">
                      <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No hour allocations found for this week.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Scheduling Settings
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Configure AI scheduling parameters and strategies
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900">Scheduling Options</h4>
                      
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={schedulingParams.use_templates}
                          onChange={(e) => setSchedulingParams({
                            ...schedulingParams,
                            use_templates: e.target.checked
                          })}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Use shift templates</span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={schedulingParams.respect_availability}
                          onChange={(e) => setSchedulingParams({
                            ...schedulingParams,
                            respect_availability: e.target.checked
                          })}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Respect employee availability</span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={schedulingParams.optimize_hours}
                          onChange={(e) => setSchedulingParams({
                            ...schedulingParams,
                            optimize_hours: e.target.checked
                          })}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Optimize weekly hours</span>
                      </label>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900">Scheduling Strategy</h4>
                      
                      <div className="space-y-3">
                        {[
                          { value: 'balanced', label: 'Balanced', description: 'Balance all factors equally' },
                          { value: 'cost_optimized', label: 'Cost Optimized', description: 'Minimize labor costs' },
                          { value: 'staff_preferred', label: 'Staff Preferred', description: 'Prioritize staff preferences' },
                          { value: 'coverage_focused', label: 'Coverage Focused', description: 'Ensure all shifts are covered' }
                        ].map((strategy) => (
                          <label key={strategy.value} className="flex items-start">
                            <input
                              type="radio"
                              name="strategy"
                              value={strategy.value}
                              checked={schedulingParams.strategy === strategy.value}
                              onChange={(e) => setSchedulingParams({
                                ...schedulingParams,
                                strategy: e.target.value
                              })}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 mt-0.5"
                            />
                            <div className="ml-3">
                              <span className="text-sm font-medium text-gray-700">{strategy.label}</span>
                              <p className="text-xs text-gray-500">{strategy.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex">
                      <InformationCircleIcon className="h-5 w-5 text-blue-400 mt-0.5" />
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-blue-800">AI Scheduling Intelligence</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          The AI will consider employee skills, availability, preferences, and business needs to generate optimal schedules.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600">
                <CalendarIcon className="h-4 w-4 mr-1" />
                Week of {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </div>
              
              {selectedTemplates.length > 0 && (
                <div className="flex items-center text-sm text-gray-600">
                  <CogIcon className="h-4 w-4 mr-1" />
                  {selectedTemplates.length} template{selectedTemplates.length !== 1 ? 's' : ''} selected
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              
              <button
                onClick={handleGenerate}
                disabled={isLoading || selectedTemplates.length === 0}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Generating...
                  </div>
                ) : (
                  'Generate Schedule'
                )}
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}

export default EnhancedSchedulingModal 