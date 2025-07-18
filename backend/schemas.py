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

class PublishResponse(BaseModel):
    success: bool
    published_at: datetime
    notifications_sent: int
    failed_notifications: int
    message: str
# Notification Service Schemas
class NotificationChannel(BaseModel):
    channel: str  # whatsapp, sms, email
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

class NotificationStatusResponse(BaseModel):
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