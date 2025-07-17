import { useState, useEffect } from 'react'
import { 
  XMarkIcon, 
  UserGroupIcon, 
  ClockIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  HeartIcon,
  ShieldCheckIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline'
import { format, parseISO, isSameDay } from 'date-fns'
import { supabase, Staff } from '../../lib/supabase'
import { usePermissions, RoleBadge } from '../hooks/usePermissions'



interface RoleRequirement {
  id: number
  role_type: string
  required_count: number
  filled_count: number
  priority: number
}

interface StaffAvailability {
  id: number
  staff_id: number
  start_date: string
  end_date: string
  availability_type: string
  status: string
  reason: string
}

interface Shift {
  id: number
  title: string
  date: string
  start_time: string
  end_time: string
  required_skill: string
  required_staff_count: number
  status: string
  assignments: any[]
}

interface ShiftDetailModalProps {
  shift: Shift
  onClose: () => void
  onAssignStaff: (staffId: number) => void
  onRemoveStaff: (assignmentId: number) => void
}

export default function ShiftDetailModal({ shift, onClose, onAssignStaff, onRemoveStaff }: ShiftDetailModalProps) {
  const [allStaff, setAllStaff] = useState<Staff[]>([])
  const [staffAvailability, setStaffAvailability] = useState<StaffAvailability[]>([])
  const [roleRequirements, setRoleRequirements] = useState<RoleRequirement[]>([])
  const [loading, setLoading] = useState(true)
  const [editingRequirements, setEditingRequirements] = useState(false)
  
  // Get permission context
  const permissions = usePermissions()

  // Calculate projected pay for a shift
  const calculateShiftPay = (hourlyRate: number, startTime: string, endTime: string): string => {
    const start = parseInt(startTime.replace(':', ''))
    const end = parseInt(endTime.replace(':', ''))
    const hours = (end - start) / 100
    const pay = hourlyRate * hours
    return pay.toFixed(2)
  }

  useEffect(() => {
    loadStaffData()
  }, [shift])

  const loadStaffData = async () => {
    try {
      // Load all staff with enhanced role information
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('business_id', 1)
        .eq('is_active', true)

      if (staffError) throw staffError

      // Load staff availability for the shift date
      const { data: availabilityData, error: availabilityError } = await supabase
        .from('staff_availability')
        .select('*')
        .eq('business_id', 1)
        .lte('start_date', shift.date)
        .gte('end_date', shift.date)

      if (availabilityError) throw availabilityError

      // Load role requirements for this shift
      const { data: roleReqData, error: roleReqError } = await supabase
        .from('shift_role_requirements')
        .select('*')
        .eq('shift_id', shift.id)
        .order('priority', { ascending: true })

      if (roleReqError) {
        console.log('No role requirements found, creating default ones')
        // Create default role requirements if none exist
        await createDefaultRoleRequirements()
      } else {
        setRoleRequirements(roleReqData || [])
      }

      setAllStaff(staffData || [])
      setStaffAvailability(availabilityData || [])
    } catch (error) {
      console.error('Error loading staff data:', error)
    } finally {
      setLoading(false)
    }
  }

  const createDefaultRoleRequirements = async () => {
    const defaultRequirements = [
      { role_type: 'manager', required_count: 0, priority: 1 },
      { role_type: 'supervisor', required_count: 1, priority: 2 },
      { role_type: shift.required_skill, required_count: shift.required_staff_count, priority: 3 }
    ]

    try {
      const { data, error } = await supabase
        .from('shift_role_requirements')
        .insert(
          defaultRequirements.map(req => ({
            shift_id: shift.id,
            ...req,
            filled_count: 0
          }))
        )
        .select()

      if (!error && data) {
        setRoleRequirements(data)
      }
    } catch (error) {
      console.error('Error creating default role requirements:', error)
    }
  }

  const updateRoleRequirement = async (requirementId: number, newCount: number) => {
    try {
      const { error } = await supabase
        .from('shift_role_requirements')
        .update({ required_count: Math.max(0, newCount) })
        .eq('id', requirementId)

      if (!error) {
        setRoleRequirements(prev => 
          prev.map(req => 
            req.id === requirementId 
              ? { ...req, required_count: Math.max(0, newCount) }
              : req
          )
        )
      }
    } catch (error) {
      console.error('Error updating role requirement:', error)
    }
  }

  const addNewRoleRequirement = async (roleType: string) => {
    try {
      const { data, error } = await supabase
        .from('shift_role_requirements')
        .insert({
          shift_id: shift.id,
          role_type: roleType,
          required_count: 1,
          filled_count: 0,
          priority: roleRequirements.length + 1
        })
        .select()
        .single()

      if (!error && data) {
        setRoleRequirements(prev => [...prev, data])
      }
    } catch (error) {
      console.error('Error adding role requirement:', error)
    }
  }

  const getStaffForRole = (roleType: string) => {
    return allStaff.filter(staff => {
      // Check if staff has the role in their roles array or matches their primary role
      const hasRole = staff.roles?.includes(roleType) || 
                     staff.role === roleType ||
                     staff.skills?.includes(roleType)
      
      // Also check seniority level for management roles
      if (roleType === 'manager' && staff.seniority_level === 'manager') return true
      if (roleType === 'supervisor' && ['supervisor', 'manager'].includes(staff.seniority_level)) return true
      
      return hasRole
    })
  }

  const getAssignedStaffForRole = (roleType: string) => {
    const roleStaff = getStaffForRole(roleType)
    return roleStaff.filter(staff => 
      shift.assignments.some(assignment => assignment.staff_id === staff.id)
    )
  }

  const getRoleDisplayName = (roleType: string) => {
    const roleNames: { [key: string]: string } = {
      'manager': 'Managers',
      'supervisor': 'Supervisors', 
      'chef': 'Chefs',
      'cook': 'Cooks',
      'server': 'Servers',
      'bartender': 'Bartenders',
      'kitchen': 'Kitchen Staff',
      'bar': 'Bar Staff',
      'front_of_house': 'Front of House',
      'cleaning': 'Cleaning Staff'
    }
    return roleNames[roleType] || roleType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const getStaffAvailabilityStatus = (staff: Staff) => {
    const shiftDate = parseISO(shift.date)
    const dayOfWeek = format(shiftDate, 'EEEE').toLowerCase()
    
    // Check for time off (holiday, sick leave, etc.)
    const timeOff = staffAvailability.find(avail => 
      avail.staff_id === staff.id && 
      avail.status === 'approved'
    )
    
    if (timeOff) {
      return {
        available: false,
        reason: `${timeOff.availability_type.replace('_', ' ')} - ${timeOff.reason}`,
        type: timeOff.availability_type,
        color: timeOff.availability_type === 'sick_leave' ? 'red' : 
               timeOff.availability_type === 'holiday' ? 'blue' : 'yellow'
      }
    }

    // Check unavailable times
    const unavailableTimes = staff.unavailable_times || []
    for (const unavailable of unavailableTimes) {
      if (unavailable.day === dayOfWeek) {
        if (unavailable.all_day) {
          return {
            available: false,
            reason: `Not available ${dayOfWeek}s - ${unavailable.reason}`,
            type: 'unavailable_time',
            color: 'gray'
          }
        }
        
        // Check if shift time conflicts with unavailable time
        const shiftStart = parseInt(shift.start_time.replace(':', ''))
        const shiftEnd = parseInt(shift.end_time.replace(':', ''))
        const unavailStart = parseInt(unavailable.start_time?.replace(':', '') || '0')
        const unavailEnd = parseInt(unavailable.end_time?.replace(':', '') || '2359')
        
        if ((shiftStart >= unavailStart && shiftStart < unavailEnd) ||
            (shiftEnd > unavailStart && shiftEnd <= unavailEnd) ||
            (shiftStart <= unavailStart && shiftEnd >= unavailEnd)) {
          return {
            available: false,
            reason: `Unavailable ${unavailable.start_time}-${unavailable.end_time} - ${unavailable.reason}`,
            type: 'unavailable_time',
            color: 'gray'
          }
        }
      }
    }

    // Check if already assigned
    const isAssigned = shift.assignments.some(assignment => assignment.staff_id === staff.id)
    if (isAssigned) {
      return {
        available: true,
        reason: 'Already assigned to this shift',
        type: 'assigned',
        color: 'green'
      }
    }

    // Check if has required skill
    if (!staff.skills.includes(shift.required_skill)) {
      return {
        available: false,
        reason: `Missing required skill: ${shift.required_skill.replace('_', ' ')}`,
        type: 'no_skill',
        color: 'orange'
      }
    }

    return {
      available: true,
      reason: 'Available for this shift',
      type: 'available',
      color: 'green'
    }
  }

  const getShiftDuration = () => {
    const start = parseInt(shift.start_time.replace(':', ''))
    const end = parseInt(shift.end_time.replace(':', ''))
    const duration = (end - start) / 100
    return duration
  }

  const getStatusIcon = (status: any) => {
    switch (status.type) {
      case 'sick_leave':
        return <HeartIcon className="h-4 w-4 text-red-500" />
      case 'holiday':
        return <CalendarDaysIcon className="h-4 w-4 text-blue-500" />
      case 'assigned':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />
      case 'available':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />
      default:
        return <ExclamationTriangleIcon className="h-4 w-4 text-gray-500" />
    }
  }

  const availableStaff = allStaff.filter(staff => {
    const status = getStaffAvailabilityStatus(staff)
    return status.available && status.type !== 'assigned'
  })

  const unavailableStaff = allStaff.filter(staff => {
    const status = getStaffAvailabilityStatus(staff)
    return !status.available
  })

  const assignedStaff = allStaff.filter(staff => {
    return shift.assignments.some(assignment => assignment.staff_id === staff.id)
  })

  // Permission-based filtering
  const canAssignToStaff = (staffId: number) => {
    return permissions.canAssignShiftToUser(staffId)
  }

  const canRemoveStaff = (staffId: number) => {
    // Can remove if can assign, or if it's self-assignment and user is staff
    return permissions.canAssignShiftToUser(staffId) || 
           (permissions.currentUser?.id === staffId && permissions.isStaff())
  }

  const canEditRequirements = () => {
    return permissions.canCreateShift() || permissions.isManager() || permissions.isAdmin() || permissions.isSuperAdmin()
  }

  if (loading || permissions.loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading staff availability...</p>
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
            <h2 className="text-xl font-semibold text-gray-900">{shift.title}</h2>
            <p className="text-sm text-gray-600">
              {format(parseISO(shift.date), 'EEEE, MMMM d, yyyy')} • {shift.start_time} - {shift.end_time}
            </p>
            <p className="text-sm text-gray-600">
              Duration: {getShiftDuration()} hours • Required: {shift.required_skill.replace('_', ' ')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <XMarkIcon className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          {/* Current User Role Badge */}
          {permissions.currentUser && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <ShieldCheckIcon className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Logged in as: {permissions.currentUser.name}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <RoleBadge role={permissions.currentUser.user_role} />
                      <span className="text-xs text-gray-600">
                        {permissions.canAssignShiftToUser(permissions.currentUser.id) ? 'Can assign shifts' : 'Limited permissions'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Role Requirements Section */}
          <div className="mb-6 p-4 rounded-lg bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-medium text-gray-900">Staffing Requirements</h3>
                <p className="text-sm text-gray-600">
                  {canEditRequirements() ? 'Adjust role quantities as needed' : 'View staffing requirements'}
                </p>
              </div>
              {canEditRequirements() && (
                <button
                  onClick={() => setEditingRequirements(!editingRequirements)}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                >
                  {editingRequirements ? 'Done' : 'Edit'}
                </button>
              )}
              {!canEditRequirements() && (
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <LockClosedIcon className="h-4 w-4" />
                  <span>Read Only</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {roleRequirements.map(requirement => {
                const assignedForRole = getAssignedStaffForRole(requirement.role_type)
                const availableForRole = getStaffForRole(requirement.role_type).filter(staff => 
                  !shift.assignments.some(assignment => assignment.staff_id === staff.id)
                )
                
                return (
                  <div key={requirement.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          {getRoleDisplayName(requirement.role_type)}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          assignedForRole.length >= requirement.required_count
                            ? 'bg-green-100 text-green-800'
                            : assignedForRole.length > 0
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {assignedForRole.length}/{requirement.required_count}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        ({availableForRole.length} available)
                      </span>
                    </div>

                    {editingRequirements && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateRoleRequirement(requirement.id, requirement.required_count - 1)}
                          className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600"
                          disabled={requirement.required_count <= 0}
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-medium">
                          {requirement.required_count}
                        </span>
                        <button
                          onClick={() => updateRoleRequirement(requirement.id, requirement.required_count + 1)}
                          className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {editingRequirements && (
              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Add role:</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addNewRoleRequirement(e.target.value)
                        e.target.value = ''
                      }
                    }}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1"
                  >
                    <option value="">Select role...</option>
                    <option value="manager">Manager</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="chef">Chef</option>
                    <option value="cook">Cook</option>
                    <option value="server">Server</option>
                    <option value="bartender">Bartender</option>
                    <option value="cleaning">Cleaning Staff</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Overall Shift Status */}
          <div className="mb-6 p-4 rounded-lg bg-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Overall Status</h3>
                <p className="text-sm text-gray-600">
                  {assignedStaff.length} total staff assigned
                </p>
                {assignedStaff.length > 0 && (
                  <p className="text-sm font-medium text-green-700 mt-1">
                    Total projected cost: £{assignedStaff.reduce((total, staff) => {
                      if (staff.hourly_rate) {
                        return total + parseFloat(calculateShiftPay(staff.hourly_rate, shift.start_time, shift.end_time))
                      }
                      return total
                    }, 0).toFixed(2)}
                  </p>
                )}
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                shift.status === 'filled' ? 'bg-green-100 text-green-800' :
                shift.status === 'understaffed' ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {shift.status}
              </div>
            </div>
          </div>

          {/* Currently Assigned Staff */}
          {assignedStaff.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                <UserGroupIcon className="h-5 w-5 mr-2" />
                Currently Assigned ({assignedStaff.length})
              </h3>
              <div className="space-y-2">
                {assignedStaff.map(staff => {
                  const assignment = shift.assignments.find(a => a.staff_id === staff.id)
                  return (
                    <div key={staff.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-green-600 font-medium text-sm">
                            {staff.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{staff.name}</p>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <span className="capitalize">{staff.role}</span>
                            <span>•</span>
                            <span>{staff.reliability_score}/10 reliability</span>
                            {staff.hourly_rate && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-green-600">
                                  £{calculateShiftPay(staff.hourly_rate, shift.start_time, shift.end_time)} projected
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-green-600 font-medium">Assigned</span>
                        {assignment && canRemoveStaff(staff.id) && (
                          <button
                            onClick={() => onRemoveStaff(assignment.id)}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        )}
                        {assignment && !canRemoveStaff(staff.id) && (
                          <div className="flex items-center space-x-1 text-xs text-gray-400">
                            <LockClosedIcon className="h-3 w-3" />
                            <span>No Permission</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Available Staff */}
          {availableStaff.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                <CheckCircleIcon className="h-5 w-5 mr-2 text-green-500" />
                Available Staff ({availableStaff.length})
              </h3>
              <div className="space-y-2">
                {availableStaff.map(staff => {
                  const status = getStaffAvailabilityStatus(staff)
                  return (
                    <div key={staff.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-medium text-sm">
                            {staff.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{staff.name}</p>
                          <p className="text-sm text-gray-600 capitalize">
                            {staff.role} • {staff.max_weekly_hours}h/week max • {staff.contract_type.replace('_', ' ')}
                          </p>
                          <p className="text-xs text-green-600">{status.reason}</p>
                        </div>
                      </div>
                      {canAssignToStaff(staff.id) ? (
                        <button
                          onClick={() => onAssignStaff(staff.id)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                        >
                          Assign
                        </button>
                      ) : (
                        <div className="flex items-center space-x-1 text-xs text-gray-400">
                          <LockClosedIcon className="h-3 w-3" />
                          <span>No Permission</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Unavailable Staff */}
          {unavailableStaff.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 mr-2 text-red-500" />
                Unavailable Staff ({unavailableStaff.length})
              </h3>
              <div className="space-y-2">
                {unavailableStaff.map(staff => {
                  const status = getStaffAvailabilityStatus(staff)
                  return (
                    <div key={staff.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg opacity-75">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 font-medium text-sm">
                            {staff.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">{staff.name}</p>
                          <p className="text-sm text-gray-500 capitalize">{staff.role}</p>
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(status)}
                            <p className="text-xs text-gray-600">{status.reason}</p>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 font-medium">Not Available</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {availableStaff.length === 0 && assignedStaff.length < shift.required_staff_count && (
            <div className="text-center py-8">
              <ExclamationTriangleIcon className="h-12 w-12 text-amber-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Available Staff</h4>
              <p className="text-gray-600">
                All qualified staff are either assigned, on leave, or unavailable for this shift.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}