from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, Text, JSON, ForeignKey, Date
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import uuid

# User Role and Permission Models
class UserRole(Base):
    __tablename__ = "user_roles"
    
    id = Column(Integer, primary_key=True, index=True)
    role_name = Column(String(50), unique=True, nullable=False)
    role_level = Column(Integer, nullable=False)  # Higher number = more permissions
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

class RolePermission(Base):
    __tablename__ = "role_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    role_name = Column(String(50), ForeignKey("user_roles.role_name"), nullable=False)
    permission_name = Column(String(100), nullable=False)
    permission_value = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)

class ShiftAssignmentAudit(Base):
    __tablename__ = "shift_assignment_audit"
    
    id = Column(Integer, primary_key=True, index=True)
    shift_id = Column(Integer, ForeignKey("shifts.id"))
    staff_id = Column(Integer, ForeignKey("staff.id"))
    action = Column(String(50), nullable=False)  # 'assigned', 'unassigned', 'modified'
    performed_by = Column(Integer, ForeignKey("staff.id"))
    old_status = Column(String(50))
    new_status = Column(String(50))
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

class Business(Base):
    __tablename__ = "businesses"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String)  # restaurant, cafe, pub, etc.
    phone_number = Column(String)
    email = Column(String)
    address = Column(Text)
    owner_name = Column(String)
    subscription_tier = Column(String, default="starter")  # starter, professional, enterprise
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    staff = relationship("Staff", back_populates="business")
    emergency_requests = relationship("EmergencyRequest", back_populates="business")
    shifts = relationship("Shift", back_populates="business")

class Staff(Base):
    __tablename__ = "staff"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    name = Column(String, nullable=False)
    phone_number = Column(String, nullable=False)
    email = Column(String)
    role = Column(String, nullable=False)  # manager, chef, server, bartender, etc.
    user_role = Column(String, ForeignKey("user_roles.role_name"), default="staff")  # superadmin, admin, manager, supervisor, staff
    skills = Column(JSON)  # ["kitchen", "bar", "front_of_house", "management"]
    availability = Column(JSON)  # {"monday": ["09:00-17:00"], "tuesday": ["18:00-23:00"]}
    reliability_score = Column(Float, default=5.0)  # 1-10 scale
    is_active = Column(Boolean, default=True)
    hired_date = Column(DateTime, default=datetime.now)
    last_shift_date = Column(DateTime)
    
    # Permission flags
    can_assign_shifts = Column(Boolean, default=False)
    can_manage_staff = Column(Boolean, default=False)
    can_view_all_shifts = Column(Boolean, default=False)
    department = Column(String)
    reports_to = Column(Integer, ForeignKey("staff.id"))
    
    # Relationships
    business = relationship("Business", back_populates="staff")
    shift_responses = relationship("ShiftCoverage", back_populates="staff")
    shift_assignments = relationship("ShiftAssignment", back_populates="staff")

class EmergencyRequest(Base):
    __tablename__ = "emergency_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    shift_date = Column(DateTime, nullable=False)
    shift_start = Column(String, nullable=False)  # "09:00"
    shift_end = Column(String, nullable=False)    # "17:00"
    required_skill = Column(String, nullable=False)  # "kitchen", "bar", etc.
    urgency = Column(String, default="normal")  # "low", "normal", "high", "critical"
    message = Column(Text)  # Custom message from manager
    status = Column(String, default="pending")  # "pending", "filled", "expired"
    filled_by = Column(Integer, ForeignKey("staff.id"))
    filled_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now)
    expires_at = Column(DateTime)
    
    # Relationships
    business = relationship("Business", back_populates="emergency_requests")
    responses = relationship("ShiftCoverage", back_populates="request")

class ShiftCoverage(Base):
    __tablename__ = "shift_coverage"
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("emergency_requests.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    response = Column(String, nullable=False)  # "accept", "decline", "maybe"
    response_time_minutes = Column(Integer)  # How quickly they responded
    responded_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    request = relationship("EmergencyRequest", back_populates="responses")
    staff = relationship("Staff", back_populates="shift_responses")

class MessageLog(Base):
    __tablename__ = "message_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"))
    staff_id = Column(Integer, ForeignKey("staff.id"))
    request_id = Column(Integer, ForeignKey("emergency_requests.id"))
    message_type = Column(String)  # "emergency_request", "reminder", "confirmation"
    platform = Column(String)  # "whatsapp", "sms", "email"
    phone_number = Column(String)
    message_content = Column(Text)
    external_message_id = Column(String)  # WhatsApp message ID
    status = Column(String)  # "sent", "delivered", "read", "failed"
    sent_at = Column(DateTime, default=datetime.now)
    delivered_at = Column(DateTime)
    read_at = Column(DateTime)

class Shift(Base):
    __tablename__ = "shifts"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    title = Column(String, nullable=False)  # "Morning Kitchen", "Evening Bar", etc.
    date = Column(DateTime, nullable=False)
    start_time = Column(String, nullable=False)  # "09:00"
    end_time = Column(String, nullable=False)    # "17:00"
    required_skill = Column(String, nullable=False)  # "kitchen", "bar", "front_of_house"
    required_staff_count = Column(Integer, default=1)
    hourly_rate = Column(Float)  # Optional pay rate
    notes = Column(Text)
    status = Column(String, default="scheduled")  # "scheduled", "filled", "understaffed", "cancelled"
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    business = relationship("Business", back_populates="shifts")
    assignments = relationship("ShiftAssignment", back_populates="shift")

class ShiftAssignment(Base):
    __tablename__ = "shift_assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    status = Column(String, default="assigned")  # "assigned", "confirmed", "called_in_sick", "no_show"
    assigned_at = Column(DateTime, default=datetime.now)
    confirmed_at = Column(DateTime)
    
    # Relationships
    shift = relationship("Shift", back_populates="assignments")
    staff = relationship("Staff", back_populates="shift_assignments")

class SickLeaveRequest(Base):
    __tablename__ = "sick_leave_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    reason = Column(String, default="sick")  # "sick", "emergency", "family"
    message = Column(Text)
    reported_at = Column(DateTime, default=datetime.now)
    replacement_found = Column(Boolean, default=False)
    replacement_staff_id = Column(Integer, ForeignKey("staff.id"))
    
    # Relationships
    staff = relationship("Staff", foreign_keys=[staff_id])
    replacement_staff = relationship("Staff", foreign_keys=[replacement_staff_id])
    shift = relationship("Shift")
    business = relationship("Business")

class TrainingRecord(Base):
    __tablename__ = "training_records"
    
    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    training_type = Column(String, nullable=False)  # "food_safety", "bar_training", etc.
    certification_name = Column(String)
    completed_date = Column(DateTime)
    expiry_date = Column(DateTime)
    certificate_url = Column(String)  # Link to certificate document
    is_valid = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)

# Feature 1: AI-Powered Predictive Scheduling
class DemandPrediction(Base):
    __tablename__ = "demand_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    prediction_date = Column(Date, nullable=False)
    hour = Column(Integer, nullable=False)  # 0-23
    predicted_demand = Column(Float, nullable=False)  # 0-100 scale
    confidence_score = Column(Float, default=0.8)
    factors = Column(JSON)  # {"weather": "rain", "events": ["football_match"], "historical": 85}
    actual_demand = Column(Float)  # Filled after the fact for learning
    created_at = Column(DateTime, default=datetime.now)

class ScheduleTemplate(Base):
    __tablename__ = "schedule_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    name = Column(String, nullable=False)  # "Busy Saturday", "Quiet Monday"
    day_of_week = Column(Integer)  # 0=Monday, 6=Sunday
    shifts_config = Column(JSON)  # Template shift configuration
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)

# Feature 2: Smart Staff Communication Hub
class SmartMessage(Base):
    __tablename__ = "smart_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("staff.id"))
    message_type = Column(String, nullable=False)  # "shift_cover", "training", "announcement"
    subject = Column(String)
    content = Column(Text, nullable=False)
    target_filters = Column(JSON)  # {"skills": ["kitchen"], "availability": "available"}
    priority = Column(String, default="normal")  # "low", "normal", "high", "urgent"
    delivery_channels = Column(JSON)  # ["whatsapp", "sms", "email", "push"]
    scheduled_for = Column(DateTime)
    status = Column(String, default="draft")  # "draft", "scheduled", "sent", "delivered"
    created_at = Column(DateTime, default=datetime.now)

class MessageDelivery(Base):
    __tablename__ = "message_deliveries"
    
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("smart_messages.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    channel = Column(String, nullable=False)  # "whatsapp", "sms", "email", "push"
    status = Column(String, default="pending")  # "pending", "sent", "delivered", "read", "failed"
    sent_at = Column(DateTime)
    delivered_at = Column(DateTime)
    read_at = Column(DateTime)
    response = Column(Text)  # Staff response if applicable
    external_id = Column(String)  # External service message ID

# Feature 3: Digital Training & Certification Manager
class TrainingModule(Base):
    __tablename__ = "training_modules"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    video_url = Column(String(500))
    duration_minutes = Column(Integer)
    required_for_skills = Column(JSON)  # ["kitchen", "bar"]
    compliance_requirement = Column(Boolean, default=False)
    quiz_questions = Column(JSON)  # Quiz data
    passing_score = Column(Integer, default=80)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)

class StaffTrainingProgress(Base):
    __tablename__ = "staff_training_progress"
    
    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    module_id = Column(Integer, ForeignKey("training_modules.id"), nullable=False)
    status = Column(String, default="not_started")  # "not_started", "in_progress", "completed", "expired"
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    score = Column(Integer)  # Percentage score
    certificate_url = Column(String(500))
    expires_at = Column(DateTime)
    attempts = Column(Integer, default=0)

class SkillCertification(Base):
    __tablename__ = "skill_certifications"
    
    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    skill_name = Column(String(100), nullable=False)
    level = Column(String(20), default="basic")  # "basic", "intermediate", "advanced"
    certified_date = Column(Date, nullable=False)
    expires_date = Column(Date)
    certifying_module_id = Column(Integer, ForeignKey("training_modules.id"))
    is_active = Column(Boolean, default=True)

# Feature 4: Real-Time Business Intelligence Dashboard
class BusinessMetric(Base):
    __tablename__ = "business_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    metric_date = Column(Date, nullable=False)
    hour = Column(Integer)  # For hourly metrics
    labour_cost_percentage = Column(Float)
    staff_utilisation = Column(Float)
    shift_coverage_rate = Column(Float)
    revenue_per_hour = Column(Float)
    customer_wait_time = Column(Float)
    staff_punctuality_rate = Column(Float)
    sick_leave_rate = Column(Float)
    raw_data = Column(JSON)  # Additional metric data
    created_at = Column(DateTime, default=datetime.now)

class KPITarget(Base):
    __tablename__ = "kpi_targets"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    metric_name = Column(String, nullable=False)
    target_value = Column(Float, nullable=False)
    comparison_type = Column(String, default="less_than")  # "less_than", "greater_than", "equals"
    is_active = Column(Boolean, default=True)

# Feature 5: Intelligent Inventory Management
class InventoryItem(Base):
    __tablename__ = "inventory_items"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    name = Column(String, nullable=False)
    category = Column(String)  # "produce", "meat", "dairy", "dry_goods"
    unit = Column(String, default="kg")  # "kg", "liters", "pieces"
    current_stock = Column(Float, default=0)
    minimum_stock = Column(Float, default=0)
    maximum_stock = Column(Float)
    cost_per_unit = Column(Float)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    expiry_tracking = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

class Supplier(Base):
    __tablename__ = "suppliers"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    name = Column(String, nullable=False)
    contact_person = Column(String)
    phone = Column(String)
    email = Column(String)
    categories = Column(JSON)  # ["produce", "meat"]
    reliability_score = Column(Float, default=5.0)
    average_delivery_days = Column(Integer, default=2)
    is_preferred = Column(Boolean, default=False)

class InventoryPrediction(Base):
    __tablename__ = "inventory_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    prediction_date = Column(Date, nullable=False)
    predicted_usage = Column(Float)
    reorder_recommendation = Column(Float)
    urgency_level = Column(String, default="normal")  # "low", "normal", "high", "critical"
    factors = Column(JSON)  # Prediction factors
    created_at = Column(DateTime, default=datetime.now)

# Feature 6: Multi-Location Coordination Hub
class Location(Base):
    __tablename__ = "locations"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    name = Column(String, nullable=False)
    address = Column(Text)
    manager_id = Column(Integer, ForeignKey("staff.id"))
    phone = Column(String)
    is_active = Column(Boolean, default=True)
    coordinates = Column(JSON)  # {"lat": 51.5074, "lng": -0.1278}

class StaffTransfer(Base):
    __tablename__ = "staff_transfers"
    
    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    from_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    to_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    transfer_date = Column(Date, nullable=False)
    transfer_type = Column(String, default="temporary")  # "temporary", "permanent"
    reason = Column(Text)
    status = Column(String, default="pending")  # "pending", "approved", "completed", "cancelled"
    requested_by = Column(Integer, ForeignKey("staff.id"))
    approved_by = Column(Integer, ForeignKey("staff.id"))
    created_at = Column(DateTime, default=datetime.now)

class InventoryTransfer(Base):
    __tablename__ = "inventory_transfers"
    
    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    from_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    to_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    reason = Column(Text)
    status = Column(String, default="pending")  # "pending", "in_transit", "completed", "cancelled"
    requested_by = Column(Integer, ForeignKey("staff.id"))
    created_at = Column(DateTime, default=datetime.now)

# Feature 7: Emergency Response Automation
class EmergencyProtocol(Base):
    __tablename__ = "emergency_protocols"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    emergency_type = Column(String, nullable=False)  # "equipment_failure", "staff_shortage", "health_incident"
    protocol_name = Column(String, nullable=False)
    automated_actions = Column(JSON)  # List of automated actions
    notification_list = Column(JSON)  # Staff/contacts to notify
    escalation_rules = Column(JSON)  # When to escalate
    is_active = Column(Boolean, default=True)

class EmergencyIncident(Base):
    __tablename__ = "emergency_incidents"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"))
    emergency_type = Column(String, nullable=False)
    severity = Column(String, default="medium")  # "low", "medium", "high", "critical"
    description = Column(Text, nullable=False)
    reported_by = Column(Integer, ForeignKey("staff.id"))
    protocol_id = Column(Integer, ForeignKey("emergency_protocols.id"))
    status = Column(String, default="active")  # "active", "resolved", "escalated"
    actions_taken = Column(JSON)  # Log of actions taken
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now)

# Feature 8: Customer Experience Integration
class CustomerReview(Base):
    __tablename__ = "customer_reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"))
    platform = Column(String, nullable=False)  # "google", "tripadvisor", "facebook"
    rating = Column(Float, nullable=False)  # 1-5 scale
    review_text = Column(Text)
    reviewer_name = Column(String)
    review_date = Column(DateTime, nullable=False)
    sentiment_score = Column(Float)  # -1 to 1
    mentioned_staff = Column(JSON)  # Staff mentioned in review
    service_aspects = Column(JSON)  # {"food": 4, "service": 5, "atmosphere": 3}
    response_generated = Column(Boolean, default=False)
    external_id = Column(String)  # Platform-specific review ID

class ServiceMetric(Base):
    __tablename__ = "service_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"))
    metric_date = Column(Date, nullable=False)
    hour = Column(Integer)  # For hourly tracking
    average_wait_time = Column(Float)  # Minutes
    service_rating = Column(Float)  # 1-5 scale
    staff_performance_score = Column(Float)
    customer_satisfaction = Column(Float)
    table_turnover_rate = Column(Float)
    complaint_count = Column(Integer, default=0)
    compliment_count = Column(Integer, default=0)

class StaffPerformanceMetric(Base):
    __tablename__ = "staff_performance_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    metric_date = Column(Date, nullable=False)
    customer_rating = Column(Float)  # Average rating from reviews
    punctuality_score = Column(Float)
    reliability_score = Column(Float)
    customer_mentions = Column(Integer, default=0)  # Times mentioned in reviews
    positive_mentions = Column(Integer, default=0)
    negative_mentions = Column(Integer, default=0)
    training_completion_rate = Column(Float)
    skill_improvement_score = Column(Float)

# Auto-Scheduling System Models
class ScheduleDraft(Base):
    __tablename__ = "schedule_drafts"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("staff.id"), nullable=False)
    date_range_start = Column(Date, nullable=False, index=True)
    date_range_end = Column(Date, nullable=False, index=True)
    status = Column(String, default="draft", index=True)  # draft, published, archived
    ai_generated = Column(Boolean, default=False)
    generation_params = Column(JSON)  # Parameters used for AI generation
    confidence_score = Column(Float)  # Overall confidence in the schedule
    created_at = Column(DateTime, default=datetime.now, index=True)
    published_at = Column(DateTime)
    
    # Relationships
    business = relationship("Business")
    creator = relationship("Staff", foreign_keys=[created_by])
    draft_assignments = relationship("DraftShiftAssignment", back_populates="draft", cascade="all, delete-orphan")
    notifications = relationship("ScheduleNotification", back_populates="draft", cascade="all, delete-orphan")

class DraftShiftAssignment(Base):
    __tablename__ = "draft_shift_assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    draft_id = Column(String, ForeignKey("schedule_drafts.id"), nullable=False, index=True)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=False, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False, index=True)
    confidence_score = Column(Float, default=0.8)  # AI confidence in assignment
    reasoning = Column(Text)  # Human-readable explanation
    is_ai_generated = Column(Boolean, default=True)
    manual_override = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    draft = relationship("ScheduleDraft", back_populates="draft_assignments")
    shift = relationship("Shift")
    staff = relationship("Staff")

class SchedulingConstraint(Base):
    __tablename__ = "scheduling_constraints"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    constraint_type = Column(String, nullable=False, index=True)  # max_hours, min_rest, skill_match
    constraint_value = Column(JSON, nullable=False)  # Constraint parameters
    priority = Column(String, default="medium")  # low, medium, high, critical
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    business = relationship("Business")

class StaffPreference(Base):
    __tablename__ = "staff_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False, index=True)
    preference_type = Column(String, nullable=False, index=True)  # shift_time, day_off, max_hours
    preference_value = Column(JSON, nullable=False)
    priority = Column(String, default="medium")  # low, medium, high
    effective_date = Column(Date, index=True)
    expiry_date = Column(Date, index=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    staff = relationship("Staff")

class ScheduleNotification(Base):
    __tablename__ = "schedule_notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    draft_id = Column(String, ForeignKey("schedule_drafts.id"), nullable=False, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False, index=True)
    notification_type = Column(String, nullable=False, index=True)  # new_schedule, schedule_change
    channel = Column(String, nullable=False)  # whatsapp, sms, email
    content = Column(Text, nullable=False)
    status = Column(String, default="pending", index=True)  # pending, sent, delivered, failed, retrying
    sent_at = Column(DateTime, index=True)
    delivered_at = Column(DateTime)
    external_id = Column(String)  # External service message ID
    retry_count = Column(Integer, default=0)  # Number of retry attempts
    error_message = Column(Text)  # Last error message
    priority = Column(String, default="medium")  # low, medium, high
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    draft = relationship("ScheduleDraft", back_populates="notifications")
    staff = relationship("Staff")