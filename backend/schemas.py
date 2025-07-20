from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional, Dict, Any

# Staff Schemas
class StaffBase(BaseModel):
    name: str
    phone_number: str
    email: Optional[EmailStr] = None
    role: str
    skills: List[str]
    availability: Optional[Dict[str, List[str]]] = None

class StaffCreate(StaffBase):
    business_id: int

class StaffResponse(StaffBase):
    id: int
    business_id: int
    reliability_score: float
    is_active: bool
    hired_date: datetime
    last_shift_date: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Emergency Request Schemas
class EmergencyRequestBase(BaseModel):
    shift_date: datetime
    shift_start: str
    shift_end: str
    required_skill: str
    urgency: str = "normal"
    message: Optional[str] = None

class EmergencyRequestCreate(EmergencyRequestBase):
    business_id: int
    business_name: str

class EmergencyRequestResponse(BaseModel):
    request: Dict[str, Any]
    qualified_staff_count: int
    messages_sent: int
    message_results: List[Dict[str, Any]]

# Shift Coverage Schemas
class ShiftCoverageCreate(BaseModel):
    request_id: int
    staff_id: int
    response: str

class ShiftCoverageResponse(BaseModel):
    id: int
    request_id: int
    staff_id: int
    response: str
    response_time_minutes: Optional[int]
    responded_at: datetime
    
    class Config:
        from_attributes = True

# Business Schemas
class BusinessBase(BaseModel):
    name: str
    type: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    owner_name: Optional[str] = None

class BusinessCreate(BusinessBase):
    pass

class BusinessResponse(BusinessBase):
    id: int
    subscription_tier: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Message Schemas
class MessageRequest(BaseModel):
    phone_number: str
    message: str
    message_type: str = "general"

class MessageResponse(BaseModel):
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None

# Shift Management Schemas
class ShiftBase(BaseModel):
    title: str
    date: datetime
    start_time: str
    end_time: str
    required_skill: str
    required_staff_count: int = 1
    hourly_rate: Optional[float] = None
    notes: Optional[str] = None

class ShiftCreate(ShiftBase):
    business_id: int

class ShiftResponse(ShiftBase):
    id: int
    business_id: int
    status: str
    created_at: datetime
    assignments: List[Dict[str, Any]] = []
    
    class Config:
        from_attributes = True

class ShiftAssignmentBase(BaseModel):
    shift_id: int
    staff_id: int

class ShiftAssignmentCreate(ShiftAssignmentBase):
    pass

class ShiftAssignmentResponse(ShiftAssignmentBase):
    id: int
    status: str
    assigned_at: datetime
    confirmed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class SickLeaveRequestBase(BaseModel):
    shift_id: int
    reason: str = "sick"
    message: Optional[str] = None

class SickLeaveRequestCreate(SickLeaveRequestBase):
    staff_id: int
    business_id: int

class SickLeaveRequestResponse(SickLeaveRequestBase):
    id: int
    staff_id: int
    business_id: int
    reported_at: datetime
    replacement_found: bool
    replacement_staff_id: Optional[int] = None
    
    class Config:
        from_attributes = True

# Calendar Schemas
class CalendarView(BaseModel):
    date: str
    shifts: List[ShiftResponse]
    total_shifts: int
    filled_shifts: int
    understaffed_shifts: int

class WeeklySchedule(BaseModel):
    week_start: datetime
    week_end: datetime
    days: List[CalendarView]
    staff_hours: Dict[str, float]  # staff_name -> total_hours

# Analytics Schemas
class StaffReliabilityResponse(BaseModel):
    staff_id: int
    name: str
    reliability_score: float
    total_requests: int
    accepted: int
    declined: int
    acceptance_rate: float
    recent_responses: List[ShiftCoverageResponse]

class BusinessAnalytics(BaseModel):
    business_id: int
    total_staff: int
    active_staff: int
    total_emergency_requests: int
    filled_requests: int
    average_response_time: float
    top_reliable_staff: List[Dict[str, Any]]
    coverage_success_rate: float

# Auto-Schedule Schemas
class SpecialEvent(BaseModel):
    date: str
    name: str
    expected_impact: str  # low, medium, high
    description: Optional[str] = None

class StaffNote(BaseModel):
    staff_id: int
    note: str
    date: Optional[str] = None

class AutoScheduleRequest(BaseModel):
    date_range_start: str
    date_range_end: str
    special_events: List[SpecialEvent] = []
    staff_notes: List[StaffNote] = []
    constraints: Dict[str, Any] = {}

class DraftShiftAssignmentResponse(BaseModel):
    id: int
    shift_id: int
    staff_id: int
    staff_name: str
    confidence_score: float
    reasoning: Optional[str] = None
    is_ai_generated: bool
    manual_override: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class ScheduleDraftResponse(BaseModel):
    id: str
    business_id: int
    created_by: int
    date_range_start: str
    date_range_end: str
    status: str
    ai_generated: bool
    confidence_score: Optional[float] = None
    created_at: datetime
    published_at: Optional[datetime] = None
    assignments: List[DraftShiftAssignmentResponse] = []
    
    class Config:
        from_attributes = True

class AutoScheduleResponse(BaseModel):
    draft_id: str
    total_shifts: int
    assigned_shifts: int
    unassigned_shifts: int
    overall_confidence: float
    generation_summary: Dict[str, Any]
    warnings: List[str] = []
    recommendations: List[str] = []

class ScheduleChange(BaseModel):
    assignment_id: Optional[int] = None
    shift_id: int
    staff_id: Optional[int] = None
    action: str  # assign, unassign, modify
    reasoning: Optional[str] = None

class NotificationSettings(BaseModel):
    notify_all_staff: bool = True
    channels: List[str] = ["whatsapp", "sms", "email"]
    custom_message: Optional[str] = None
    retry_failed_notifications: bool = True
    notification_priority: str = "medium"  # low, medium, high
    delivery_confirmation: bool = False
    max_retry_attempts: int = 3

class PublishResponse(BaseModel):
    success: bool
    published_at: datetime
    notifications_sent: int
    failed_notifications: int
    message: str
# Notification Service Schemas
class NotificationChannel(BaseModel):
    channel: str  # whatsapp, sms, email

class NotificationStatus(BaseModel):
    id: int
    draft_id: str
    staff_id: int
    staff_name: str
    notification_type: str
    channel: str
    status: str  # pending, sent, delivered, failed, retrying
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    retry_count: int = 0
    error_message: Optional[str] = None
    external_id: Optional[str] = None

class NotificationStatusResponse(BaseModel):
    notifications: List[NotificationStatus]
    summary: Dict[str, int]  # status counts
    total_notifications: int
    success_rate: float
    enabled: bool = True
    priority: int = 1  # Lower number = higher priority

class NotificationPreferences(BaseModel):
    staff_id: int
    channels: List[NotificationChannel]
    quiet_hours_start: Optional[str] = None  # "22:00"
    quiet_hours_end: Optional[str] = None    # "08:00"
    timezone: str = "UTC"

class ScheduleNotificationRequest(BaseModel):
    draft_id: str
    notification_type: str  # new_schedule, schedule_change
    channels: List[str] = ["whatsapp", "sms", "email"]
    custom_message: Optional[str] = None
    notify_all_staff: bool = True
    staff_ids: Optional[List[int]] = None  # If not notifying all staff

class ScheduleNotificationResponse(BaseModel):
    id: int
    draft_id: str
    staff_id: int
    staff_name: str
    notification_type: str
    channel: str
    content: str
    status: str
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    external_id: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class NotificationStatusSummaryResponse(BaseModel):
    draft_id: str
    total_notifications: int
    status_summary: Dict[str, int]  # {"sent": 5, "failed": 1, "pending": 2}
    channel_summary: Dict[str, int]  # {"whatsapp": 4, "sms": 3, "email": 1}
    notifications: List[ScheduleNotificationResponse]

class NotificationDeliveryResult(BaseModel):
    staff_id: int
    staff_name: str
    channels: List[Dict[str, Any]]  # Results for each channel attempted
    success: bool
    primary_channel: Optional[str] = None

class BulkNotificationResponse(BaseModel):
    success: bool
    notifications_sent: int
    failed_notifications: int
    total_staff: int
    results: List[NotificationDeliveryResult]
    message: str
    error: Optional[str] = None

class NotificationRetryRequest(BaseModel):
    draft_id: str
    channels: Optional[List[str]] = None  # If None, retry all failed
    staff_ids: Optional[List[int]] = None  # If None, retry all failed

class NotificationRetryResponse(BaseModel):
    success: bool
    retried: int
    successful_retries: int
    message: str
    error: Optional[str] = None

class ChangeNotificationRequest(BaseModel):
    draft_id: str
    changes: List[ScheduleChange]
    notification_settings: NotificationSettings

class MessageTemplate(BaseModel):
    name: str
    content: str
    variables: List[str]
    message_type: str  # schedule, change, reminder, etc.

class MessageTemplateResponse(BaseModel):
    templates: List[MessageTemplate]
    message_type: str

# Staff Preference Schemas
class StaffPreferenceBase(BaseModel):
    preference_type: str  # shift_time, day_off, max_hours, min_hours, consecutive_days_off
    preference_value: Dict[str, Any]
    priority: str = "medium"  # low, medium, high
    effective_date: Optional[str] = None
    expiry_date: Optional[str] = None

class StaffPreferenceCreate(StaffPreferenceBase):
    staff_id: int

class StaffPreferenceUpdate(BaseModel):
    preference_value: Optional[Dict[str, Any]] = None
    priority: Optional[str] = None
    effective_date: Optional[str] = None
    expiry_date: Optional[str] = None
    is_active: Optional[bool] = None

class StaffPreferenceResponse(StaffPreferenceBase):
    id: int
    staff_id: int
    staff_name: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Scheduling Constraint Schemas
class SchedulingConstraintBase(BaseModel):
    constraint_type: str  # max_hours_per_week, min_rest_between_shifts, skill_match_required, max_consecutive_days
    constraint_value: Dict[str, Any]
    priority: str = "medium"  # low, medium, high, critical

class SchedulingConstraintCreate(SchedulingConstraintBase):
    business_id: int

class SchedulingConstraintUpdate(BaseModel):
    constraint_value: Optional[Dict[str, Any]] = None
    priority: Optional[str] = None
    is_active: Optional[bool] = None

class SchedulingConstraintResponse(SchedulingConstraintBase):
    id: int
    business_id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Constraint Validation Schemas
class ConstraintViolation(BaseModel):
    constraint_id: int
    constraint_type: str
    violation_type: str
    severity: str  # warning, error, critical
    message: str
    affected_staff_id: Optional[int] = None
    affected_shift_id: Optional[int] = None
    suggested_resolution: Optional[str] = None

class ConstraintValidationRequest(BaseModel):
    business_id: int
    draft_id: Optional[str] = None
    assignments: List[Dict[str, Any]]  # List of shift assignments to validate

class ConstraintValidationResponse(BaseModel):
    valid: bool
    violations: List[ConstraintViolation]
    warnings: List[ConstraintViolation]
    total_violations: int
    total_warnings: int

# Preference Management Schemas
class StaffAvailabilityPreference(BaseModel):
    day_of_week: int  # 0=Monday, 6=Sunday
    available_times: List[Dict[str, str]]  # [{"start": "09:00", "end": "17:00"}]
    unavailable_times: List[Dict[str, str]] = []
    preferred: bool = True  # True for preferred times, False for available but not preferred

class TimeOffRequest(BaseModel):
    staff_id: int
    start_date: str
    end_date: str
    reason: str
    is_recurring: bool = False
    recurrence_pattern: Optional[Dict[str, Any]] = None

class PreferenceConflictResponse(BaseModel):
    has_conflicts: bool
    conflicts: List[Dict[str, Any]]
    suggestions: List[str]

# SumUp POS Integration Schemas (Paid Bolt-On)
class SumUpIntegrationBase(BaseModel):
    is_enabled: bool = False
    is_entitled: bool = False
    sync_frequency_hours: int = 1

class SumUpIntegrationCreate(SumUpIntegrationBase):
    business_id: int

class SumUpIntegrationUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    sync_frequency_hours: Optional[int] = None

class SumUpIntegrationResponse(SumUpIntegrationBase):
    id: int
    business_id: int
    merchant_id: Optional[str] = None
    last_sync_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class SumUpLocationBase(BaseModel):
    sumup_location_id: str
    sumup_location_name: str
    localops_location_id: Optional[int] = None

class SumUpLocationCreate(SumUpLocationBase):
    business_id: int

class SumUpLocationResponse(SumUpLocationBase):
    id: int
    business_id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class SalesDataBase(BaseModel):
    sumup_transaction_id: str
    sumup_location_id: str
    sale_time: datetime
    sale_value: float
    payment_type: Optional[str] = None
    items: Optional[List[Dict[str, Any]]] = None
    customer_count: int = 1
    tip_amount: float = 0
    discount_amount: float = 0
    tax_amount: float = 0

class SalesDataCreate(SalesDataBase):
    business_id: int
    staff_id: Optional[int] = None
    shift_id: Optional[int] = None

class SalesDataResponse(SalesDataBase):
    id: int
    business_id: int
    staff_id: Optional[int] = None
    shift_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class SalesItemBase(BaseModel):
    item_sku: Optional[str] = None
    item_name: str
    quantity: float
    unit_price: float
    total_price: float
    category: Optional[str] = None

class SalesItemCreate(SalesItemBase):
    sale_id: int

class SalesItemResponse(SalesItemBase):
    id: int
    sale_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class IntegrationLogBase(BaseModel):
    integration_type: str
    operation: str
    status: str
    message: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None

class IntegrationLogCreate(IntegrationLogBase):
    business_id: int

class IntegrationLogResponse(IntegrationLogBase):
    id: int
    business_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class SalesAnalyticsBase(BaseModel):
    location_id: Optional[int] = None
    date: str
    hour: int
    total_sales: float = 0
    transaction_count: int = 0
    average_transaction_value: float = 0
    customer_count: int = 0
    top_selling_items: Optional[List[Dict[str, Any]]] = None
    peak_hour: bool = False

class SalesAnalyticsCreate(SalesAnalyticsBase):
    business_id: int

class SalesAnalyticsResponse(SalesAnalyticsBase):
    id: int
    business_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class StaffSalesPerformanceBase(BaseModel):
    date: str
    total_sales: float = 0
    transaction_count: int = 0
    average_transaction_value: float = 0
    customer_count: int = 0
    items_sold: int = 0
    performance_score: Optional[float] = None

class StaffSalesPerformanceCreate(StaffSalesPerformanceBase):
    staff_id: int
    business_id: int

class StaffSalesPerformanceResponse(StaffSalesPerformanceBase):
    id: int
    staff_id: int
    business_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class BoltOnSubscriptionBase(BaseModel):
    bolt_on_type: str
    subscription_status: str
    start_date: str
    end_date: Optional[str] = None
    monthly_price: Optional[float] = None
    features_enabled: Optional[List[str]] = None

class BoltOnSubscriptionCreate(BoltOnSubscriptionBase):
    business_id: int

class BoltOnSubscriptionResponse(BoltOnSubscriptionBase):
    id: int
    business_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class SumUpOAuthRequest(BaseModel):
    business_id: int
    authorization_code: str
    redirect_uri: str

class SumUpOAuthResponse(BaseModel):
    success: bool
    message: str
    integration_id: Optional[int] = None
    error: Optional[str] = None

class SumUpSyncRequest(BaseModel):
    business_id: int
    force_sync: bool = False
    sync_from_date: Optional[str] = None

class SumUpSyncResponse(BaseModel):
    success: bool
    message: str
    transactions_synced: int = 0
    errors: List[str] = []
    sync_duration_seconds: float = 0

class SumUpDisconnectRequest(BaseModel):
    business_id: int
    revoke_tokens: bool = True

class SumUpDisconnectResponse(BaseModel):
    success: bool
    message: str
    tokens_revoked: bool = False

class SumUpStatusResponse(BaseModel):
    is_connected: bool
    is_entitled: bool
    last_sync_at: Optional[datetime] = None
    sync_frequency_hours: int
    merchant_id: Optional[str] = None
    location_count: int = 0
    total_transactions: int = 0
    last_7_days_sales: float = 0
    connection_status: str  # connected, disconnected, expired, error
    error_message: Optional[str] = None

class SumUpUpgradePrompt(BaseModel):
    show_upgrade: bool
    current_plan: str
    required_plan: str
    bolt_on_price: float
    features_unlocked: List[str]
    upgrade_url: Optional[str] = None

# Bolt-On Management Schemas
class BoltOnManagementBase(BaseModel):
    bolt_on_type: str
    is_platform_enabled: bool = True
    monthly_price: float = 29.99
    required_plan: str = "professional"
    description: Optional[str] = None
    features: Optional[List[str]] = None

class BoltOnManagementCreate(BoltOnManagementBase):
    pass

class BoltOnManagementUpdate(BaseModel):
    is_platform_enabled: Optional[bool] = None
    monthly_price: Optional[float] = None
    required_plan: Optional[str] = None
    description: Optional[str] = None
    features: Optional[List[str]] = None

class BoltOnManagementResponse(BoltOnManagementBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class BoltOnAuditLogBase(BaseModel):
    business_id: int
    bolt_on_type: str
    action: str
    performed_by: int
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None

class BoltOnAuditLogCreate(BoltOnAuditLogBase):
    pass

class BoltOnAuditLogResponse(BoltOnAuditLogBase):
    id: int
    created_at: datetime
    performer_name: Optional[str] = None
    business_name: Optional[str] = None
    
    class Config:
        from_attributes = True

# Admin Dashboard Schemas
class BusinessBoltOnStatus(BaseModel):
    business_id: int
    business_name: str
    subscription_tier: str
    bolt_on_type: str
    is_enabled: bool
    is_entitled: bool
    last_sync_at: Optional[datetime] = None
    usage_30d: Optional[float] = None  # Sales amount in last 30 days
    connection_status: str  # active, inactive, error
    error_message: Optional[str] = None

class BoltOnAdminDashboard(BaseModel):
    bolt_on_type: str
    platform_enabled: bool
    monthly_price: float
    total_businesses: int
    active_subscriptions: int
    total_revenue: float
    businesses: List[BusinessBoltOnStatus]

class BoltOnToggleRequest(BaseModel):
    business_id: int
    bolt_on_type: str
    enable: bool
    reason: Optional[str] = None

class BoltOnToggleResponse(BaseModel):
    success: bool
    message: str
    new_status: bool
    audit_log_id: int

class BoltOnBulkActionRequest(BaseModel):
    bolt_on_type: str
    action: str  # enable_all, disable_all, enable_for_plan, disable_for_plan
    target_plan: Optional[str] = None  # For plan-specific actions
    reason: Optional[str] = None

class BoltOnBulkActionResponse(BaseModel):
    success: bool
    message: str
    affected_businesses: int
    audit_log_ids: List[int]

class BoltOnUsageAnalytics(BaseModel):
    business_id: int
    business_name: str
    period: str  # "7d", "30d", "90d"
    total_sales: float
    transaction_count: int
    average_transaction: float
    peak_hours: List[Dict[str, Any]]
    top_items: List[Dict[str, Any]]
    sync_errors: int
    last_sync_success: bool