/**
 * Enhanced API Service for LocalOps AI Scheduling System
 * 
 * This service provides methods to interact with the enhanced AI scheduling system
 * including shift templates, employee availability, weekly hour allocation,
 * and advanced scheduling features.
 */

export interface ShiftTemplate {
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

export interface EmployeeAvailability {
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

export interface WeeklyHourAllocation {
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

export interface ShiftSwapRequest {
  id: number
  requester_name: string
  target_staff_name: string
  requester_shift_date: string
  target_shift_date: string
  reason: string
  status: string
  created_at: string
}

export interface OpenShift {
  id: number
  shift_title: string
  shift_date: string
  start_time: string
  end_time: string
  required_skills: string[]
  hourly_rate?: number
  pickup_deadline?: string
}

export interface EnhancedSchedulingParams {
  date_range_start: string
  date_range_end: string
  use_templates: boolean
  respect_availability: boolean
  optimize_hours: boolean
  strategy: string
  special_events: any[]
  staff_notes: any[]
  constraints: Record<string, any>
  template_configs?: Array<{
    template_id: number
    days_to_apply: number[]
  }>
}

export interface EnhancedSchedulingResult {
  draft_id: string
  total_shifts: number
  assigned_shifts: number
  unassigned_shifts: number
  overall_confidence: number
  analytics: {
    total_scheduled_hours: number
    total_labor_cost: number
    coverage_rate: number
    understaffed_shifts: number
    ai_confidence_average: number
  }
  warnings: string[]
  recommendations: string[]
}

class EnhancedApiService {
  private baseUrl: string

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Enhanced Scheduling
  async generateEnhancedSchedule(
    businessId: number,
    params: EnhancedSchedulingParams
  ): Promise<EnhancedSchedulingResult> {
    return this.request<EnhancedSchedulingResult>(
      `/api/enhanced-scheduling/${businessId}/generate`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    )
  }

  // Shift Templates
  async getShiftTemplates(businessId: number): Promise<ShiftTemplate[]> {
    return this.request<ShiftTemplate[]>(`/api/shift-templates/${businessId}`)
  }

  async createShiftTemplate(
    businessId: number,
    templateData: Omit<ShiftTemplate, 'id'>
  ): Promise<{ id: number; name: string; message: string }> {
    return this.request(`/api/shift-templates/${businessId}`, {
      method: 'POST',
      body: JSON.stringify(templateData),
    })
  }

  async updateShiftTemplate(
    businessId: number,
    templateId: number,
    templateData: Partial<ShiftTemplate>
  ): Promise<{ message: string }> {
    return this.request(`/api/shift-templates/${businessId}/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(templateData),
    })
  }

  async deleteShiftTemplate(
    businessId: number,
    templateId: number
  ): Promise<{ message: string }> {
    return this.request(`/api/shift-templates/${businessId}/${templateId}`, {
      method: 'DELETE',
    })
  }

  // Employee Availability
  async getEmployeeAvailability(businessId: number): Promise<EmployeeAvailability[]> {
    return this.request<EmployeeAvailability[]>(`/api/employee-availability/${businessId}`)
  }

  async setEmployeeAvailability(
    businessId: number,
    availabilityData: {
      staff_id: number
      day_of_week: number
      availability_type: string
      start_time?: string
      end_time?: string
      priority?: string
      notes?: string
    }
  ): Promise<{ message: string }> {
    return this.request(`/api/employee-availability/${businessId}`, {
      method: 'POST',
      body: JSON.stringify(availabilityData),
    })
  }

  // Weekly Hour Allocations
  async getWeeklyHourAllocations(
    businessId: number,
    weekStart: string
  ): Promise<WeeklyHourAllocation[]> {
    return this.request<WeeklyHourAllocation[]>(
      `/api/weekly-hour-allocations/${businessId}?week_start=${weekStart}`
    )
  }

  async setWeeklyHourAllocation(
    businessId: number,
    allocationData: {
      staff_id: number
      week_start: string
      target_hours: number
      status?: string
    }
  ): Promise<{ message: string }> {
    return this.request(`/api/weekly-hour-allocations/${businessId}`, {
      method: 'POST',
      body: JSON.stringify(allocationData),
    })
  }

  // Schedule Overrides
  async applyScheduleOverride(
    draftId: string,
    overrideData: {
      shift_id: number
      staff_id: number
      override_type: string
      reason?: string
      overridden_by?: number
    }
  ): Promise<{ override_id: number; message: string }> {
    return this.request(`/api/schedule-override/${draftId}`, {
      method: 'POST',
      body: JSON.stringify(overrideData),
    })
  }

  // Shift Swap Requests
  async createShiftSwapRequest(
    businessId: number,
    swapData: {
      requester_id: number
      target_staff_id: number
      requester_shift_id: number
      target_shift_id: number
      reason?: string
    }
  ): Promise<{ swap_id: number; message: string }> {
    return this.request(`/api/shift-swap-requests/${businessId}`, {
      method: 'POST',
      body: JSON.stringify(swapData),
    })
  }

  async getShiftSwapRequests(
    businessId: number,
    status: string = 'pending'
  ): Promise<ShiftSwapRequest[]> {
    return this.request<ShiftSwapRequest[]>(
      `/api/shift-swap-requests/${businessId}?status=${status}`
    )
  }

  async approveShiftSwapRequest(
    businessId: number,
    swapId: number,
    approvedBy: number
  ): Promise<{ message: string }> {
    return this.request(`/api/shift-swap-requests/${businessId}/${swapId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approved_by: approvedBy }),
    })
  }

  async rejectShiftSwapRequest(
    businessId: number,
    swapId: number,
    reason?: string
  ): Promise<{ message: string }> {
    return this.request(`/api/shift-swap-requests/${businessId}/${swapId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  // Open Shifts
  async createOpenShift(
    businessId: number,
    openShiftData: {
      shift_id: number
      required_skills: string[]
      hourly_rate?: number
      pickup_deadline?: string
    }
  ): Promise<{ open_shift_id: number; message: string }> {
    return this.request(`/api/open-shifts/${businessId}`, {
      method: 'POST',
      body: JSON.stringify(openShiftData),
    })
  }

  async getOpenShifts(businessId: number): Promise<OpenShift[]> {
    return this.request<OpenShift[]>(`/api/open-shifts/${businessId}`)
  }

  async claimOpenShift(
    businessId: number,
    openShiftId: number,
    staffId: number
  ): Promise<{ message: string }> {
    return this.request(`/api/open-shifts/${businessId}/${openShiftId}/claim`, {
      method: 'POST',
      body: JSON.stringify({ staff_id: staffId }),
    })
  }

  // Schedule Analytics
  async getScheduleAnalytics(
    businessId: number,
    weekStart: string
  ): Promise<{
    total_scheduled_hours: number
    total_labor_cost: number
    coverage_rate: number
    overtime_hours: number
    understaffed_shifts: number
    employee_satisfaction_score?: number
    ai_confidence_average: number
    manual_overrides_count: number
    shift_swap_requests: number
    open_shift_pickups: number
  }> {
    return this.request(
      `/api/schedule-analytics/${businessId}?week_start=${weekStart}`
    )
  }

  // Bulk Operations
  async copyWeekSchedule(
    businessId: number,
    sourceWeekStart: string,
    targetWeekStart: string
  ): Promise<{ message: string; copied_shifts: number }> {
    return this.request(`/api/schedule/${businessId}/copy-week`, {
      method: 'POST',
      body: JSON.stringify({
        source_week_start: sourceWeekStart,
        target_week_start: targetWeekStart,
      }),
    })
  }

  async applyTemplateToWeek(
    businessId: number,
    templateId: number,
    weekStart: string,
    daysToApply: number[]
  ): Promise<{ message: string; created_shifts: number }> {
    return this.request(`/api/schedule/${businessId}/apply-template`, {
      method: 'POST',
      body: JSON.stringify({
        template_id: templateId,
        week_start: weekStart,
        days_to_apply: daysToApply,
      }),
    })
  }

  // Employee Self-Service
  async getEmployeeSchedule(
    staffId: number,
    weekStart: string
  ): Promise<{
    shifts: Array<{
      id: number
      title: string
      date: string
      start_time: string
      end_time: string
      status: string
    }>
    total_hours: number
    overtime_hours: number
  }> {
    return this.request(
      `/api/staff/${staffId}/schedule?week_start=${weekStart}`
    )
  }

  async updateEmployeeAvailability(
    staffId: number,
    availabilityData: {
      day_of_week: number
      availability_type: string
      start_time?: string
      end_time?: string
      priority?: string
      notes?: string
    }
  ): Promise<{ message: string }> {
    return this.request(`/api/staff/${staffId}/availability`, {
      method: 'POST',
      body: JSON.stringify(availabilityData),
    })
  }

  async requestTimeOff(
    staffId: number,
    timeOffData: {
      start_date: string
      end_date: string
      reason: string
      type: 'vacation' | 'sick' | 'personal' | 'other'
    }
  ): Promise<{ request_id: number; message: string }> {
    return this.request(`/api/staff/${staffId}/time-off-request`, {
      method: 'POST',
      body: JSON.stringify(timeOffData),
    })
  }

  // Notifications
  async sendScheduleNotification(
    draftId: string,
    notificationData: {
      staff_ids: number[]
      message: string
      channels: string[]
    }
  ): Promise<{ message: string; sent_count: number }> {
    return this.request(`/api/notifications/schedule/${draftId}/send`, {
      method: 'POST',
      body: JSON.stringify(notificationData),
    })
  }

  async getNotificationStatus(
    draftId: string
  ): Promise<{
    total_notifications: number
    sent_count: number
    delivered_count: number
    failed_count: number
  }> {
    return this.request(`/api/notifications/schedule/${draftId}/status`)
  }
}

// Export singleton instance
export const enhancedApi = new EnhancedApiService() 