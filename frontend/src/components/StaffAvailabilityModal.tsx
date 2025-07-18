import { useState, useEffect } from 'react'
import {
  XMarkIcon,
  CalendarDaysIcon,
  PlusIcon,
  TrashIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'

interface Staff {
  id: number
  name: string
  business_id: number
  [key: string]: any
}

interface StaffPreference {
  id: number
  staff_id: number
  staff_name: string
  preference_type: string
  preference_value: any
  priority: string
  effective_date?: string
  expiry_date?: string
  is_active: boolean
  created_at: string
}

interface StaffAvailabilityModalProps {
  staff: Staff
  onClose: () => void
  onUpdate: (updatedStaff: Staff) => void
}

export default function StaffAvailabilityModal({ staff, onClose, onUpdate }: StaffAvailabilityModalProps) {
  const [preferences, setPreferences] = useState<StaffPreference[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form states
  const [showAddPreference, setShowAddPreference] = useState(false)
  const [newPreference, setNewPreference] = useState({
    preference_type: 'max_hours',
    preference_value: {},
    priority: 'medium',
    effective_date: '',
    expiry_date: ''
  })

  // Specific preference states
  const [maxHours, setMaxHours] = useState(40)
  const [minHours, setMinHours] = useState(0)
  const [availabilityTimes, setAvailabilityTimes] = useState<any[]>([])
  const [timeOffRequests, setTimeOffRequests] = useState<any[]>([])
  const [dayOffPreferences, setDayOffPreferences] = useState<number[]>([])
  const [showAddAvailability, setShowAddAvailability] = useState(false)
  const [showAddTimeOff, setShowAddTimeOff] = useState(false)
  const [showAddDayOff, setShowAddDayOff] = useState(false)

  const [newAvailability, setNewAvailability] = useState({
    day_of_week: 0,
    start_time: '',
    end_time: '',
    preferred: true
  })

  const [newTimeOff, setNewTimeOff] = useState({
    start_date: '',
    end_date: '',
    reason: '',
    is_recurring: false
  })

  useEffect(() => {
    loadStaffPreferences()
  }, [staff.id])

  const loadStaffPreferences = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/staff/${staff.id}/preferences`)
      if (!response.ok) throw new Error('Failed to load preferences')
      
      const data = await response.json()
      setPreferences(data)
      
      // Extract specific preferences
      const maxHoursPref = data.find((p: StaffPreference) => p.preference_type === 'max_hours')
      if (maxHoursPref) {
        setMaxHours(maxHoursPref.preference_value.hours || 40)
      }
      
      const minHoursPref = data.find((p: StaffPreference) => p.preference_type === 'min_hours')
      if (minHoursPref) {
        setMinHours(minHoursPref.preference_value.hours || 0)
      }
      
      const availabilityPref = data.find((p: StaffPreference) => p.preference_type === 'availability')
      if (availabilityPref) {
        setAvailabilityTimes(availabilityPref.preference_value.times || [])
      }
      
      const timeOffPref = data.find((p: StaffPreference) => p.preference_type === 'time_off')
      if (timeOffPref) {
        setTimeOffRequests(timeOffPref.preference_value.requests || [])
      }
      
      const dayOffPref = data.find((p: StaffPreference) => p.preference_type === 'day_off')
      if (dayOffPref) {
        setDayOffPreferences(dayOffPref.preference_value.days || [])
      }
      
    } catch (error) {
      console.error('Error loading staff preferences:', error)
      setError('Failed to load staff preferences')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveHoursPreferences = async () => {
    try {
      setSaving(true)
      
      // Handle max hours preference
      const existingMaxPref = preferences.find(p => p.preference_type === 'max_hours')
      
      if (existingMaxPref) {
        // Update existing preference
        const response = await fetch(`/api/staff/${staff.id}/preferences/${existingMaxPref.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            preference_value: { hours: maxHours },
            priority: 'high'
          })
        })
        if (!response.ok) throw new Error('Failed to update max hours')
      } else {
        // Create new preference
        const response = await fetch(`/api/staff/${staff.id}/preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: staff.id,
            preference_type: 'max_hours',
            preference_value: { hours: maxHours },
            priority: 'high'
          })
        })
        if (!response.ok) throw new Error('Failed to create max hours preference')
      }
      
      // Handle min hours preference
      const existingMinPref = preferences.find(p => p.preference_type === 'min_hours')
      
      if (minHours > 0) {
        if (existingMinPref) {
          // Update existing preference
          const response = await fetch(`/api/staff/${staff.id}/preferences/${existingMinPref.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              preference_value: { hours: minHours },
              priority: 'medium'
            })
          })
          if (!response.ok) throw new Error('Failed to update min hours')
        } else {
          // Create new preference
          const response = await fetch(`/api/staff/${staff.id}/preferences`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              staff_id: staff.id,
              preference_type: 'min_hours',
              preference_value: { hours: minHours },
              priority: 'medium'
            })
          })
          if (!response.ok) throw new Error('Failed to create min hours preference')
        }
      } else if (existingMinPref) {
        // Delete min hours preference if set to 0
        const response = await fetch(`/api/staff/${staff.id}/preferences/${existingMinPref.id}`, {
          method: 'DELETE'
        })
        if (!response.ok) throw new Error('Failed to delete min hours preference')
      }
      
      await loadStaffPreferences()
    } catch (error) {
      console.error('Error saving hours preferences:', error)
      setError('Failed to save hours preferences')
    } finally {
      setSaving(false)
    }
  }

  const handleAddAvailability = async () => {
    try {
      const newAvailabilityTime = {
        day_of_week: newAvailability.day_of_week,
        start_time: newAvailability.start_time,
        end_time: newAvailability.end_time,
        preferred: newAvailability.preferred
      }
      
      const updatedTimes = [...availabilityTimes, newAvailabilityTime]
      
      // Update or create availability preference
      const existingPref = preferences.find(p => p.preference_type === 'availability')
      
      if (existingPref) {
        const response = await fetch(`/api/staff/${staff.id}/preferences/${existingPref.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            preference_value: { times: updatedTimes }
          })
        })
        if (!response.ok) throw new Error('Failed to update availability')
      } else {
        const response = await fetch(`/api/staff/${staff.id}/preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: staff.id,
            preference_type: 'availability',
            preference_value: { times: updatedTimes },
            priority: 'high'
          })
        })
        if (!response.ok) throw new Error('Failed to create availability preference')
      }
      
      setAvailabilityTimes(updatedTimes)
      setNewAvailability({
        day_of_week: 0,
        start_time: '',
        end_time: '',
        preferred: true
      })
      setShowAddAvailability(false)
      
    } catch (error) {
      console.error('Error adding availability:', error)
      setError('Failed to add availability preference')
    }
  }

  const handleRemoveAvailability = async (index: number) => {
    try {
      const updatedTimes = availabilityTimes.filter((_, i) => i !== index)
      
      const existingPref = preferences.find(p => p.preference_type === 'availability')
      if (existingPref) {
        const response = await fetch(`/api/staff/${staff.id}/preferences/${existingPref.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            preference_value: { times: updatedTimes }
          })
        })
        if (!response.ok) throw new Error('Failed to update availability')
      }
      
      setAvailabilityTimes(updatedTimes)
    } catch (error) {
      console.error('Error removing availability:', error)
      setError('Failed to remove availability')
    }
  }

  const handleAddTimeOff = async () => {
    try {
      const newTimeOffRequest = {
        start_date: newTimeOff.start_date,
        end_date: newTimeOff.end_date,
        reason: newTimeOff.reason,
        is_recurring: newTimeOff.is_recurring,
        status: 'pending'
      }
      
      const updatedRequests = [...timeOffRequests, newTimeOffRequest]
      
      // Update or create time_off preference
      const existingPref = preferences.find(p => p.preference_type === 'time_off')
      
      if (existingPref) {
        const response = await fetch(`/api/staff/${staff.id}/preferences/${existingPref.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            preference_value: { requests: updatedRequests }
          })
        })
        if (!response.ok) throw new Error('Failed to update time off')
      } else {
        const response = await fetch(`/api/staff/${staff.id}/preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: staff.id,
            preference_type: 'time_off',
            preference_value: { requests: updatedRequests },
            priority: 'medium'
          })
        })
        if (!response.ok) throw new Error('Failed to create time off preference')
      }
      
      setTimeOffRequests(updatedRequests)
      setNewTimeOff({
        start_date: '',
        end_date: '',
        reason: '',
        is_recurring: false
      })
      setShowAddTimeOff(false)
      
    } catch (error) {
      console.error('Error adding time off:', error)
      setError('Failed to add time off request')
    }
  }

  const handleAddDayOff = async (dayIndex: number) => {
    try {
      if (dayOffPreferences.includes(dayIndex)) return
      
      const updatedDays = [...dayOffPreferences, dayIndex]
      
      // Update or create day_off preference
      const existingPref = preferences.find(p => p.preference_type === 'day_off')
      
      if (existingPref) {
        const response = await fetch(`/api/staff/${staff.id}/preferences/${existingPref.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            preference_value: { days: updatedDays }
          })
        })
        if (!response.ok) throw new Error('Failed to update day off preference')
      } else {
        const response = await fetch(`/api/staff/${staff.id}/preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: staff.id,
            preference_type: 'day_off',
            preference_value: { days: updatedDays },
            priority: 'medium'
          })
        })
        if (!response.ok) throw new Error('Failed to create day off preference')
      }
      
      setDayOffPreferences(updatedDays)
    } catch (error) {
      console.error('Error adding day off:', error)
      setError('Failed to add day off preference')
    }
  }

  const handleRemoveDayOff = async (dayIndex: number) => {
    try {
      const updatedDays = dayOffPreferences.filter(day => day !== dayIndex)
      
      const existingPref = preferences.find(p => p.preference_type === 'day_off')
      if (existingPref) {
        if (updatedDays.length === 0) {
          // Delete preference if no days left
          const response = await fetch(`/api/staff/${staff.id}/preferences/${existingPref.id}`, {
            method: 'DELETE'
          })
          if (!response.ok) throw new Error('Failed to delete day off preference')
        } else {
          // Update preference with remaining days
          const response = await fetch(`/api/staff/${staff.id}/preferences/${existingPref.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              preference_value: { days: updatedDays }
            })
          })
          if (!response.ok) throw new Error('Failed to update day off preference')
        }
      }
      
      setDayOffPreferences(updatedDays)
    } catch (error) {
      console.error('Error removing day off:', error)
      setError('Failed to remove day off preference')
    }
  }

  const handleDeletePreference = async (preferenceId: number) => {
    try {
      const response = await fetch(`/api/staff/${staff.id}/preferences/${preferenceId}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete preference')
      
      await loadStaffPreferences()
    } catch (error) {
      console.error('Error deleting preference:', error)
      setError('Failed to delete preference')
    }
  }

  const getDayName = (dayOfWeek: number) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    return days[dayOfWeek] || 'Unknown'
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Loading preferences...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Staff Preferences & Availability</h2>
            <p className="text-sm text-gray-600">{staff.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <XMarkIcon className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Working Hours Preferences */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Working Hours Preferences</h3>
              <button
                onClick={handleSaveHoursPreferences}
                disabled={saving}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Maximum Hours */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Weekly Hours</label>
                <div className="flex items-center space-x-4">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={maxHours}
                    onChange={(e) => setMaxHours(parseInt(e.target.value) || 40)}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-sm text-gray-600">hours per week</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Legal maximum: 48 hours (UK Working Time Regulations)
                </p>
              </div>
              
              {/* Minimum Hours */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Weekly Hours</label>
                <div className="flex items-center space-x-4">
                  <input
                    type="number"
                    min="0"
                    max="40"
                    value={minHours}
                    onChange={(e) => setMinHours(parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-sm text-gray-600">hours per week</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Guaranteed minimum hours you'd like to work
                </p>
              </div>
            </div>
          </div>

          {/* Availability Times */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Availability Preferences</h3>
              <button
                onClick={() => setShowAddAvailability(true)}
                className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                <ClockIcon className="h-4 w-4 mr-1" />
                Add Availability
              </button>
            </div>

            {availabilityTimes.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No availability preferences set</p>
            ) : (
              <div className="space-y-2">
                {availabilityTimes.map((time, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">
                        {getDayName(time.day_of_week)} {time.start_time} - {time.end_time}
                      </p>
                      <p className="text-sm text-gray-600">
                        {time.preferred ? 'Preferred time' : 'Available but not preferred'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveAvailability(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Availability Form */}
            {showAddAvailability && (
              <div className="mt-4 p-4 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Add Availability</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                    <select
                      value={newAvailability.day_of_week}
                      onChange={(e) => setNewAvailability({ ...newAvailability, day_of_week: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={0}>Monday</option>
                      <option value={1}>Tuesday</option>
                      <option value={2}>Wednesday</option>
                      <option value={3}>Thursday</option>
                      <option value={4}>Friday</option>
                      <option value={5}>Saturday</option>
                      <option value={6}>Sunday</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={newAvailability.start_time}
                      onChange={(e) => setNewAvailability({ ...newAvailability, start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <input
                      type="time"
                      value={newAvailability.end_time}
                      onChange={(e) => setNewAvailability({ ...newAvailability, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newAvailability.preferred}
                      onChange={(e) => setNewAvailability({ ...newAvailability, preferred: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">This is a preferred time slot</span>
                  </label>
                </div>

                <div className="flex justify-end space-x-3 mt-4">
                  <button
                    onClick={() => setShowAddAvailability(false)}
                    className="px-3 py-1 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddAvailability}
                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Day Off Preferences */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Preferred Days Off</h3>
              <button
                onClick={() => setShowAddDayOff(true)}
                className="inline-flex items-center px-3 py-1 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700"
              >
                <CalendarDaysIcon className="h-4 w-4 mr-1" />
                Set Day Off
              </button>
            </div>

            {dayOffPreferences.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No preferred days off set</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {dayOffPreferences.map((dayIndex, index) => (
                  <div key={index} className="flex items-center bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm">
                    <span>{getDayName(dayIndex)}</span>
                    <button
                      onClick={() => handleRemoveDayOff(dayIndex)}
                      className="ml-2 text-purple-600 hover:text-purple-800"
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Day Off Form */}
            {showAddDayOff && (
              <div className="mt-4 p-4 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Add Preferred Day Off</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
                    <button
                      key={dayIndex}
                      onClick={() => handleAddDayOff(dayIndex)}
                      disabled={dayOffPreferences.includes(dayIndex)}
                      className={`px-3 py-2 text-sm rounded-md border ${
                        dayOffPreferences.includes(dayIndex)
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-purple-50 hover:border-purple-300'
                      }`}
                    >
                      {getDayName(dayIndex)}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end space-x-3 mt-4">
                  <button
                    onClick={() => setShowAddDayOff(false)}
                    className="px-3 py-1 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Time Off Requests */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Time Off Requests</h3>
              <button
                onClick={() => setShowAddTimeOff(true)}
                className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
              >
                <CalendarDaysIcon className="h-4 w-4 mr-1" />
                Request Time Off
              </button>
            </div>

            {timeOffRequests.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No time off requests</p>
            ) : (
              <div className="space-y-2">
                {timeOffRequests.map((request, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {request.status || 'pending'}
                        </span>
                        {request.is_recurring && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                            Recurring
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-gray-900">
                        {format(new Date(request.start_date), 'MMM d')} - {format(new Date(request.end_date), 'MMM d, yyyy')}
                      </p>
                      <p className="text-sm text-gray-600">{request.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Time Off Form */}
            {showAddTimeOff && (
              <div className="mt-4 p-4 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Request Time Off</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={newTimeOff.start_date}
                      onChange={(e) => setNewTimeOff({ ...newTimeOff, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={newTimeOff.end_date}
                      onChange={(e) => setNewTimeOff({ ...newTimeOff, end_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                    <input
                      type="text"
                      value={newTimeOff.reason}
                      onChange={(e) => setNewTimeOff({ ...newTimeOff, reason: e.target.value })}
                      placeholder="e.g., family vacation, medical appointment"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newTimeOff.is_recurring}
                      onChange={(e) => setNewTimeOff({ ...newTimeOff, is_recurring: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">This is a recurring request</span>
                  </label>
                </div>

                <div className="flex justify-end space-x-3 mt-4">
                  <button
                    onClick={() => setShowAddTimeOff(false)}
                    className="px-3 py-1 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddTimeOff}
                    className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Submit Request
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* All Preferences List */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">All Preferences</h3>
            {preferences.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No preferences set</p>
            ) : (
              <div className="space-y-2">
                {preferences.map((pref) => (
                  <div key={pref.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium text-gray-900 capitalize">
                          {pref.preference_type.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(pref.priority)}`}>
                          {pref.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {JSON.stringify(pref.preference_value)}
                      </p>
                      {pref.effective_date && (
                        <p className="text-xs text-gray-500">
                          Effective: {format(new Date(pref.effective_date), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeletePreference(pref.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}