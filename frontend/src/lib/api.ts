// API client for LocalOps AI backend
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.localops.ai' 
  : 'http://localhost:8001'

class APIClient {
  private baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error)
      throw error
    }
  }

  // Staff Management
  async getStaff(businessId: number) {
    return this.request(`/api/staff/${businessId}`)
  }

  async createStaff(staffData: {
    business_id: number
    name: string
    phone_number: string
    email?: string
    role: string
    skills: string[]
    availability?: Record<string, string[]>
  }) {
    return this.request('/api/staff', {
      method: 'POST',
      body: JSON.stringify(staffData)
    })
  }

  async updateStaff(staffId: number, updates: any) {
    return this.request(`/api/staff/${staffId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    })
  }

  async deleteStaff(staffId: number) {
    return this.request(`/api/staff/${staffId}`, {
      method: 'DELETE'
    })
  }

  async getStaffMember(staffId: number) {
    return this.request(`/api/staff/${staffId}`)
  }

  // Shift Management
  async getShifts(businessId: number, startDate: string, endDate: string) {
    return this.request(`/api/shifts/${businessId}?start_date=${startDate}&end_date=${endDate}`)
  }

  async createShift(businessId: number, shiftData: any) {
    return this.request(`/api/schedule/${businessId}/shifts`, {
      method: 'POST',
      body: JSON.stringify(shiftData)
    })
  }

  async assignStaff(businessId: number, shiftId: number, staffId: number) {
    return this.request(`/api/schedule/${businessId}/shifts/${shiftId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ staff_id: staffId })
    })
  }

  // Sick Leave & Emergency Coverage
  async reportSickLeave(sickLeaveData: {
    staff_id: number
    shift_id: number
    business_id: number
    reason: string
    message?: string
  }) {
    return this.request('/api/sick-leave', {
      method: 'POST',
      body: JSON.stringify(sickLeaveData)
    })
  }

  async createEmergencyRequest(requestData: {
    business_id: number
    business_name: string
    shift_date: string
    shift_start: string
    shift_end: string
    required_skill: string
    urgency: string
    message?: string
  }) {
    return this.request('/api/emergency-request', {
      method: 'POST',
      body: JSON.stringify(requestData)
    })
  }

  // AI Features
  async generateAutoSchedule(businessId: number, params: {
    date_range_start: string
    date_range_end: string
    special_events?: any[]
    staff_notes?: any[]
    constraints?: any
  }) {
    return this.request(`/api/auto-schedule/${businessId}/generate`, {
      method: 'POST',
      body: JSON.stringify(params)
    })
  }

  async getPredictiveSchedule(businessId: number, weekStart: string) {
    return this.request(`/api/predictive-scheduling/${businessId}/generate`, {
      method: 'POST',
      body: JSON.stringify({ week_start: weekStart })
    })
  }

  async getCommunicationAnalytics(businessId: number) {
    return this.request(`/api/smart-communication/${businessId}/analytics`)
  }

  async sendSmartMessage(businessId: number, messageData: any) {
    return this.request(`/api/smart-communication/${businessId}/send`, {
      method: 'POST',
      body: JSON.stringify(messageData)
    })
  }

  // Training Management
  async getTrainingAnalytics(businessId: number) {
    return this.request(`/api/training/${businessId}/analytics`)
  }

  async createTrainingModule(businessId: number, moduleData: any) {
    return this.request(`/api/training/${businessId}/modules`, {
      method: 'POST',
      body: JSON.stringify(moduleData)
    })
  }

  // Business Intelligence
  async getRealTimeMetrics(businessId: number) {
    try {
      return await this.request(`/api/business-intelligence/${businessId}/real-time`)
    } catch (error) {
      // Return mock data if backend is not available
      return {
        labour_cost_percentage: 28.5,
        staff_utilisation: 85.2,
        shift_coverage_rate: 92.1,
        staff_punctuality_rate: 87.3,
        emergency_response_time: 12.5,
        total_staff: 10,
        active_staff: 9,
        avg_reliability_score: 8.7,
        hourly_data: [
          {"hour": 8, "revenue": 120, "staff_count": 2, "customer_count": 15, "efficiency_score": 82},
          {"hour": 9, "revenue": 150, "staff_count": 2, "customer_count": 18, "efficiency_score": 85},
          {"hour": 10, "revenue": 180, "staff_count": 3, "customer_count": 22, "efficiency_score": 88},
          {"hour": 11, "revenue": 220, "staff_count": 3, "customer_count": 28, "efficiency_score": 90},
          {"hour": 12, "revenue": 350, "staff_count": 4, "customer_count": 45, "efficiency_score": 92},
          {"hour": 13, "revenue": 420, "staff_count": 5, "customer_count": 52, "efficiency_score": 94},
          {"hour": 14, "revenue": 380, "staff_count": 4, "customer_count": 48, "efficiency_score": 91},
          {"hour": 15, "revenue": 320, "staff_count": 4, "customer_count": 40, "efficiency_score": 89},
          {"hour": 16, "revenue": 280, "staff_count": 3, "customer_count": 35, "efficiency_score": 87},
          {"hour": 17, "revenue": 300, "staff_count": 4, "customer_count": 38, "efficiency_score": 88},
          {"hour": 18, "revenue": 450, "staff_count": 5, "customer_count": 56, "efficiency_score": 93},
          {"hour": 19, "revenue": 520, "staff_count": 6, "customer_count": 65, "efficiency_score": 95},
          {"hour": 20, "revenue": 480, "staff_count": 5, "customer_count": 60, "efficiency_score": 94},
          {"hour": 21, "revenue": 380, "staff_count": 4, "customer_count": 48, "efficiency_score": 91},
          {"hour": 22, "revenue": 280, "staff_count": 3, "customer_count": 35, "efficiency_score": 87},
          {"hour": 23, "revenue": 180, "staff_count": 2, "customer_count": 22, "efficiency_score": 84}
        ],
        trends: {
          labour_cost_trend: "decreasing",
          utilisation_trend: "increasing", 
          coverage_trend: "stable"
        },
        targets: {
          labour_cost_target: 30.0,
          utilisation_target: 85.0,
          coverage_target: 95.0,
          punctuality_target: 90.0
        }
      }
    }
  }

  async getWeeklyReport(businessId: number) {
    return this.request(`/api/business-intelligence/${businessId}/weekly-report`)
  }

  // Inventory Intelligence
  async getInventoryDashboard(businessId: number) {
    return this.request(`/api/inventory/${businessId}/dashboard`)
  }

  async getInventoryPredictions(businessId: number) {
    return this.request(`/api/inventory/${businessId}/predictions`)
  }

  async getSmartOrders(businessId: number) {
    return this.request(`/api/inventory/${businessId}/smart-orders`)
  }

  // Multi-Location
  async getLocations(businessId: number) {
    return this.request(`/api/multi-location/${businessId}/locations`)
  }

  async getTransfers(businessId: number) {
    return this.request(`/api/multi-location/${businessId}/transfers`)
  }

  async createStaffTransfer(transferData: any) {
    return this.request('/api/multi-location/staff-transfer', {
      method: 'POST',
      body: JSON.stringify(transferData)
    })
  }

  // Emergency Response
  async getEmergencyIncidents(businessId: number) {
    return this.request(`/api/emergency-response/${businessId}/incidents`)
  }

  async createEmergencyIncident(businessId: number, incidentData: any) {
    return this.request(`/api/emergency-response/${businessId}/incident`, {
      method: 'POST',
      body: JSON.stringify(incidentData)
    })
  }

  // Customer Experience
  async getCustomerReviews(businessId: number) {
    return this.request(`/api/customer-experience/${businessId}/reviews`)
  }

  async getServiceMetrics(businessId: number) {
    return this.request(`/api/customer-experience/${businessId}/service-metrics`)
  }

  // Staff Preferences
  async getStaffPreferences(staffId: number) {
    return this.request(`/api/staff/${staffId}/preferences`)
  }

  async createStaffPreference(staffId: number, preference: any) {
    return this.request(`/api/staff/${staffId}/preferences`, {
      method: 'POST',
      body: JSON.stringify(preference)
    })
  }

  async updateStaffPreference(staffId: number, preferenceId: number, updates: any) {
    return this.request(`/api/staff/${staffId}/preferences/${preferenceId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    })
  }

  // Constraint Validation
  async validateConstraints(businessId: number, assignments: any[], draftId?: string) {
    return this.request('/api/constraints/validate', {
      method: 'POST',
      body: JSON.stringify({
        business_id: businessId,
        assignments,
        draft_id: draftId
      })
    })
  }

  async validateSingleAssignment(businessId: number, shiftId: number, staffId: number, existingAssignments: any[] = []) {
    return this.request('/api/constraints/validate-assignment', {
      method: 'POST',
      body: JSON.stringify({
        business_id: businessId,
        shift_id: shiftId,
        staff_id: staffId,
        existing_assignments: existingAssignments
      })
    })
  }

  // In-App Notifications
  async getStaffNotifications(staffId: number, unreadOnly: boolean = false, limit: number = 20) {
    return this.request(`/api/notifications/${staffId}?unread_only=${unreadOnly}&limit=${limit}`)
  }

  async markNotificationRead(notificationId: number, staffId: number) {
    return this.request(`/api/notifications/${notificationId}/read`, {
      method: 'POST',
      body: JSON.stringify({ staff_id: staffId })
    })
  }

  async respondToNotification(notificationId: number, staffId: number, response: string, message?: string) {
    return this.request(`/api/notifications/${notificationId}/respond`, {
      method: 'POST',
      body: JSON.stringify({
        staff_id: staffId,
        response: response,
        message: message
      })
    })
  }

  // Health Check
  async healthCheck() {
    return this.request('/health')
  }

  // Bolt-On Management API
  async getBoltOnDashboard(boltOnType: string): Promise<{
    bolt_on_type: string
    platform_enabled: boolean
    monthly_price: number
    total_businesses: number
    active_subscriptions: number
    total_revenue: number
    businesses: Array<{
      business_id: number
      business_name: string
      subscription_tier: string
      bolt_on_type: string
      is_enabled: boolean
      is_entitled: boolean
      last_sync_at: string | null
      usage_30d: number | null
      connection_status: string
      error_message: string | null
    }>
  }> {
    return this.request(`/api/admin/bolt-ons/${boltOnType}/dashboard`)
  }

  async toggleBoltOn(boltOnType: string, businessId: number, enable: boolean, reason?: string): Promise<{
    success: boolean
    message: string
    new_status: boolean
    audit_log_id: number
  }> {
    return this.request(`/api/admin/bolt-ons/${boltOnType}/toggle`, {
      method: 'POST',
      body: JSON.stringify({
        business_id: businessId,
        bolt_on_type: boltOnType,
        enable,
        reason
      })
    })
  }

  async performBulkAction(boltOnType: string, action: string, targetPlan?: string, reason?: string): Promise<{
    success: boolean
    message: string
    affected_businesses: number
    audit_log_ids: number[]
  }> {
    return this.request(`/api/admin/bolt-ons/${boltOnType}/bulk-action`, {
      method: 'POST',
      body: JSON.stringify({
        bolt_on_type: boltOnType,
        action,
        target_plan: targetPlan,
        reason
      })
    })
  }

  async getBoltOnAnalytics(boltOnType: string, businessId: number, period: string = '30d'): Promise<{
    business_id: number
    business_name: string
    period: string
    total_sales: number
    transaction_count: number
    average_transaction: number
    peak_hours: Array<{
      hour: number
      sales: number
      transactions: number
    }>
    top_items: Array<{
      item_name: string
      total_quantity: number
      total_revenue: number
    }>
    sync_errors: number
    last_sync_success: boolean
  }> {
    return this.request(`/api/admin/bolt-ons/${boltOnType}/business/${businessId}/analytics?period=${period}`)
  }

  async updateBoltOnConfig(boltOnType: string, config: {
    is_platform_enabled?: boolean
    monthly_price?: number
    required_plan?: string
    description?: string
    features?: string[]
  }): Promise<boolean> {
    return this.request(`/api/admin/bolt-ons/${boltOnType}/config`, {
      method: 'PUT',
      body: JSON.stringify(config)
    })
  }

  async getBoltOnAuditLogs(businessId?: number, boltOnType?: string, limit: number = 100): Promise<Array<{
    id: number
    business_id: number
    business_name: string
    bolt_on_type: string
    action: string
    performed_by: number
    performer_name: string
    old_value: any
    new_value: any
    reason: string
    created_at: string
  }>> {
    const params = new URLSearchParams()
    if (businessId) params.append('business_id', businessId.toString())
    if (boltOnType) params.append('bolt_on_type', boltOnType)
    params.append('limit', limit.toString())
    
    return this.request(`/api/admin/bolt-ons/audit-logs?${params.toString()}`)
  }

  // SumUp Integration Methods
  async getSumUpStatus(businessId: number): Promise<{
    is_connected: boolean;
    is_entitled: boolean;
    last_sync_at: string | null;
    sync_frequency_hours: number;
    merchant_id: string | null;
    location_count: number;
    total_transactions: number;
    last_7_days_sales: number;
    connection_status: string;
    error_message: string | null;
  }> {
    return this.request(`/integrations/sumup/${businessId}/status`)
  }

  async getSumUpUpgradePrompt(businessId: number): Promise<{
    show_upgrade: boolean;
    current_plan: string;
    required_plan: string;
    bolt_on_price: number;
    features_unlocked: string[];
    upgrade_url: string | null;
  }> {
    return this.request(`/integrations/sumup/${businessId}/upgrade-prompt`)
  }

  async getSumUpAnalytics(businessId: number): Promise<{
    period: {
      start_date: string;
      end_date: string;
      days: number;
    };
    daily_sales: Array<{
      date: string;
      total_sales: number;
      transaction_count: number;
      average_transaction: number;
    }>;
    hourly_patterns: Array<{
      hour: number;
      total_sales: number;
      transaction_count: number;
    }>;
    top_items: Array<{
      item_name: string;
      total_quantity: number;
      total_revenue: number;
    }>;
  }> {
    return this.request(`/integrations/sumup/${businessId}/analytics`)
  }

  async getSumUpLogs(businessId: number): Promise<Array<{
    id: number;
    operation: string;
    status: string;
    message: string | null;
    details: any;
    error_code: string | null;
    error_message: string | null;
    created_at: string;
  }>> {
    return this.request(`/integrations/sumup/${businessId}/logs`)
  }

  async syncSumUp(businessId: number, data: { business_id: number; force_sync: boolean }): Promise<{
    success: boolean;
    transactions_synced: number;
    message: string;
  }> {
    return this.request(`/integrations/sumup/${businessId}/sync`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async toggleSumUpIntegration(businessId: number, data: { enable: boolean }): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request(`/business/${businessId}/integrations/sumup_sync/toggle`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async disconnectSumUp(businessId: number, data: { business_id: number; revoke_tokens: boolean }): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request(`/integrations/sumup/${businessId}/disconnect`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }
}

export default new APIClient() 