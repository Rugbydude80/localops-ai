import React, { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns'
import { 
  XMarkIcon, 
  CalendarIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  SparklesIcon,
  BellIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

// Types
export interface SpecialEvent {
  id?: string
  date: string
  name: string
  expectedImpact: 'low' | 'medium' | 'high'
  description?: string
}

export interface StaffNote {
  id?: string
  staffId: number
  staffName: string
  note: string
  type: 'unavailable' | 'preferred' | 'constraint'
}

export interface SchedulingConstraints {
  maxHoursPerStaff?: number
  minRestHours?: number
  skillMatching: boolean
  fairDistribution: boolean
  considerPreferences: boolean
  laborCostOptimization: boolean
}

export interface NotificationPreferences {
  notifyOnGeneration: boolean
  notifyOnPublish: boolean
  channels: ('whatsapp' | 'sms' | 'email')[]
  customMessage?: string
  retryFailedNotifications: boolean
  notificationPriority: 'low' | 'medium' | 'high'
  deliveryConfirmation: boolean
}

export interface AutoScheduleParams {
  dateRange: {
    start: string
    end: string
  }
  specialEvents: SpecialEvent[]
  staffNotes: StaffNote[]
  constraints: SchedulingConstraints
  notificationSettings: NotificationPreferences
}

export interface AutoScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (params: AutoScheduleParams) => Promise<void>
  businessId: number
  staff?: Array<{ id: number; name: string }>
  isLoading?: boolean
  currentStep?: 'configure' | 'generating' | 'review' | 'publishing'
  progress?: number
  generatedSchedule?: any
}

interface FormData {
  startDate: string
  endDate: string
  specialEvents: SpecialEvent[]
  staffNotes: StaffNote[]
  maxHoursPerStaff: number
  minRestHours: number
  skillMatching: boolean
  fairDistribution: boolean
  considerPreferences: boolean
  laborCostOptimization: boolean
  notifyOnGeneration: boolean
  notifyOnPublish: boolean
  notificationChannels: string[]
  customMessage: string
  retryFailedNotifications: boolean
  notificationPriority: 'low' | 'medium' | 'high'
  deliveryConfirmation: boolean
}

const AutoScheduleModal: React.FC<AutoScheduleModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  businessId,
  staff = [],
  isLoading = false,
  currentStep = 'configure',
  progress = 0,
  generatedSchedule
}) => {
  const [step, setStep] = useState<'configure' | 'generating' | 'review' | 'publishing'>(currentStep)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [newEvent, setNewEvent] = useState<Partial<SpecialEvent>>({})
  const [newStaffNote, setNewStaffNote] = useState<Partial<StaffNote>>({})
  const [showEventForm, setShowEventForm] = useState(false)
  const [showStaffNoteForm, setShowStaffNoteForm] = useState(false)

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
    reset
  } = useForm<FormData>({
    defaultValues: {
      startDate: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      endDate: format(endOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      specialEvents: [],
      staffNotes: [],
      maxHoursPerStaff: 40,
      minRestHours: 8,
      skillMatching: true,
      fairDistribution: true,
      considerPreferences: true,
      laborCostOptimization: false,
      notifyOnGeneration: false,
      notifyOnPublish: true,
      notificationChannels: ['email'],
      customMessage: '',
      retryFailedNotifications: true,
      notificationPriority: 'medium',
      deliveryConfirmation: false
    },
    mode: 'onChange'
  })

  const watchedValues = watch()

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('configure')
      setShowConfirmation(false)
      reset()
    }
  }, [isOpen, reset])

  // Update step based on props
  useEffect(() => {
    setStep(currentStep)
  }, [currentStep])

  const handleAddSpecialEvent = () => {
    if (!newEvent.date || !newEvent.name || !newEvent.expectedImpact) {
      toast.error('Please fill in all event details')
      return
    }

    const event: SpecialEvent = {
      id: Date.now().toString(),
      date: newEvent.date,
      name: newEvent.name,
      expectedImpact: newEvent.expectedImpact,
      description: newEvent.description || ''
    }

    setValue('specialEvents', [...watchedValues.specialEvents, event])
    setNewEvent({})
    setShowEventForm(false)
    toast.success('Special event added')
  }

  const handleRemoveSpecialEvent = (eventId: string) => {
    setValue('specialEvents', watchedValues.specialEvents.filter(e => e.id !== eventId))
    toast.success('Special event removed')
  }

  const handleAddStaffNote = () => {
    if (!newStaffNote.staffId || !newStaffNote.note || !newStaffNote.type) {
      toast.error('Please fill in all staff note details')
      return
    }

    const staffMember = staff.find(s => s.id === newStaffNote.staffId)
    if (!staffMember) {
      toast.error('Staff member not found')
      return
    }

    const note: StaffNote = {
      id: Date.now().toString(),
      staffId: newStaffNote.staffId,
      staffName: staffMember.name,
      note: newStaffNote.note,
      type: newStaffNote.type
    }

    setValue('staffNotes', [...watchedValues.staffNotes, note])
    setNewStaffNote({})
    setShowStaffNoteForm(false)
    toast.success('Staff note added')
  }

  const handleRemoveStaffNote = (noteId: string) => {
    setValue('staffNotes', watchedValues.staffNotes.filter(n => n.id !== noteId))
    toast.success('Staff note removed')
  }

  const onSubmit = async (data: FormData) => {
    try {
      const params: AutoScheduleParams = {
        dateRange: {
          start: data.startDate,
          end: data.endDate
        },
        specialEvents: data.specialEvents,
        staffNotes: data.staffNotes,
        constraints: {
          maxHoursPerStaff: data.maxHoursPerStaff,
          minRestHours: data.minRestHours,
          skillMatching: data.skillMatching,
          fairDistribution: data.fairDistribution,
          considerPreferences: data.considerPreferences,
          laborCostOptimization: data.laborCostOptimization
        },
        notificationSettings: {
          notifyOnGeneration: data.notifyOnGeneration,
          notifyOnPublish: data.notifyOnPublish,
          channels: data.notificationChannels as ('whatsapp' | 'sms' | 'email')[],
          customMessage: data.customMessage,
          retryFailedNotifications: data.retryFailedNotifications,
          notificationPriority: data.notificationPriority,
          deliveryConfirmation: data.deliveryConfirmation
        }
      }

      setStep('generating')
      await onConfirm(params)
    } catch (error) {
      console.error('Auto-schedule generation failed:', error)
      toast.error('Failed to generate schedule. Please try again.')
      setStep('configure')
    }
  }

  const handlePublishSchedule = async () => {
    setStep('publishing')
    // This would be handled by the parent component
    toast.success('Schedule published successfully!')
    onClose()
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getNoteTypeColor = (type: string) => {
    switch (type) {
      case 'unavailable': return 'bg-red-100 text-red-800 border-red-200'
      case 'preferred': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'constraint': return 'bg-amber-100 text-amber-800 border-amber-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <SparklesIcon className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {step === 'configure' && 'Auto-Schedule Configuration'}
                {step === 'generating' && 'Generating Schedule...'}
                {step === 'review' && 'Review Generated Schedule'}
                {step === 'publishing' && 'Publishing Schedule...'}
              </h2>
              <p className="text-sm text-gray-500">
                {step === 'configure' && 'Configure parameters for automatic schedule generation'}
                {step === 'generating' && 'AI is creating your optimal schedule'}
                {step === 'review' && 'Review and approve the generated schedule'}
                {step === 'publishing' && 'Publishing schedule and sending notifications'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={step === 'generating' || step === 'publishing'}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close modal"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Bar */}
        {(step === 'generating' || step === 'publishing') && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {step === 'generating' ? 'Generating Schedule' : 'Publishing Schedule'}
              </span>
              <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {step === 'configure' && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              {/* Date Range Section */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <CalendarIcon className="h-5 w-5 mr-2" />
                  Schedule Date Range
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>
                    <Controller
                      name="startDate"
                      control={control}
                      rules={{ required: 'Start date is required' }}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="date"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      )}
                    />
                    {errors.startDate && (
                      <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date
                    </label>
                    <Controller
                      name="endDate"
                      control={control}
                      rules={{ 
                        required: 'End date is required',
                        validate: (value) => {
                          const start = new Date(watchedValues.startDate)
                          const end = new Date(value)
                          return end > start || 'End date must be after start date'
                        }
                      }}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="date"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      )}
                    />
                    {errors.endDate && (
                      <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Special Events Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                    Special Events & Busy Periods
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowEventForm(true)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Add Event
                  </button>
                </div>

                {/* Event Form */}
                {showEventForm && (
                  <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Date
                        </label>
                        <input
                          type="date"
                          value={newEvent.date || ''}
                          onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Event Name
                        </label>
                        <input
                          type="text"
                          value={newEvent.name || ''}
                          onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                          placeholder="e.g., Football Match, Holiday"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Expected Impact
                        </label>
                        <select
                          value={newEvent.expectedImpact || ''}
                          onChange={(e) => setNewEvent({ ...newEvent, expectedImpact: e.target.value as 'low' | 'medium' | 'high' })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select impact...</option>
                          <option value="low">Low (+10% staff)</option>
                          <option value="medium">Medium (+25% staff)</option>
                          <option value="high">High (+50% staff)</option>
                        </select>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description (Optional)
                      </label>
                      <textarea
                        value={newEvent.description || ''}
                        onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                        placeholder="Additional details about this event..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowEventForm(false)
                          setNewEvent({})
                        }}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddSpecialEvent}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Add Event
                      </button>
                    </div>
                  </div>
                )}

                {/* Events List */}
                <div className="space-y-2">
                  {watchedValues.specialEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="font-medium text-gray-900">{event.name}</span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getImpactColor(event.expectedImpact)}`}>
                            {event.expectedImpact} impact
                          </span>
                          <span className="text-sm text-gray-500">
                            {format(new Date(event.date), 'MMM d, yyyy')}
                          </span>
                        </div>
                        {event.description && (
                          <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSpecialEvent(event.id!)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        aria-label="Remove event"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {watchedValues.specialEvents.length === 0 && (
                    <p className="text-sm text-gray-500 italic text-center py-4">
                      No special events added. Click "Add Event" to include busy periods or special occasions.
                    </p>
                  )}
                </div>
              </div>

              {/* Staff Notes Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <UserGroupIcon className="h-5 w-5 mr-2" />
                    Staff Notes & Constraints
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowStaffNoteForm(true)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Add Note
                  </button>
                </div>

                {/* Staff Note Form */}
                {showStaffNoteForm && (
                  <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Staff Member
                        </label>
                        <select
                          value={newStaffNote.staffId || ''}
                          onChange={(e) => setNewStaffNote({ ...newStaffNote, staffId: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select staff...</option>
                          {staff.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Note Type
                        </label>
                        <select
                          value={newStaffNote.type || ''}
                          onChange={(e) => setNewStaffNote({ ...newStaffNote, type: e.target.value as 'unavailable' | 'preferred' | 'constraint' })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select type...</option>
                          <option value="unavailable">Unavailable</option>
                          <option value="preferred">Preferred Schedule</option>
                          <option value="constraint">Special Constraint</option>
                        </select>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Note Details
                      </label>
                      <textarea
                        value={newStaffNote.note || ''}
                        onChange={(e) => setNewStaffNote({ ...newStaffNote, note: e.target.value })}
                        placeholder="e.g., Not available Monday mornings, Prefers evening shifts, Maximum 6 hours per day"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowStaffNoteForm(false)
                          setNewStaffNote({})
                        }}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddStaffNote}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Add Note
                      </button>
                    </div>
                  </div>
                )}

                {/* Staff Notes List */}
                <div className="space-y-2">
                  {watchedValues.staffNotes.map((note) => (
                    <div key={note.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="font-medium text-gray-900">{note.staffName}</span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getNoteTypeColor(note.type)}`}>
                            {note.type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{note.note}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveStaffNote(note.id!)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        aria-label="Remove note"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {watchedValues.staffNotes.length === 0 && (
                    <p className="text-sm text-gray-500 italic text-center py-4">
                      No staff notes added. Click "Add Note" to include availability constraints or preferences.
                    </p>
                  )}
                </div>
              </div>

              {/* Scheduling Constraints */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <ClockIcon className="h-5 w-5 mr-2" />
                  Scheduling Constraints
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maximum Hours per Staff Member
                      </label>
                      <Controller
                        name="maxHoursPerStaff"
                        control={control}
                        rules={{ 
                          required: 'Maximum hours is required',
                          min: { value: 1, message: 'Must be at least 1 hour' },
                          max: { value: 60, message: 'Must be less than 60 hours' }
                        }}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="number"
                            min="1"
                            max="60"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          />
                        )}
                      />
                      {errors.maxHoursPerStaff && (
                        <p className="mt-1 text-sm text-red-600">{errors.maxHoursPerStaff.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Rest Hours Between Shifts
                      </label>
                      <Controller
                        name="minRestHours"
                        control={control}
                        rules={{ 
                          required: 'Minimum rest hours is required',
                          min: { value: 4, message: 'Must be at least 4 hours' },
                          max: { value: 24, message: 'Must be less than 24 hours' }
                        }}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="number"
                            min="4"
                            max="24"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          />
                        )}
                      />
                      {errors.minRestHours && (
                        <p className="mt-1 text-sm text-red-600">{errors.minRestHours.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <Controller
                        name="skillMatching"
                        control={control}
                        render={({ field }) => (
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        )}
                      />
                      <label className="ml-2 block text-sm text-gray-900">
                        Match staff skills to shift requirements
                      </label>
                    </div>
                    <div className="flex items-center">
                      <Controller
                        name="fairDistribution"
                        control={control}
                        render={({ field }) => (
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        )}
                      />
                      <label className="ml-2 block text-sm text-gray-900">
                        Ensure fair distribution of shifts
                      </label>
                    </div>
                    <div className="flex items-center">
                      <Controller
                        name="considerPreferences"
                        control={control}
                        render={({ field }) => (
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        )}
                      />
                      <label className="ml-2 block text-sm text-gray-900">
                        Consider staff preferences
                      </label>
                    </div>
                    <div className="flex items-center">
                      <Controller
                        name="laborCostOptimization"
                        control={control}
                        render={({ field }) => (
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        )}
                      />
                      <label className="ml-2 block text-sm text-gray-900">
                        Optimize for labor cost efficiency
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notification Settings */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <BellIcon className="h-5 w-5 mr-2" />
                  Notification Settings
                </h3>
                <div className="space-y-6">
                  {/* Basic Notification Options */}
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <Controller
                        name="notifyOnGeneration"
                        control={control}
                        render={({ field }) => (
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        )}
                      />
                      <label className="ml-2 block text-sm text-gray-900">
                        Notify me when schedule generation is complete
                      </label>
                    </div>
                    <div className="flex items-center">
                      <Controller
                        name="notifyOnPublish"
                        control={control}
                        render={({ field }) => (
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        )}
                      />
                      <label className="ml-2 block text-sm text-gray-900">
                        Notify staff when schedule is published
                      </label>
                    </div>
                  </div>

                  {/* Notification Channels */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Notification Channels
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { key: 'email', label: 'Email', icon: '📧', description: 'Reliable delivery' },
                        { key: 'whatsapp', label: 'WhatsApp', icon: '💬', description: 'Instant messaging' },
                        { key: 'sms', label: 'SMS', icon: '📱', description: 'Text messages' }
                      ].map((channel) => (
                        <div key={channel.key} className="relative">
                          <Controller
                            name="notificationChannels"
                            control={control}
                            render={({ field }) => (
                              <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                                field.value.includes(channel.key)
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-300 hover:border-gray-400'
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={field.value.includes(channel.key)}
                                  onChange={(e) => {
                                    const newChannels = e.target.checked
                                      ? [...field.value, channel.key]
                                      : field.value.filter(c => c !== channel.key)
                                    field.onChange(newChannels)
                                  }}
                                  className="sr-only"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center">
                                    <span className="text-lg mr-2">{channel.icon}</span>
                                    <span className="font-medium text-gray-900">{channel.label}</span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">{channel.description}</p>
                                </div>
                                {field.value.includes(channel.key) && (
                                  <CheckCircleIcon className="h-5 w-5 text-blue-600" />
                                )}
                              </label>
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Advanced Notification Options */}
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Advanced Options</h4>
                    <div className="space-y-4">
                      {/* Custom Message */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Custom Message (Optional)
                        </label>
                        <Controller
                          name="customMessage"
                          control={control}
                          render={({ field }) => (
                            <textarea
                              {...field}
                              rows={2}
                              placeholder="Add a personal note to include with notifications..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                            />
                          )}
                        />
                      </div>

                      {/* Notification Priority */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Notification Priority
                        </label>
                        <Controller
                          name="notificationPriority"
                          control={control}
                          render={({ field }) => (
                            <select
                              {...field}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                            >
                              <option value="low">Low - Standard delivery</option>
                              <option value="medium">Medium - Priority delivery</option>
                              <option value="high">High - Urgent delivery</option>
                            </select>
                          )}
                        />
                      </div>

                      {/* Additional Options */}
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <Controller
                            name="retryFailedNotifications"
                            control={control}
                            render={({ field }) => (
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                            )}
                          />
                          <label className="ml-2 block text-sm text-gray-900">
                            Automatically retry failed notifications
                          </label>
                        </div>
                        <div className="flex items-center">
                          <Controller
                            name="deliveryConfirmation"
                            control={control}
                            render={({ field }) => (
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                            )}
                          />
                          <label className="ml-2 block text-sm text-gray-900">
                            Request delivery confirmation when possible
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isValid || isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Generating...' : 'Generate Schedule'}
                </button>
              </div>
            </form>
          )}

          {step === 'generating' && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Generating Your Schedule</h3>
              <p className="text-gray-600 mb-4">
                AI is analyzing constraints, staff preferences, and business requirements...
              </p>
              <div className="max-w-md mx-auto">
                <div className="text-sm text-gray-500 space-y-1">
                  <div className={progress >= 20 ? 'text-green-600' : ''}>
                    ✓ Analyzing staff availability and skills
                  </div>
                  <div className={progress >= 40 ? 'text-green-600' : ''}>
                    ✓ Processing scheduling constraints
                  </div>
                  <div className={progress >= 60 ? 'text-green-600' : ''}>
                    ✓ Optimizing shift assignments
                  </div>
                  <div className={progress >= 80 ? 'text-green-600' : ''}>
                    ✓ Generating assignment reasoning
                  </div>
                  <div className={progress >= 100 ? 'text-green-600' : ''}>
                    ✓ Finalizing schedule draft
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'review' && generatedSchedule && (
            <div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
                  <h3 className="text-sm font-medium text-green-800">
                    Schedule Generated Successfully!
                  </h3>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  Your AI-powered schedule has been created. Review the assignments below and publish when ready.
                </p>
              </div>

              {/* Schedule Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {generatedSchedule.totalShifts || 0}
                  </div>
                  <div className="text-sm text-blue-800">Total Shifts</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {generatedSchedule.fullyStaffed || 0}
                  </div>
                  <div className="text-sm text-green-800">Fully Staffed</div>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-amber-600">
                    {Math.round((generatedSchedule.averageConfidence || 0) * 100)}%
                  </div>
                  <div className="text-sm text-amber-800">Avg. Confidence</div>
                </div>
              </div>

              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  Schedule has been generated and is ready for review in the calendar view.
                </p>
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={() => setStep('configure')}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={() => setShowConfirmation(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 transition-colors"
                  >
                    Publish Schedule
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'publishing' && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Publishing Schedule</h3>
              <p className="text-gray-600 mb-4">
                Finalizing schedule and sending notifications to staff...
              </p>
            </div>
          )}
        </div>

        {/* Confirmation Dialog */}
        {showConfirmation && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Confirm Schedule Publication
              </h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to publish this schedule? This will:
              </p>
              <ul className="text-sm text-gray-600 space-y-1 mb-6">
                <li>• Make the schedule live and visible to all staff</li>
                <li>• Send notifications to affected staff members</li>
                <li>• Replace any existing schedule for this period</li>
                <li>• Cannot be easily undone</li>
              </ul>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePublishSchedule}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 transition-colors"
                >
                  Publish Schedule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AutoScheduleModal