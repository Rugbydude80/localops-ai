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