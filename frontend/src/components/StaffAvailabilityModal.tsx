import { useState, useEffect } from 'react'
import { 
  XMarkIcon, 
  CalendarDaysIcon, 
  ClockIcon, 
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { format, addDays } from 'date-fns'
import { supabase } from '../../lib/supabase'

interface Staff {
  id: number
  name: string
  max_weekly_hours: number
  unavailable_times: any[]
  contract_type: string
}

interface StaffAvailabilityModalProps {
  staff: Staff
  onClose: () => void
  onUpdate: (updatedStaff: Staff) => void
}

export default function StaffAvailabilityModal({ staff, onClose, onUpdate }: StaffAvailabilityModalProps) {
  const [maxWeeklyHours, setMaxWeeklyHours] = useState(staff.max_weekly_hours || 40)
  const [contractType, setContractType] = useState(staff.contract_type || 'full_time')
  const [unavailableTimes, setUnavailableTimes] = useState(staff.unavailable_times || [])
  const [timeOffRequests, setTimeOffRequests] = useState<any[]>([])
  const [showAddTimeOff, setShowAddTimeOff] = useState(false)
  const [showAddUnavailable, setShowAddUnavailable] = useState(false)

  const [newTimeOff, setNewTimeOff] = useState({
    start_date: '',
    end_date: '',
    availability_type: 'holiday',
    reason: ''
  })

  const [newUnavailable, setNewUnavailable] = useState({
    day: 'monday',
    start_time: '',
    end_time: '',
    reason: '',
    all_day: false
  })

  useEffect(() => {
    loadTimeOffRequests()
  }, [staff.id])

  const loadTimeOffRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_availability')
        .select('*')
        .eq('staff_id', staff.id)
        .order('start_date', { ascending: false })

      if (error) throw error
      setTimeOffRequests(data || [])
    } catch (error) {
      console.error('Error loading time off requests:', error)
    }
  }

  const handleSaveChanges = async () => {
    try {
      const { error } = await supabase
        .from('staff')
        .update({
          max_weekly_hours: maxWeeklyHours,
          contract_type: contractType,
          unavailable_times: unavailableTimes
        })
        .eq('id', staff.id)

      if (error) throw error

      onUpdate({
        ...staff,
        max_weekly_hours: maxWeeklyHours,
        contract_type: contractType,
        unavailable_times: unavailableTimes
      })

      onClose()
    } catch (error) {
      console.error('Error updating staff availability:', error)
    }
  }

  const handleAddTimeOff = async () => {
    try {
      const { error } = await supabase
        .from('staff_availability')
        .insert({
          staff_id: staff.id,
          business_id: 1,
          start_date: newTimeOff.start_date,
          end_date: newTimeOff.end_date,
          availability_type: newTimeOff.availability_type,
          reason: newTimeOff.reason,
          status: 'pending'
        })

      if (error) throw error

      setNewTimeOff({
        start_date: '',
        end_date: '',
        availability_type: 'holiday',
        reason: ''
      })
      setShowAddTimeOff(false)
      loadTimeOffRequests()
    } catch (error) {
      console.error('Error adding time off request:', error)
    }
  }

  const handleAddUnavailable = () => {
    const newUnavailableTime = {
      day: newUnavailable.day,
      start_time: newUnavailable.all_day ? undefined : newUnavailable.start_time,
      end_time: newUnavailable.all_day ? undefined : newUnavailable.end_time,
      reason: newUnavailable.reason,
      all_day: newUnavailable.all_day
    }

    setUnavailableTimes([...unavailableTimes, newUnavailableTime])
    setNewUnavailable({
      day: 'monday',
      start_time: '',
      end_time: '',
      reason: '',
      all_day: false
    })
    setShowAddUnavailable(false)
  }

  const handleRemoveUnavailable = (index: number) => {
    setUnavailableTimes(unavailableTimes.filter((_, i) => i !== index))
  }

  const handleDeleteTimeOff = async (id: number) => {
    try {
      const { error } = await supabase
        .from('staff_availability')
        .delete()
        .eq('id', id)

      if (error) throw error
      loadTimeOffRequests()
    } catch (error) {
      console.error('Error deleting time off request:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'holiday': return 'bg-blue-100 text-blue-800'
      case 'sick_leave': return 'bg-red-100 text-red-800'
      case 'unavailable': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Availability Settings</h2>
            <p className="text-sm text-gray-600">{staff.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <XMarkIcon className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Working Hours & Contract */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Working Hours & Contract</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maximum Weekly Hours
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={maxWeeklyHours}
                  onChange={(e) => setMaxWeeklyHours(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Legal maximum: 48 hours (UK Working Time Regulations)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contract Type
                </label>
                <select
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="student">Student</option>
                  <option value="casual">Casual</option>
                  <option value="zero_hours">Zero Hours</option>
                </select>
              </div>
            </div>
          </div>

          {/* Regular Unavailable Times */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Regular Unavailable Times</h3>
              <button
                onClick={() => setShowAddUnavailable(true)}
                className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Unavailable Time
              </button>
            </div>

            {unavailableTimes.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No regular unavailable times set</p>
            ) : (
              <div className="space-y-2">
                {unavailableTimes.map((time, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 capitalize">
                        {time.day}s {time.all_day ? '(All Day)' : `${time.start_time} - ${time.end_time}`}
                      </p>
                      <p className="text-sm text-gray-600">{time.reason}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveUnavailable(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Unavailable Time Form */}
            {showAddUnavailable && (
              <div className="mt-4 p-4 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Add Unavailable Time</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                    <select
                      value={newUnavailable.day}
                      onChange={(e) => setNewUnavailable({...newUnavailable, day: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="monday">Monday</option>
                      <option value="tuesday">Tuesday</option>
                      <option value="wednesday">Wednesday</option>
                      <option value="thursday">Thursday</option>
                      <option value="friday">Friday</option>
                      <option value="saturday">Saturday</option>
                      <option value="sunday">Sunday</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                    <input
                      type="text"
                      value={newUnavailable.reason}
                      onChange={(e) => setNewUnavailable({...newUnavailable, reason: e.target.value})}
                      placeholder="e.g., school, childcare, other job"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newUnavailable.all_day}
                      onChange={(e) => setNewUnavailable({...newUnavailable, all_day: e.target.checked})}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">All day unavailable</span>
                  </label>
                </div>

                {!newUnavailable.all_day && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={newUnavailable.start_time}
                        onChange={(e) => setNewUnavailable({...newUnavailable, start_time: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                      <input
                        type="time"
                        value={newUnavailable.end_time}
                        onChange={(e) => setNewUnavailable({...newUnavailable, end_time: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-3 mt-4">
                  <button
                    onClick={() => setShowAddUnavailable(false)}
                    className="px-3 py-1 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddUnavailable}
                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add
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
                {timeOffRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(request.availability_type)}`}>
                          {request.availability_type.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900">
                        {format(new Date(request.start_date), 'MMM d')} - {format(new Date(request.end_date), 'MMM d, yyyy')}
                      </p>
                      <p className="text-sm text-gray-600">{request.reason}</p>
                    </div>
                    {request.status === 'pending' && (
                      <button
                        onClick={() => handleDeleteTimeOff(request.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
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
                      onChange={(e) => setNewTimeOff({...newTimeOff, start_date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={newTimeOff.end_date}
                      onChange={(e) => setNewTimeOff({...newTimeOff, end_date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={newTimeOff.availability_type}
                      onChange={(e) => setNewTimeOff({...newTimeOff, availability_type: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="holiday">Holiday</option>
                      <option value="sick_leave">Sick Leave</option>
                      <option value="unavailable">Other Unavailable</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                    <input
                      type="text"
                      value={newTimeOff.reason}
                      onChange={(e) => setNewTimeOff({...newTimeOff, reason: e.target.value})}
                      placeholder="e.g., family vacation, medical appointment"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveChanges}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}