from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import uvicorn
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import os
import json
import asyncio
import logging

from database import get_db, engine, Base
from models import (
    Business, Staff, EmergencyRequest, ShiftCoverage, Shift, ShiftAssignment, 
    SickLeaveRequest, MessageLog, ScheduleDraft, DraftShiftAssignment, 
    ScheduleNotification
)
from schemas import (
    StaffCreate, StaffResponse, EmergencyRequestCreate, 
    EmergencyRequestResponse, ShiftCoverageCreate, ShiftCreate, ShiftResponse,
    ShiftAssignmentCreate, ShiftAssignmentResponse, SickLeaveRequestCreate,
    SickLeaveRequestResponse, CalendarView, WeeklySchedule,
    AutoScheduleRequest, AutoScheduleResponse, ScheduleDraftResponse,
    DraftShiftAssignmentResponse, ScheduleChange, NotificationSettings,
    PublishResponse, StaffPreferenceCreate, StaffPreferenceUpdate, 
    StaffPreferenceResponse, SchedulingConstraintCreate, SchedulingConstraintUpdate,
    SchedulingConstraintResponse, ConstraintValidationRequest, ConstraintValidationResponse
)
from services.messaging import WhatsAppService
from services.ai import AIService
from services.predictive_scheduling import PredictiveScheduler
from services.smart_communication import SmartCommunicationHub
from services.training_manager import TrainingManager
from services.business_intelligence import BusinessIntelligenceService
from services.inventory_intelligence import InventoryIntelligence
from services.notification_service import NotificationService
from services.collaboration_service import collaboration_manager
from services.error_handler import error_handler, ErrorContext
from services.app_notification_service import AppNotificationService
from exceptions import (
    SchedulingException, AIServiceException, NotificationException,
    ConstraintViolationException, InsufficientStaffException, ExternalAPIException
)
from api_constraint_validation import router as constraint_router

# Create database tables if they don't exist (for local development)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="LocalOps AI",
    description="Restaurant Operations Management API",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://localops.ai"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()
whatsapp_service = WhatsAppService()
ai_service = AIService()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create logs directory if it doesn't exist
import os
os.makedirs("logs", exist_ok=True)

# Include constraint validation router
app.include_router(constraint_router)

# Global exception handler for scheduling exceptions
@app.exception_handler(SchedulingException)
async def scheduling_exception_handler(request: Request, exc: SchedulingException):
    """Handle all scheduling-related exceptions with user-friendly messages"""
    
    # Create error context from request
    error_context = ErrorContext(
        operation=f"{request.method} {request.url.path}",
        additional_data={
            "url": str(request.url),
            "method": request.method,
            "client_ip": request.client.host if request.client else None
        }
    )
    
    # Handle the error through our error handler
    error_result = await error_handler.handle_error(exc, error_context, enable_fallback=True)
    
    # Return user-friendly error response
    status_code = 400
    if exc.severity.value == "critical":
        status_code = 500
    elif exc.severity.value == "high":
        status_code = 422
    
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "severity": exc.severity.value,
                "category": exc.category.value,
                "recoverable": exc.recoverable,
                "recovery_suggestions": exc.recovery_suggestions,
                "error_id": error_result.get("error_id"),
                "timestamp": error_result.get("timestamp")
            },
            "recovery": error_result.get("recovery") if error_result.get("recovery") else None
        }
    )

# Global exception handler for unexpected errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions with graceful degradation"""
    
    # Don't handle HTTP exceptions - let FastAPI handle them
    if isinstance(exc, HTTPException):
        raise exc
    
    # Create error context
    error_context = ErrorContext(
        operation=f"{request.method} {request.url.path}",
        additional_data={
            "url": str(request.url),
            "method": request.method,
            "client_ip": request.client.host if request.client else None,
            "exception_type": type(exc).__name__
        }
    )
    
    # Log the unexpected error
    logger.error(f"Unexpected error in {request.method} {request.url.path}: {str(exc)}")
    
    # Handle through error handler
    error_result = await error_handler.handle_error(exc, error_context, enable_fallback=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Our team has been notified.",
                "severity": "high",
                "category": "system",
                "recoverable": True,
                "recovery_suggestions": [
                    "Try the operation again in a few moments",
                    "Contact support if the issue persists",
                    "Check the system status page for any ongoing issues"
                ],
                "error_id": error_result.get("error_id"),
                "timestamp": error_result.get("timestamp")
            },
            "recovery": error_result.get("recovery") if error_result.get("recovery") else None
        }
    )

# WebSocket Connection Manager for real-time schedule updates
class ScheduleConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, business_id: int, draft_id: str = None):
        await websocket.accept()
        key = f"{business_id}:{draft_id}" if draft_id else str(business_id)
        if key not in self.active_connections:
            self.active_connections[key] = []
        self.active_connections[key].append(websocket)
    
    def disconnect(self, websocket: WebSocket, business_id: int, draft_id: str = None):
        key = f"{business_id}:{draft_id}" if draft_id else str(business_id)
        if key in self.active_connections:
            self.active_connections[key].remove(websocket)
            if not self.active_connections[key]:
                del self.active_connections[key]
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)
    
    async def broadcast_to_business(self, message: dict, business_id: int, draft_id: str = None):
        key = f"{business_id}:{draft_id}" if draft_id else str(business_id)
        if key in self.active_connections:
            disconnected = []
            for connection in self.active_connections[key]:
                try:
                    await connection.send_text(json.dumps(message))
                except WebSocketDisconnect:
                    disconnected.append(connection)
            
            # Remove disconnected connections
            for connection in disconnected:
                self.active_connections[key].remove(connection)

schedule_manager = ScheduleConnectionManager()

async def broadcast_schedule_update(business_id: int, draft_id: str, update_data: dict):
    """Broadcast schedule updates to connected clients"""
    await schedule_manager.broadcast_to_business(update_data, business_id, draft_id)

@app.get("/")
async def root():
    return {"message": "LocalOps AI API", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now()}

# Staff Management Endpoints
@app.post("/api/staff", response_model=StaffResponse)
async def create_staff(
    staff: StaffCreate,
    db: Session = Depends(get_db)
):
    """Create new staff member with skills and contact info"""
    db_staff = Staff(
        business_id=staff.business_id,
        name=staff.name,
        phone_number=staff.phone_number,
        email=staff.email,
        role=staff.role,
        skills=staff.skills,
        availability=staff.availability,
        is_active=True,
        reliability_score=5.0  # Start with neutral score
    )
    db.add(db_staff)
    db.commit()
    db.refresh(db_staff)
    return db_staff

@app.get("/api/staff/{business_id}", response_model=List[StaffResponse])
async def get_staff(business_id: int, db: Session = Depends(get_db)):
    """Get all staff for a business"""
    staff = db.query(Staff).filter(
        Staff.business_id == business_id,
        Staff.is_active == True
    ).all()
    return staff

@app.get("/api/staff/{business_id}/by-skill/{skill}")
async def get_staff_by_skill(
    business_id: int, 
    skill: str, 
    db: Session = Depends(get_db)
):
    """Get staff members who have specific skill"""
    staff = db.query(Staff).filter(
        Staff.business_id == business_id,
        Staff.is_active == True,
        Staff.skills.contains([skill])
    ).all()
    return staff

# Emergency Coverage Endpoints
@app.post("/api/emergency-request", response_model=EmergencyRequestResponse)
async def create_emergency_request(
    request: EmergencyRequestCreate,
    db: Session = Depends(get_db)
):
    """Create emergency coverage request and send messages"""
    
    # Find qualified staff
    qualified_staff = db.query(Staff).filter(
        Staff.business_id == request.business_id,
        Staff.is_active == True,
        Staff.skills.contains([request.required_skill])
    ).all()
    
    if not qualified_staff:
        raise HTTPException(
            status_code=404, 
            detail=f"No staff found with skill: {request.required_skill}"
        )
    
    # Create emergency request record
    db_request = EmergencyRequest(
        business_id=request.business_id,
        shift_date=request.shift_date,
        shift_start=request.shift_start,
        shift_end=request.shift_end,
        required_skill=request.required_skill,
        urgency=request.urgency,
        message=request.message,
        status="pending",
        created_at=datetime.now()
    )
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    
    # Generate AI-powered message
    ai_message = await ai_service.generate_coverage_message(
        business_name=request.business_name,
        shift_date=request.shift_date,
        shift_start=request.shift_start,
        shift_end=request.shift_end,
        required_skill=request.required_skill,
        urgency=request.urgency,
        custom_message=request.message
    )
    
    # Send WhatsApp messages to qualified staff
    message_results = []
    for staff_member in qualified_staff:
        try:
            result = await whatsapp_service.send_coverage_request(
                phone_number=staff_member.phone_number,
                staff_name=staff_member.name,
                message=ai_message,
                request_id=db_request.id
            )
            message_results.append({
                "staff_id": staff_member.id,
                "staff_name": staff_member.name,
                "phone": staff_member.phone_number,
                "sent": result.get("success", False),
                "message_id": result.get("message_id")
            })
        except Exception as e:
            message_results.append({
                "staff_id": staff_member.id,
                "staff_name": staff_member.name,
                "phone": staff_member.phone_number,
                "sent": False,
                "error": str(e)
            })
    
    return {
        "request": db_request,
        "qualified_staff_count": len(qualified_staff),
        "messages_sent": len([r for r in message_results if r["sent"]]),
        "message_results": message_results
    }

@app.post("/api/shift-response")
async def respond_to_shift_request(
    request_id: int,
    staff_id: int,
    response: str,  # "accept", "decline", "maybe"
    db: Session = Depends(get_db)
):
    """Staff member responds to shift coverage request"""
    
    # Record the response
    coverage = ShiftCoverage(
        request_id=request_id,
        staff_id=staff_id,
        response=response,
        responded_at=datetime.now()
    )
    db.add(coverage)
    
    # Update staff reliability score
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if staff:
        if response == "accept":
            staff.reliability_score = min(10.0, staff.reliability_score + 0.2)
        elif response == "decline":
            staff.reliability_score = max(1.0, staff.reliability_score - 0.1)
    
    # If accepted, mark request as filled
    if response == "accept":
        emergency_request = db.query(EmergencyRequest).filter(
            EmergencyRequest.id == request_id
        ).first()
        if emergency_request:
            emergency_request.status = "filled"
            emergency_request.filled_by = staff_id
            emergency_request.filled_at = datetime.now()
    
    db.commit()
    
    return {"status": "success", "message": "Response recorded"}

@app.get("/api/emergency-requests/{business_id}")
async def get_emergency_requests(
    business_id: int,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get recent emergency requests for a business"""
    requests = db.query(EmergencyRequest).filter(
        EmergencyRequest.business_id == business_id
    ).order_by(EmergencyRequest.created_at.desc()).limit(limit).all()
    
    return requests

@app.get("/api/staff/{staff_id}/reliability")
async def get_staff_reliability(staff_id: int, db: Session = Depends(get_db)):
    """Get staff reliability metrics"""
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Get response history
    responses = db.query(ShiftCoverage).filter(
        ShiftCoverage.staff_id == staff_id
    ).order_by(ShiftCoverage.responded_at.desc()).limit(20).all()
    
    total_requests = len(responses)
    accepted = len([r for r in responses if r.response == "accept"])
    declined = len([r for r in responses if r.response == "decline"])
    
    return {
        "staff_id": staff_id,
        "name": staff.name,
        "reliability_score": staff.reliability_score,
        "total_requests": total_requests,
        "accepted": accepted,
        "declined": declined,
        "acceptance_rate": (accepted / total_requests * 100) if total_requests > 0 else 0,
        "recent_responses": responses[:10]
    }

# Shift Management Endpoints
@app.post("/api/schedule/{business_id}/shifts", response_model=ShiftResponse)
async def create_shift(
    business_id: int,
    shift: ShiftCreate,
    draft_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Create a new shift with optional draft schedule integration"""
    
    # Verify business exists
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Override business_id from path parameter
    shift.business_id = business_id
    
    # If draft_id provided, verify it exists and belongs to business
    if draft_id:
        draft = db.query(ScheduleDraft).filter(
            ScheduleDraft.id == draft_id,
            ScheduleDraft.business_id == business_id,
            ScheduleDraft.status == "draft"
        ).first()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft schedule not found or already published")
    
    db_shift = Shift(
        business_id=business_id,
        title=shift.title,
        date=shift.date,
        start_time=shift.start_time,
        end_time=shift.end_time,
        required_skill=shift.required_skill,
        required_staff_count=shift.required_staff_count,
        hourly_rate=shift.hourly_rate,
        notes=shift.notes,
        status="scheduled"
    )
    db.add(db_shift)
    db.commit()
    db.refresh(db_shift)
    
    # If this shift is part of a draft, broadcast the change
    if draft_id:
        await broadcast_schedule_update(business_id, draft_id, {
            "type": "shift_created",
            "shift_id": db_shift.id,
            "shift": {
                "id": db_shift.id,
                "title": db_shift.title,
                "date": db_shift.date.isoformat(),
                "start_time": db_shift.start_time,
                "end_time": db_shift.end_time,
                "required_skill": db_shift.required_skill,
                "required_staff_count": db_shift.required_staff_count,
                "status": db_shift.status
            }
        })
    
    return db_shift

@app.get("/api/shifts/{business_id}")
async def get_shifts(
    business_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get shifts for a business within date range"""
    query = db.query(Shift).filter(Shift.business_id == business_id)
    
    if start_date:
        query = query.filter(Shift.date >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Shift.date <= datetime.fromisoformat(end_date))
    
    shifts = query.order_by(Shift.date, Shift.start_time).all()
    
    # Include assignment details
    result = []
    for shift in shifts:
        assignments = db.query(ShiftAssignment).filter(
            ShiftAssignment.shift_id == shift.id
        ).all()
        
        shift_data = {
            "id": shift.id,
            "business_id": shift.business_id,
            "title": shift.title,
            "date": shift.date,
            "start_time": shift.start_time,
            "end_time": shift.end_time,
            "required_skill": shift.required_skill,
            "required_staff_count": shift.required_staff_count,
            "hourly_rate": shift.hourly_rate,
            "notes": shift.notes,
            "status": shift.status,
            "created_at": shift.created_at,
            "assignments": []
        }
        
        for assignment in assignments:
            staff = db.query(Staff).filter(Staff.id == assignment.staff_id).first()
            if staff:
                shift_data["assignments"].append({
                    "id": assignment.id,
                    "staff_id": assignment.staff_id,
                    "staff_name": staff.name,
                    "status": assignment.status,
                    "assigned_at": assignment.assigned_at,
                    "confirmed_at": assignment.confirmed_at
                })
        
        result.append(shift_data)
    
    return result

@app.post("/api/schedule/{business_id}/shifts/{shift_id}/assign", response_model=ShiftAssignmentResponse)
async def assign_staff_to_shift(
    business_id: int,
    shift_id: int,
    assignment: ShiftAssignmentCreate,
    draft_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Enhanced staff assignment with draft schedule support and real-time updates"""
    
    # Check if shift exists and belongs to business
    shift = db.query(Shift).filter(
        Shift.id == shift_id,
        Shift.business_id == business_id
    ).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    # Check if staff exists and has required skill
    staff = db.query(Staff).filter(
        Staff.id == assignment.staff_id,
        Staff.business_id == business_id
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    if shift.required_skill not in staff.skills:
        raise HTTPException(
            status_code=400, 
            detail=f"Staff member does not have required skill: {shift.required_skill}"
        )
    
    # If working with a draft, handle draft assignment
    if draft_id:
        # Verify draft exists
        draft = db.query(ScheduleDraft).filter(
            ScheduleDraft.id == draft_id,
            ScheduleDraft.business_id == business_id,
            ScheduleDraft.status == "draft"
        ).first()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft schedule not found")
        
        # Check if already assigned in draft
        existing_draft = db.query(DraftShiftAssignment).filter(
            DraftShiftAssignment.draft_id == draft_id,
            DraftShiftAssignment.shift_id == shift_id,
            DraftShiftAssignment.staff_id == assignment.staff_id
        ).first()
        
        if existing_draft:
            raise HTTPException(status_code=400, detail="Staff already assigned to this shift in draft")
        
        # Create draft assignment
        draft_assignment = DraftShiftAssignment(
            draft_id=draft_id,
            shift_id=shift_id,
            staff_id=assignment.staff_id,
            confidence_score=0.8,  # Default for manual assignments
            reasoning="Manual assignment",
            is_ai_generated=False,
            manual_override=True
        )
        db.add(draft_assignment)
        db.commit()
        db.refresh(draft_assignment)
        
        # Record edit for collaboration tracking
        await collaboration_manager.record_edit(
            None,  # No connection_id for API calls
            "assign_staff",
            "assignment",
            draft_assignment.id,
            {
                "shift_id": shift_id,
                "staff_id": assignment.staff_id,
                "staff_name": staff.name
            },
            draft_id
        )
        
        # Broadcast the change
        await broadcast_schedule_update(business_id, draft_id, {
            "type": "staff_assigned",
            "shift_id": shift_id,
            "staff_id": assignment.staff_id,
            "staff_name": staff.name,
            "assignment_id": draft_assignment.id,
            "confidence_score": draft_assignment.confidence_score,
            "is_draft": True
        })
        
        # Return draft assignment formatted as regular assignment
        return ShiftAssignmentResponse(
            id=draft_assignment.id,
            shift_id=shift_id,
            staff_id=assignment.staff_id,
            status="assigned",
            assigned_at=draft_assignment.created_at,
            confirmed_at=None
        )
    
    else:
        # Handle regular published assignment
        # Check if already assigned
        existing = db.query(ShiftAssignment).filter(
            ShiftAssignment.shift_id == shift_id,
            ShiftAssignment.staff_id == assignment.staff_id
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail="Staff already assigned to this shift")
        
        # Create assignment
        db_assignment = ShiftAssignment(
            shift_id=shift_id,
            staff_id=assignment.staff_id,
            status="assigned"
        )
        db.add(db_assignment)
        
        # Update shift status if fully staffed
        current_assignments = db.query(ShiftAssignment).filter(
            ShiftAssignment.shift_id == shift_id
        ).count()
        
        if current_assignments + 1 >= shift.required_staff_count:
            shift.status = "filled"
        
        db.commit()
        db.refresh(db_assignment)
        
        # Broadcast the change to general business channel
        await broadcast_schedule_update(business_id, None, {
            "type": "staff_assigned",
            "shift_id": shift_id,
            "staff_id": assignment.staff_id,
            "staff_name": staff.name,
            "assignment_id": db_assignment.id,
            "is_draft": False
        })
        
        return db_assignment

@app.delete("/api/schedule/{business_id}/shifts/{shift_id}/assign/{assignment_id}")
async def unassign_staff_from_shift(
    business_id: int,
    shift_id: int,
    assignment_id: int,
    draft_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Remove staff assignment with draft schedule support and real-time updates"""
    
    if draft_id:
        # Handle draft assignment removal
        draft_assignment = db.query(DraftShiftAssignment).filter(
            DraftShiftAssignment.id == assignment_id,
            DraftShiftAssignment.draft_id == draft_id,
            DraftShiftAssignment.shift_id == shift_id
        ).first()
        
        if not draft_assignment:
            raise HTTPException(status_code=404, detail="Draft assignment not found")
        
        staff_id = draft_assignment.staff_id
        staff = db.query(Staff).filter(Staff.id == staff_id).first()
        
        db.delete(draft_assignment)
        db.commit()
        
        # Broadcast the change
        await broadcast_schedule_update(business_id, draft_id, {
            "type": "staff_unassigned",
            "shift_id": shift_id,
            "staff_id": staff_id,
            "staff_name": staff.name if staff else "Unknown",
            "assignment_id": assignment_id,
            "is_draft": True
        })
        
    else:
        # Handle regular assignment removal
        assignment = db.query(ShiftAssignment).filter(
            ShiftAssignment.id == assignment_id,
            ShiftAssignment.shift_id == shift_id
        ).first()
        
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")
        
        # Verify shift belongs to business
        shift = db.query(Shift).filter(
            Shift.id == shift_id,
            Shift.business_id == business_id
        ).first()
        if not shift:
            raise HTTPException(status_code=404, detail="Shift not found")
        
        staff_id = assignment.staff_id
        staff = db.query(Staff).filter(Staff.id == staff_id).first()
        
        db.delete(assignment)
        
        # Update shift status
        remaining_assignments = db.query(ShiftAssignment).filter(
            ShiftAssignment.shift_id == shift_id
        ).count() - 1
        
        if remaining_assignments < shift.required_staff_count:
            shift.status = "understaffed" if remaining_assignments > 0 else "scheduled"
        
        db.commit()
        
        # Broadcast the change
        await broadcast_schedule_update(business_id, None, {
            "type": "staff_unassigned",
            "shift_id": shift_id,
            "staff_id": staff_id,
            "staff_name": staff.name if staff else "Unknown",
            "assignment_id": assignment_id,
            "is_draft": False
        })
    
    return {"status": "success", "message": "Staff unassigned successfully"}

# Enhanced WebSocket endpoint for real-time collaboration
@app.websocket("/ws/collaboration/{business_id}")
async def websocket_collaboration(
    websocket: WebSocket, 
    business_id: int, 
    user_id: int,
    user_name: str,
    draft_id: Optional[str] = None
):
    """Enhanced WebSocket endpoint for real-time collaboration with conflict resolution"""
    connection_id = await collaboration_manager.connect_user(
        websocket, user_id, user_name, business_id, draft_id
    )
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            message_type = message.get("type")
            
            if message_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            
            elif message_type == "presence_update":
                await collaboration_manager.update_user_presence(
                    connection_id, 
                    message.get("action", "viewing"),
                    message.get("data")
                )
            
            elif message_type == "acquire_lock":
                success = await collaboration_manager.acquire_edit_lock(
                    connection_id,
                    message.get("resource_type"),
                    message.get("resource_id"),
                    draft_id
                )
                await websocket.send_text(json.dumps({
                    "type": "lock_response",
                    "success": success,
                    "resource_type": message.get("resource_type"),
                    "resource_id": message.get("resource_id")
                }))
            
            elif message_type == "release_lock":
                await collaboration_manager.release_edit_lock(
                    connection_id,
                    message.get("resource_type"),
                    message.get("resource_id"),
                    draft_id
                )
            
            elif message_type == "record_edit":
                conflict = await collaboration_manager.record_edit(
                    connection_id,
                    message.get("operation"),
                    message.get("target_type"),
                    message.get("target_id"),
                    message.get("data", {}),
                    draft_id
                )
                
                if conflict:
                    await websocket.send_text(json.dumps({
                        "type": "conflict_detected",
                        "conflict_id": conflict.conflict_id,
                        "conflict_type": conflict.conflict_type,
                        "edit1": {
                            "user_name": conflict.edit1.user_name,
                            "operation": conflict.edit1.operation,
                            "timestamp": conflict.edit1.timestamp.isoformat()
                        },
                        "edit2": {
                            "user_name": conflict.edit2.user_name,
                            "operation": conflict.edit2.operation,
                            "timestamp": conflict.edit2.timestamp.isoformat()
                        }
                    }))
            
            elif message_type == "resolve_conflict":
                await collaboration_manager.resolve_conflict(
                    connection_id,
                    message.get("conflict_id"),
                    message.get("resolution"),
                    message.get("resolution_data")
                )
            
    except WebSocketDisconnect:
        await collaboration_manager.disconnect_user(connection_id)

# Legacy WebSocket endpoint for backward compatibility
@app.websocket("/ws/schedule/{business_id}")
async def websocket_schedule_updates(websocket: WebSocket, business_id: int, draft_id: Optional[str] = None):
    """Legacy WebSocket endpoint for basic real-time schedule updates"""
    await schedule_manager.connect(websocket, business_id, draft_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif message.get("type") == "user_presence":
                await schedule_manager.broadcast_to_business({
                    "type": "user_presence",
                    "user_id": message.get("user_id"),
                    "user_name": message.get("user_name"),
                    "action": message.get("action", "viewing")
                }, business_id, draft_id)
            
    except WebSocketDisconnect:
        schedule_manager.disconnect(websocket, business_id, draft_id)

# Additional Schedule Management Endpoints

@app.put("/api/schedule/{business_id}/shifts/{shift_id}")
async def update_shift(
    business_id: int,
    shift_id: int,
    shift_update: dict,
    draft_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Update shift details with draft schedule support and real-time updates"""
    
    # Verify shift exists and belongs to business
    shift = db.query(Shift).filter(
        Shift.id == shift_id,
        Shift.business_id == business_id
    ).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    # Update shift fields
    for field, value in shift_update.items():
        if hasattr(shift, field) and field not in ['id', 'business_id', 'created_at']:
            if field == 'date' and isinstance(value, str):
                setattr(shift, field, datetime.fromisoformat(value))
            else:
                setattr(shift, field, value)
    
    db.commit()
    db.refresh(shift)
    
    # Broadcast the change
    update_data = {
        "type": "shift_updated",
        "shift_id": shift_id,
        "shift": {
            "id": shift.id,
            "title": shift.title,
            "date": shift.date.isoformat(),
            "start_time": shift.start_time,
            "end_time": shift.end_time,
            "required_skill": shift.required_skill,
            "required_staff_count": shift.required_staff_count,
            "status": shift.status
        }
    }
    
    if draft_id:
        await broadcast_schedule_update(business_id, draft_id, update_data)
    else:
        await broadcast_schedule_update(business_id, None, update_data)
    
    return {"status": "success", "message": "Shift updated successfully", "shift": shift}

@app.delete("/api/schedule/{business_id}/shifts/{shift_id}")
async def delete_shift(
    business_id: int,
    shift_id: int,
    draft_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Delete shift with draft schedule support and real-time updates"""
    
    # Verify shift exists and belongs to business
    shift = db.query(Shift).filter(
        Shift.id == shift_id,
        Shift.business_id == business_id
    ).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    # Remove all assignments first
    db.query(ShiftAssignment).filter(ShiftAssignment.shift_id == shift_id).delete()
    
    # Remove draft assignments if they exist
    db.query(DraftShiftAssignment).filter(DraftShiftAssignment.shift_id == shift_id).delete()
    
    # Delete the shift
    db.delete(shift)
    db.commit()
    
    # Broadcast the change
    update_data = {
        "type": "shift_deleted",
        "shift_id": shift_id
    }
    
    if draft_id:
        await broadcast_schedule_update(business_id, draft_id, update_data)
    else:
        await broadcast_schedule_update(business_id, None, update_data)
    
    return {"status": "success", "message": "Shift deleted successfully"}

@app.get("/api/schedule/{business_id}/drafts")
async def get_schedule_drafts(
    business_id: int,
    status: Optional[str] = None,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Get schedule drafts for a business"""
    
    query = db.query(ScheduleDraft).filter(ScheduleDraft.business_id == business_id)
    
    if status:
        query = query.filter(ScheduleDraft.status == status)
    
    drafts = query.order_by(ScheduleDraft.created_at.desc()).limit(limit).all()
    
    result = []
    for draft in drafts:
        # Count assignments
        assignment_count = db.query(DraftShiftAssignment).filter(
            DraftShiftAssignment.draft_id == draft.id
        ).count()
        
        result.append({
            "id": draft.id,
            "business_id": draft.business_id,
            "created_by": draft.created_by,
            "date_range_start": draft.date_range_start.isoformat(),
            "date_range_end": draft.date_range_end.isoformat(),
            "status": draft.status,
            "ai_generated": draft.ai_generated,
            "confidence_score": draft.confidence_score,
            "created_at": draft.created_at,
            "published_at": draft.published_at,
            "assignment_count": assignment_count
        })
    
    return result

@app.get("/api/schedule/{business_id}/conflicts")
async def get_schedule_conflicts(
    business_id: int,
    start_date: str,
    end_date: str,
    draft_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Detect scheduling conflicts and constraint violations"""
    
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)
    
    conflicts = []
    
    # Get shifts in date range - handle both date and datetime objects
    if hasattr(start, 'date'):
        start_date = start.date()
        end_date = end.date()
    else:
        start_date = start
        end_date = end
    
    shifts = db.query(Shift).filter(
        Shift.business_id == business_id
    ).all()
    
    # Filter shifts by date range manually to handle datetime vs date comparison
    filtered_shifts = []
    for shift in shifts:
        shift_date = shift.date.date() if hasattr(shift.date, 'date') else shift.date
        if start_date <= shift_date <= end_date:
            filtered_shifts.append(shift)
    
    shifts = filtered_shifts
    
    # Get assignments (draft or published)
    if draft_id:
        assignments = db.query(DraftShiftAssignment).filter(
            DraftShiftAssignment.draft_id == draft_id
        ).all()
    else:
        # Get all assignments for shifts in the business and filter by date range
        shift_ids = [shift.id for shift in shifts]
        assignments = db.query(ShiftAssignment).filter(
            ShiftAssignment.shift_id.in_(shift_ids)
        ).all() if shift_ids else []
    
    # Check for double bookings
    staff_schedules = {}
    for assignment in assignments:
        shift = next((s for s in shifts if s.id == assignment.shift_id), None)
        if not shift:
            continue
            
        staff_id = assignment.staff_id
        if staff_id not in staff_schedules:
            staff_schedules[staff_id] = []
        
        staff_schedules[staff_id].append({
            "shift_id": shift.id,
            "date": shift.date,
            "start_time": shift.start_time,
            "end_time": shift.end_time,
            "assignment_id": assignment.id
        })
    
    # Detect overlapping shifts for same staff
    for staff_id, schedule in staff_schedules.items():
        staff = db.query(Staff).filter(Staff.id == staff_id).first()
        for i, shift1 in enumerate(schedule):
            for shift2 in schedule[i+1:]:
                if shift1["date"].date() == shift2["date"].date():
                    # Check time overlap
                    start1 = datetime.strptime(shift1["start_time"], "%H:%M").time()
                    end1 = datetime.strptime(shift1["end_time"], "%H:%M").time()
                    start2 = datetime.strptime(shift2["start_time"], "%H:%M").time()
                    end2 = datetime.strptime(shift2["end_time"], "%H:%M").time()
                    
                    if (start1 < end2 and start2 < end1):
                        conflicts.append({
                            "type": "double_booking",
                            "staff_id": staff_id,
                            "staff_name": staff.name if staff else "Unknown",
                            "shift_ids": [shift1["shift_id"], shift2["shift_id"]],
                            "date": shift1["date"].isoformat(),
                            "message": f"{staff.name if staff else 'Staff'} is double-booked on {shift1['date'].strftime('%Y-%m-%d')}"
                        })
    
    # Check for understaffed shifts
    for shift in shifts:
        shift_assignments = [a for a in assignments if a.shift_id == shift.id]
        if len(shift_assignments) < shift.required_staff_count:
            conflicts.append({
                "type": "understaffed",
                "shift_id": shift.id,
                "shift_title": shift.title,
                "date": shift.date.date().isoformat(),  # Convert to date string
                "required": shift.required_staff_count,
                "assigned": len(shift_assignments),
                "message": f"Shift '{shift.title}' needs {shift.required_staff_count - len(shift_assignments)} more staff"
            })
    
    return {
        "conflicts": conflicts,
        "total_conflicts": len(conflicts),
        "date_range": {"start": start_date, "end": end_date}
    }

@app.post("/api/sick-leave", response_model=SickLeaveRequestResponse)
async def report_sick_leave(
    sick_leave: SickLeaveRequestCreate,
    db: Session = Depends(get_db)
):
    """Report sick leave and trigger AI-powered replacement search with in-app notifications"""
    
    # Verify shift and staff exist
    shift = db.query(Shift).filter(Shift.id == sick_leave.shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    staff = db.query(Staff).filter(Staff.id == sick_leave.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Create sick leave record
    db_sick_leave = SickLeaveRequest(
        staff_id=sick_leave.staff_id,
        shift_id=sick_leave.shift_id,
        business_id=sick_leave.business_id,
        reason=sick_leave.reason,
        message=sick_leave.message
    )
    db.add(db_sick_leave)
    
    # Update shift assignment status
    assignment = db.query(ShiftAssignment).filter(
        ShiftAssignment.shift_id == sick_leave.shift_id,
        ShiftAssignment.staff_id == sick_leave.staff_id
    ).first()
    
    if assignment:
        assignment.status = "called_in_sick"
    
    # Update shift status
    shift.status = "understaffed"
    
    db.commit()
    db.refresh(db_sick_leave)
    
    # Use the new app notification service for AI-powered replacement finding
    app_notification_service = AppNotificationService(db)
    notification_result = await app_notification_service.handle_sick_leave_notification(
        db_sick_leave, shift, staff
    )
    
    # Create emergency request for tracking
    emergency_request = EmergencyRequest(
        business_id=sick_leave.business_id,
        shift_date=shift.date,
        shift_start=shift.start_time,
        shift_end=shift.end_time,
        required_skill=shift.required_skill,
        urgency="high",
        message=f"URGENT: {staff.name} called in sick for {shift.title}. Need immediate replacement.",
        status="pending"
    )
    db.add(emergency_request)
    db.commit()
    db.refresh(emergency_request)
    
    # Return enhanced response with AI-powered notification details
    return {
        "id": db_sick_leave.id,
        "staff_id": db_sick_leave.staff_id,
        "shift_id": db_sick_leave.shift_id,
        "business_id": db_sick_leave.business_id,
        "reason": db_sick_leave.reason,
        "message": db_sick_leave.message,
        "reported_at": db_sick_leave.reported_at,
        "replacement_found": db_sick_leave.replacement_found,
        "replacement_staff_id": db_sick_leave.replacement_staff_id,
        "qualified_staff_count": notification_result["qualified_staff_found"],
        "notifications_sent": notification_result["notifications_sent"],
        "ai_message_generated": notification_result["ai_message_generated"],
        "manager_notified": notification_result["manager_notified"],
        "qualified_staff_details": notification_result["qualified_staff_details"],
        "replacement_message": notification_result["replacement_message"]
    }

@app.get("/api/schedule/{business_id}/calendar")
async def get_calendar_view(
    business_id: int,
    start_date: str,
    end_date: str,
    draft_id: Optional[str] = None,
    include_drafts: bool = False,
    db: Session = Depends(get_db)
):
    """Get enhanced calendar view with shifts, draft schedules, and confidence scores"""
    
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)
    
    # Get published shifts
    shifts = db.query(Shift).filter(
        Shift.business_id == business_id,
        Shift.date >= start,
        Shift.date <= end
    ).order_by(Shift.date, Shift.start_time).all()
    
    # Get draft assignments if requested
    draft_assignments = {}
    draft_info = None
    if draft_id or include_drafts:
        if draft_id:
            # Get specific draft
            draft = db.query(ScheduleDraft).filter(
                ScheduleDraft.id == draft_id,
                ScheduleDraft.business_id == business_id
            ).first()
            if draft:
                draft_info = {
                    "id": draft.id,
                    "status": draft.status,
                    "confidence_score": draft.confidence_score,
                    "ai_generated": draft.ai_generated,
                    "created_at": draft.created_at
                }
                assignments = db.query(DraftShiftAssignment).filter(
                    DraftShiftAssignment.draft_id == draft_id
                ).all()
                for assignment in assignments:
                    if assignment.shift_id not in draft_assignments:
                        draft_assignments[assignment.shift_id] = []
                    staff = db.query(Staff).filter(Staff.id == assignment.staff_id).first()
                    draft_assignments[assignment.shift_id].append({
                        "id": assignment.id,
                        "staff_id": assignment.staff_id,
                        "staff_name": staff.name if staff else "Unknown",
                        "confidence_score": assignment.confidence_score,
                        "reasoning": assignment.reasoning,
                        "is_ai_generated": assignment.is_ai_generated,
                        "manual_override": assignment.manual_override
                    })
        else:
            # Get latest draft for the date range
            latest_draft = db.query(ScheduleDraft).filter(
                ScheduleDraft.business_id == business_id,
                ScheduleDraft.date_range_start <= end.date(),
                ScheduleDraft.date_range_end >= start.date(),
                ScheduleDraft.status == "draft"
            ).order_by(ScheduleDraft.created_at.desc()).first()
            
            if latest_draft:
                draft_info = {
                    "id": latest_draft.id,
                    "status": latest_draft.status,
                    "confidence_score": latest_draft.confidence_score,
                    "ai_generated": latest_draft.ai_generated,
                    "created_at": latest_draft.created_at
                }
                assignments = db.query(DraftShiftAssignment).filter(
                    DraftShiftAssignment.draft_id == latest_draft.id
                ).all()
                for assignment in assignments:
                    if assignment.shift_id not in draft_assignments:
                        draft_assignments[assignment.shift_id] = []
                    staff = db.query(Staff).filter(Staff.id == assignment.staff_id).first()
                    draft_assignments[assignment.shift_id].append({
                        "id": assignment.id,
                        "staff_id": assignment.staff_id,
                        "staff_name": staff.name if staff else "Unknown",
                        "confidence_score": assignment.confidence_score,
                        "reasoning": assignment.reasoning,
                        "is_ai_generated": assignment.is_ai_generated,
                        "manual_override": assignment.manual_override
                    })
    
    # Group shifts by date
    calendar_data = {}
    current_date = start
    
    while current_date <= end:
        date_str = current_date.strftime('%Y-%m-%d')
        day_shifts = [s for s in shifts if s.date.date() == current_date.date()]
        
        # Get assignment details for each shift
        detailed_shifts = []
        for shift in day_shifts:
            # Get published assignments
            published_assignments = db.query(ShiftAssignment).filter(
                ShiftAssignment.shift_id == shift.id
            ).all()
            
            shift_data = {
                "id": shift.id,
                "title": shift.title,
                "start_time": shift.start_time,
                "end_time": shift.end_time,
                "required_skill": shift.required_skill,
                "required_staff_count": shift.required_staff_count,
                "status": shift.status,
                "assignments": [],
                "draft_assignments": draft_assignments.get(shift.id, []),
                "has_draft": shift.id in draft_assignments,
                "overall_confidence": None
            }
            
            # Add published assignments
            for assignment in published_assignments:
                staff = db.query(Staff).filter(Staff.id == assignment.staff_id).first()
                if staff:
                    shift_data["assignments"].append({
                        "id": assignment.id,
                        "staff_id": assignment.staff_id,
                        "staff_name": staff.name,
                        "status": assignment.status,
                        "assigned_at": assignment.assigned_at,
                        "confirmed_at": assignment.confirmed_at
                    })
            
            # Calculate overall confidence for shifts with draft assignments
            if shift.id in draft_assignments:
                confidence_scores = [da["confidence_score"] for da in draft_assignments[shift.id]]
                if confidence_scores:
                    shift_data["overall_confidence"] = sum(confidence_scores) / len(confidence_scores)
            
            detailed_shifts.append(shift_data)
        
        calendar_data[date_str] = {
            "date": date_str,
            "shifts": detailed_shifts,
            "total_shifts": len(day_shifts),
            "filled_shifts": len([s for s in day_shifts if s.status == "filled"]),
            "understaffed_shifts": len([s for s in day_shifts if s.status == "understaffed"]),
            "draft_shifts": len([s for s in detailed_shifts if s["has_draft"]])
        }
        
        current_date += timedelta(days=1)
    
    response = {
        "calendar": calendar_data,
        "date_range": {
            "start": start_date,
            "end": end_date
        }
    }
    
    if draft_info:
        response["draft_info"] = draft_info
    
    return response

@app.get("/api/staff/{staff_id}/schedule")
async def get_staff_schedule(
    staff_id: int,
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db)
):
    """Get schedule for specific staff member"""
    
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)
    
    assignments = db.query(ShiftAssignment).join(Shift).filter(
        ShiftAssignment.staff_id == staff_id,
        Shift.date >= start,
        Shift.date <= end
    ).all()
    
    schedule = []
    for assignment in assignments:
        shift = assignment.shift
        schedule.append({
            "shift_id": shift.id,
            "title": shift.title,
            "date": shift.date,
            "start_time": shift.start_time,
            "end_time": shift.end_time,
            "status": assignment.status,
            "hourly_rate": shift.hourly_rate
        })
    
    return sorted(schedule, key=lambda x: (x["date"], x["start_time"]))

# Auto-Schedule API Endpoints
@app.post("/api/auto-schedule/{business_id}/generate", response_model=AutoScheduleResponse)
async def generate_auto_schedule(
    business_id: int,
    params: AutoScheduleRequest,
    db: Session = Depends(get_db)
):
    """Generate AI-powered schedule for specified date range"""
    from services.ai_scheduling_engine import AISchedulingEngine, SchedulingParameters
    from datetime import date
    
    # Verify business exists
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    try:
        # Convert string dates to date objects
        date_start = date.fromisoformat(params.date_range_start)
        date_end = date.fromisoformat(params.date_range_end)
        
        # Create scheduling parameters
        scheduling_params = SchedulingParameters(
            business_id=business_id,
            date_range_start=date_start,
            date_range_end=date_end,
            special_events=[event.model_dump() for event in params.special_events],
            staff_notes=[note.model_dump() for note in params.staff_notes],
            constraints=params.constraints,
            created_by=1  # TODO: Get from authentication
        )
        
        # Initialize AI scheduling engine
        engine = AISchedulingEngine(db)
        
        # Generate schedule
        result = await engine.generate_schedule(scheduling_params)
        
        return AutoScheduleResponse(
            draft_id=result.draft_id,
            total_shifts=result.generation_summary.get("total_shifts", 0),
            assigned_shifts=result.generation_summary.get("assigned_shifts", 0),
            unassigned_shifts=result.generation_summary.get("unassigned_shifts", 0),
            overall_confidence=result.overall_confidence,
            generation_summary=result.generation_summary,
            warnings=result.warnings,
            recommendations=result.recommendations
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Schedule generation failed: {str(e)}")

@app.get("/api/auto-schedule/{business_id}/draft/{draft_id}", response_model=ScheduleDraftResponse)
async def get_schedule_draft(
    business_id: int,
    draft_id: str,
    db: Session = Depends(get_db)
):
    """Retrieve draft schedule for review"""
    
    # Get draft with assignments
    draft = db.query(ScheduleDraft).filter(
        ScheduleDraft.id == draft_id,
        ScheduleDraft.business_id == business_id
    ).first()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft schedule not found")
    
    # Get assignments with staff details
    assignments = db.query(DraftShiftAssignment).filter(
        DraftShiftAssignment.draft_id == draft_id
    ).all()
    
    assignment_responses = []
    for assignment in assignments:
        staff = db.query(Staff).filter(Staff.id == assignment.staff_id).first()
        assignment_responses.append(DraftShiftAssignmentResponse(
            id=assignment.id,
            shift_id=assignment.shift_id,
            staff_id=assignment.staff_id,
            staff_name=staff.name if staff else "Unknown",
            confidence_score=assignment.confidence_score,
            reasoning=assignment.reasoning,
            is_ai_generated=assignment.is_ai_generated,
            manual_override=assignment.manual_override,
            created_at=assignment.created_at
        ))
    
    return ScheduleDraftResponse(
        id=draft.id,
        business_id=draft.business_id,
        created_by=draft.created_by,
        date_range_start=draft.date_range_start.isoformat(),
        date_range_end=draft.date_range_end.isoformat(),
        status=draft.status,
        ai_generated=draft.ai_generated,
        confidence_score=draft.confidence_score,
        created_at=draft.created_at,
        published_at=draft.published_at,
        assignments=assignment_responses
    )

@app.put("/api/auto-schedule/{business_id}/draft/{draft_id}", response_model=ScheduleDraftResponse)
async def update_schedule_draft(
    business_id: int,
    draft_id: str,
    changes: List[ScheduleChange],
    db: Session = Depends(get_db)
):
    """Update draft schedule with manual changes and validation"""
    
    # Verify draft exists and belongs to business
    draft = db.query(ScheduleDraft).filter(
        ScheduleDraft.id == draft_id,
        ScheduleDraft.business_id == business_id,
        ScheduleDraft.status == "draft"
    ).first()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft schedule not found or already published")
    
    # Get existing assignments for validation context
    existing_assignments = db.query(DraftShiftAssignment).filter(
        DraftShiftAssignment.draft_id == draft_id
    ).all()
    
    # Validate changes before applying them
    validation_errors = []
    validation_warnings = []
    
    try:
        # Pre-validate each change
        for change in changes:
            if change.action == "assign":
                if change.staff_id is None:
                    raise HTTPException(status_code=400, detail="staff_id required for assign action")
                
                # Validate staff exists and belongs to business
                staff = db.query(Staff).filter(
                    Staff.id == change.staff_id,
                    Staff.business_id == business_id,
                    Staff.is_active == True
                ).first()
                
                if not staff:
                    validation_errors.append(f"Staff member {change.staff_id} not found or inactive")
                    continue
                
                # Validate shift exists and belongs to business
                shift = db.query(Shift).filter(
                    Shift.id == change.shift_id,
                    Shift.business_id == business_id
                ).first()
                
                if not shift:
                    validation_errors.append(f"Shift {change.shift_id} not found")
                    continue
                
                # Check if assignment already exists
                existing = db.query(DraftShiftAssignment).filter(
                    DraftShiftAssignment.draft_id == draft_id,
                    DraftShiftAssignment.shift_id == change.shift_id,
                    DraftShiftAssignment.staff_id == change.staff_id
                ).first()
                
                if existing:
                    validation_warnings.append(f"Staff {staff.name} already assigned to shift {shift.title}")
                    continue
                
                # Basic skill validation (critical)
                if not staff.skills or shift.required_skill not in staff.skills:
                    validation_errors.append(
                        f"Staff {staff.name} lacks required skill '{shift.required_skill}' for shift {shift.title}"
                    )
                    continue
                
                # Advanced constraint validation (with error handling)
                try:
                    from services.constraint_solver import ConstraintSolver, SchedulingContext
                    constraint_solver = ConstraintSolver(db)
                    
                    # Create context for validation
                    context = SchedulingContext(
                        business_id=business_id,
                        date_range_start=draft.date_range_start,
                        date_range_end=draft.date_range_end,
                        existing_assignments=existing_assignments,
                        constraints=db.query(SchedulingConstraint).filter(
                            SchedulingConstraint.business_id == business_id,
                            SchedulingConstraint.is_active == True
                        ).all(),
                        staff_preferences=db.query(StaffPreference).filter(
                            StaffPreference.staff_id == change.staff_id,
                            StaffPreference.is_active == True
                        ).all()
                    )
                    
                    # Validate the assignment
                    validation_result = constraint_solver.validate_assignment(
                        shift, staff, existing_assignments, context
                    )
                    
                    # Add any violations as warnings (non-critical)
                    if validation_result.violations:
                        validation_warnings.extend(validation_result.violations)
                    elif validation_result.score < 0.5:
                        validation_warnings.append(
                            f"Low confidence assignment ({validation_result.score:.2f}) for {staff.name} to {shift.title}"
                        )
                        
                except Exception as constraint_error:
                    # If constraint validation fails, log it but don't block the assignment
                    validation_warnings.append(
                        f"Could not fully validate constraints for {staff.name} assignment: {str(constraint_error)}"
                    )
        
        # If there are critical validation errors, don't proceed
        if validation_errors:
            raise HTTPException(
                status_code=422, 
                detail={
                    "message": "Validation failed for draft changes",
                    "errors": validation_errors,
                    "warnings": validation_warnings
                }
            )
        
        # Apply changes if validation passes
        for change in changes:
            if change.action == "assign":
                # Create new assignment
                if change.staff_id is None:
                    continue  # Already validated above
                
                # Check if assignment already exists (skip if it does)
                existing = db.query(DraftShiftAssignment).filter(
                    DraftShiftAssignment.draft_id == draft_id,
                    DraftShiftAssignment.shift_id == change.shift_id,
                    DraftShiftAssignment.staff_id == change.staff_id
                ).first()
                
                if not existing:
                    new_assignment = DraftShiftAssignment(
                        draft_id=draft_id,
                        shift_id=change.shift_id,
                        staff_id=change.staff_id,
                        confidence_score=0.8,  # Default for manual assignments
                        reasoning=change.reasoning or "Manual assignment",
                        is_ai_generated=False,
                        manual_override=True
                    )
                    db.add(new_assignment)
            
            elif change.action == "unassign":
                # Remove assignment
                if change.assignment_id:
                    assignment = db.query(DraftShiftAssignment).filter(
                        DraftShiftAssignment.id == change.assignment_id,
                        DraftShiftAssignment.draft_id == draft_id
                    ).first()
                    if assignment:
                        db.delete(assignment)
                else:
                    # Remove by shift_id and staff_id
                    if change.staff_id:
                        assignment = db.query(DraftShiftAssignment).filter(
                            DraftShiftAssignment.draft_id == draft_id,
                            DraftShiftAssignment.shift_id == change.shift_id,
                            DraftShiftAssignment.staff_id == change.staff_id
                        ).first()
                        if assignment:
                            db.delete(assignment)
            
            elif change.action == "modify":
                # Modify existing assignment
                if change.assignment_id:
                    assignment = db.query(DraftShiftAssignment).filter(
                        DraftShiftAssignment.id == change.assignment_id,
                        DraftShiftAssignment.draft_id == draft_id
                    ).first()
                    if assignment:
                        if change.staff_id:
                            assignment.staff_id = change.staff_id
                        if change.reasoning:
                            assignment.reasoning = change.reasoning
                        assignment.manual_override = True
        
        db.commit()
        
        # Return updated draft
        return await get_schedule_draft(business_id, draft_id, db)
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update draft {draft_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update draft: {str(e)}")

@app.post("/api/auto-schedule/{business_id}/publish/{draft_id}", response_model=PublishResponse)
async def publish_schedule(
    business_id: int,
    draft_id: str,
    notification_settings: NotificationSettings,
    db: Session = Depends(get_db)
):
    """Publish final schedule with comprehensive validation and notifications"""
    
    # Verify draft exists and is ready to publish
    draft = db.query(ScheduleDraft).filter(
        ScheduleDraft.id == draft_id,
        ScheduleDraft.business_id == business_id,
        ScheduleDraft.status == "draft"
    ).first()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft schedule not found or already published")
    
    try:
        # Get all draft assignments
        draft_assignments = db.query(DraftShiftAssignment).filter(
            DraftShiftAssignment.draft_id == draft_id
        ).all()
        
        if not draft_assignments:
            raise HTTPException(
                status_code=422, 
                detail="Cannot publish empty schedule. Please add staff assignments first."
            )
        
        # Validate the entire schedule before publishing
        validation_errors = []
        validation_warnings = []
        
        # Get all shifts in the date range to check coverage
        shifts_in_range = db.query(Shift).filter(
            Shift.business_id == business_id,
            Shift.date >= draft.date_range_start,
            Shift.date <= draft.date_range_end
        ).all()
        
        # Check shift coverage
        assigned_shift_ids = {assignment.shift_id for assignment in draft_assignments}
        uncovered_shifts = [shift for shift in shifts_in_range if shift.id not in assigned_shift_ids]
        
        if uncovered_shifts:
            validation_warnings.extend([
                f"Shift '{shift.title}' on {shift.date} ({shift.start_time}-{shift.end_time}) has no staff assigned"
                for shift in uncovered_shifts[:5]  # Limit to first 5 for readability
            ])
            if len(uncovered_shifts) > 5:
                validation_warnings.append(f"... and {len(uncovered_shifts) - 5} more uncovered shifts")
        
        # Validate assignments using constraint solver
        from services.constraint_solver import ConstraintSolver
        constraint_solver = ConstraintSolver(db)
        
        # Convert draft assignments to validation format
        assignments_for_validation = [
            {
                "shift_id": assignment.shift_id,
                "staff_id": assignment.staff_id,
                "assignment_id": assignment.id
            }
            for assignment in draft_assignments
        ]
        
        # Get constraints and preferences
        from models import SchedulingConstraint, StaffPreference
        constraints = db.query(SchedulingConstraint).filter(
            SchedulingConstraint.business_id == business_id,
            SchedulingConstraint.is_active == True
        ).all()
        
        staff_ids = list({assignment.staff_id for assignment in draft_assignments})
        preferences = db.query(StaffPreference).filter(
            StaffPreference.staff_id.in_(staff_ids),
            StaffPreference.is_active == True
        ).all() if staff_ids else []
        
        # Validate all assignments
        validation_result = constraint_solver.validate_assignments(
            assignments_for_validation,
            constraints,
            preferences
        )
        
        # Check for critical violations that prevent publishing
        critical_violations = [
            v for v in validation_result.get("violations", [])
            if v.get("severity") == "error" and v.get("constraint_type") in ["skill_match", "data_integrity"]
        ]
        
        if critical_violations:
            validation_errors.extend([v.get("message", "Unknown error") for v in critical_violations])
        
        # Add other violations as warnings
        other_violations = [
            v for v in validation_result.get("violations", [])
            if v.get("severity") != "error" or v.get("constraint_type") not in ["skill_match", "data_integrity"]
        ]
        validation_warnings.extend([v.get("message", "Unknown warning") for v in other_violations])
        validation_warnings.extend([v.get("message", "Unknown warning") for v in validation_result.get("warnings", [])])
        
        # Check for understaffed shifts
        shift_staff_count = {}
        for assignment in draft_assignments:
            shift_id = assignment.shift_id
            shift_staff_count[shift_id] = shift_staff_count.get(shift_id, 0) + 1
        
        understaffed_shifts = []
        for shift in shifts_in_range:
            assigned_count = shift_staff_count.get(shift.id, 0)
            if assigned_count < shift.required_staff_count:
                understaffed_shifts.append(
                    f"Shift '{shift.title}' on {shift.date} needs {shift.required_staff_count} staff but only has {assigned_count}"
                )
        
        if understaffed_shifts:
            validation_warnings.extend(understaffed_shifts[:5])  # Limit for readability
            if len(understaffed_shifts) > 5:
                validation_warnings.append(f"... and {len(understaffed_shifts) - 5} more understaffed shifts")
        
        # If there are critical errors, don't publish
        if validation_errors:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Cannot publish schedule due to validation errors",
                    "errors": validation_errors,
                    "warnings": validation_warnings,
                    "total_errors": len(validation_errors),
                    "total_warnings": len(validation_warnings)
                }
            )
        
        # Convert draft assignments to published assignments
        published_count = 0
        for draft_assignment in draft_assignments:
            # Check if shift assignment already exists
            existing = db.query(ShiftAssignment).filter(
                ShiftAssignment.shift_id == draft_assignment.shift_id,
                ShiftAssignment.staff_id == draft_assignment.staff_id
            ).first()
            
            if not existing:
                published_assignment = ShiftAssignment(
                    shift_id=draft_assignment.shift_id,
                    staff_id=draft_assignment.staff_id,
                    status="assigned"
                )
                db.add(published_assignment)
                published_count += 1
        
        # Update shift statuses based on staffing
        for shift in shifts_in_range:
            assigned_count = shift_staff_count.get(shift.id, 0)
            if assigned_count >= shift.required_staff_count:
                shift.status = "filled"
            elif assigned_count > 0:
                shift.status = "understaffed"
            else:
                shift.status = "scheduled"
        
        # Update draft status
        draft.status = "published"
        draft.published_at = datetime.now()
        
        # Send notifications if requested
        notifications_sent = 0
        failed_notifications = 0
        
        if notification_settings.notify_all_staff:
            # Get all staff involved in the schedule
            staff_ids = [assignment.staff_id for assignment in draft_assignments]
            unique_staff_ids = list(set(staff_ids))
            
            for staff_id in unique_staff_ids:
                staff = db.query(Staff).filter(Staff.id == staff_id).first()
                if staff:
                    try:
                        # Get staff's assignments for personalized message
                        staff_assignments = [a for a in draft_assignments if a.staff_id == staff_id]
                        shift_details = []
                        
                        for assignment in staff_assignments:
                            shift = db.query(Shift).filter(Shift.id == assignment.shift_id).first()
                            if shift:
                                shift_details.append(
                                    f"{shift.title} on {shift.date.strftime('%A, %B %d')} "
                                    f"from {shift.start_time} to {shift.end_time}"
                                )
                        
                        # Create personalized notification content
                        content = f"New schedule published for {draft.date_range_start} to {draft.date_range_end}.\n"
                        content += f"Your shifts:\n" + "\n".join(shift_details)
                        
                        if notification_settings.custom_message:
                            content += f"\n\nNote: {notification_settings.custom_message}"
                        
                        # Create notification record
                        notification = ScheduleNotification(
                            draft_id=draft_id,
                            staff_id=staff_id,
                            notification_type="new_schedule",
                            channel="whatsapp",  # Default channel - could be enhanced with preferences
                            content=content,
                            status="pending"  # Will be updated when actually sent
                        )
                        db.add(notification)
                        notifications_sent += 1
                        
                        # TODO: Integrate with actual notification services
                        # For now, mark as sent
                        notification.status = "sent"
                        notification.sent_at = datetime.now()
                        
                    except Exception as e:
                        failed_notifications += 1
                        logger.error(f"Failed to send notification to staff {staff_id}: {e}")
        
        db.commit()
        
        # Prepare response message
        message = f"Schedule published successfully with {published_count} assignments"
        if validation_warnings:
            message += f" (with {len(validation_warnings)} warnings)"
        
        return PublishResponse(
            success=True,
            published_at=draft.published_at,
            notifications_sent=notifications_sent,
            failed_notifications=failed_notifications,
            message=message
        )
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to publish schedule {draft_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to publish schedule: {str(e)}")

@app.get("/api/auto-schedule/{business_id}/assignment/{assignment_id}/reasoning")
async def get_assignment_reasoning(
    business_id: int,
    assignment_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed reasoning for a specific assignment"""
    
    # Get the assignment
    assignment = db.query(DraftShiftAssignment).filter(
        DraftShiftAssignment.id == assignment_id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Verify business ownership
    draft = db.query(ScheduleDraft).filter(
        ScheduleDraft.id == assignment.draft_id,
        ScheduleDraft.business_id == business_id
    ).first()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Assignment not found for this business")
    
    try:
        # Get shift and staff details
        shift = db.query(Shift).filter(Shift.id == assignment.shift_id).first()
        staff = db.query(Staff).filter(Staff.id == assignment.staff_id).first()
        
        if not shift or not staff:
            raise HTTPException(status_code=404, detail="Shift or staff not found")
        
        # Initialize AI scheduling engine
        from services.ai_scheduling_engine import AISchedulingEngine, SchedulingContext
        from services.constraint_solver import ConstraintSolver
        
        ai_engine = AISchedulingEngine(db)
        
        # Build scheduling context
        context = SchedulingContext(
            business_id=business_id,
            date_range_start=draft.date_range_start,
            date_range_end=draft.date_range_end,
            existing_assignments=[],
            constraints=[],
            staff_preferences=[]
        )
        
        # Generate detailed reasoning
        reasoning = await ai_engine.explain_assignment(assignment, context)
        
        return {
            "assignment_id": assignment_id,
            "staff_id": assignment.staff_id,
            "shift_id": assignment.shift_id,
            "staff_name": staff.name,
            "shift_title": shift.title,
            "confidence_score": reasoning.confidence_score,
            "primary_reasons": reasoning.primary_reasons,
            "considerations": reasoning.considerations,
            "alternatives_considered": reasoning.alternatives_considered,
            "risk_factors": reasoning.risk_factors,
            "confidence_explanation": ai_engine.reasoning_engine.generate_confidence_explanation(reasoning.confidence_score)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate reasoning: {str(e)}")

# Feature 1: AI-Powered Predictive Scheduling
@app.post("/api/predictive-scheduling/{business_id}/generate")
async def generate_predictive_schedule(
    business_id: int,
    week_start: str,
    db: Session = Depends(get_db)
):
    """Generate AI-powered predictive schedule"""
    scheduler = PredictiveScheduler(db)
    from datetime import date
    week_start_date = date.fromisoformat(week_start)
    
    schedule = await scheduler.generate_smart_schedule(business_id, week_start_date)
    return schedule

@app.get("/api/predictive-scheduling/{business_id}/predictions")
async def get_demand_predictions(
    business_id: int,
    days: int = 7,
    db: Session = Depends(get_db)
):
    """Get demand predictions for upcoming days"""
    from models import DemandPrediction
    from datetime import date, timedelta
    
    start_date = date.today()
    end_date = start_date + timedelta(days=days)
    
    predictions = db.query(DemandPrediction).filter(
        DemandPrediction.business_id == business_id,
        DemandPrediction.prediction_date >= start_date,
        DemandPrediction.prediction_date <= end_date
    ).all()
    
    return [
        {
            "date": p.prediction_date.isoformat(),
            "hour": p.hour,
            "predicted_demand": p.predicted_demand,
            "confidence_score": p.confidence_score,
            "factors": p.factors
        }
        for p in predictions
    ]

# Feature 2: Smart Staff Communication Hub
@app.post("/api/smart-communication/{business_id}/send")
async def send_smart_message(
    business_id: int,
    message_data: dict,
    sender_id: int,
    db: Session = Depends(get_db)
):
    """Send smart message with AI optimization"""
    comm_hub = SmartCommunicationHub(db)
    result = await comm_hub.send_smart_message(business_id, sender_id, message_data)
    return result

@app.get("/api/smart-communication/{business_id}/templates/{message_type}")
async def get_message_templates(
    business_id: int,
    message_type: str,
    db: Session = Depends(get_db)
):
    """Get message templates for specific type"""
    comm_hub = SmartCommunicationHub(db)
    templates = await comm_hub.get_message_templates(business_id, message_type)
    return templates

@app.get("/api/smart-communication/{business_id}/analytics")
async def get_communication_analytics(
    business_id: int,
    days_back: int = 30,
    db: Session = Depends(get_db)
):
    """Get communication analytics"""
    comm_hub = SmartCommunicationHub(db)
    analytics = await comm_hub.get_communication_analytics(business_id, days_back)
    return analytics

@app.get("/api/smart-communication/staff/{staff_id}/preferences")
async def get_staff_communication_preferences(
    staff_id: int,
    db: Session = Depends(get_db)
):
    """Get communication preferences for staff member"""
    comm_hub = SmartCommunicationHub(db)
    preferences = await comm_hub.get_staff_communication_preferences(staff_id)
    return preferences

# Feature 3: Digital Training & Certification Manager
@app.post("/api/training/{business_id}/modules")
async def create_training_module(
    business_id: int,
    module_data: dict,
    db: Session = Depends(get_db)
):
    """Create new training module with AI-generated content"""
    training_manager = TrainingManager(db)
    result = await training_manager.create_training_module(business_id, module_data)
    return result

@app.post("/api/training/staff/{staff_id}/start/{module_id}")
async def start_training(
    staff_id: int,
    module_id: int,
    db: Session = Depends(get_db)
):
    """Start training for staff member"""
    training_manager = TrainingManager(db)
    result = await training_manager.start_training(staff_id, module_id)
    return result

@app.post("/api/training/staff/{staff_id}/complete/{module_id}")
async def complete_training(
    staff_id: int,
    module_id: int,
    quiz_answers: Optional[List[int]] = None,
    db: Session = Depends(get_db)
):
    """Complete training and process quiz"""
    training_manager = TrainingManager(db)
    result = await training_manager.complete_training(staff_id, module_id, quiz_answers)
    return result

@app.get("/api/training/staff/{staff_id}/dashboard")
async def get_staff_training_dashboard(
    staff_id: int,
    db: Session = Depends(get_db)
):
    """Get training dashboard for staff member"""
    training_manager = TrainingManager(db)
    dashboard = await training_manager.get_staff_training_dashboard(staff_id)
    return dashboard

@app.get("/api/training/{business_id}/analytics")
async def get_training_analytics(
    business_id: int,
    db: Session = Depends(get_db)
):
    """Get training analytics for business"""
    training_manager = TrainingManager(db)
    analytics = await training_manager.get_business_training_analytics(business_id)
    return analytics

# Feature 4: Real-Time Business Intelligence Dashboard
@app.get("/api/business-intelligence/{business_id}/real-time")
async def get_real_time_metrics(
    business_id: int,
    db: Session = Depends(get_db)
):
    """Get real-time business metrics"""
    bi_service = BusinessIntelligenceService(db)
    metrics = await bi_service.get_real_time_metrics(business_id)
    return metrics

@app.get("/api/business-intelligence/{business_id}/weekly-report")
async def get_weekly_report(
    business_id: int,
    week_start: str,
    db: Session = Depends(get_db)
):
    """Get weekly performance report"""
    bi_service = BusinessIntelligenceService(db)
    from datetime import date
    week_start_date = date.fromisoformat(week_start)
    report = await bi_service.get_weekly_report(business_id, week_start_date)
    return report

@app.get("/api/business-intelligence/{business_id}/staff-performance")
async def get_staff_performance_ranking(
    business_id: int,
    days: int = 30,
    db: Session = Depends(get_db)
):
    """Get staff performance ranking"""
    bi_service = BusinessIntelligenceService(db)
    ranking = await bi_service.get_staff_performance_ranking(business_id, days)
    return ranking

@app.get("/api/business-intelligence/{business_id}/cost-analysis")
async def get_cost_analysis(
    business_id: int,
    days: int = 30,
    db: Session = Depends(get_db)
):
    """Get detailed cost analysis"""
    bi_service = BusinessIntelligenceService(db)
    analysis = await bi_service.get_cost_analysis(business_id, days)
    return analysis

# Feature 5: Intelligent Inventory Management
@app.get("/api/inventory/{business_id}/predictions")
async def get_inventory_predictions(
    business_id: int,
    db: Session = Depends(get_db)
):
    """Get AI-powered inventory predictions"""
    inventory_service = InventoryIntelligence(db)
    predictions = await inventory_service.predict_inventory_needs(business_id)
    return predictions

@app.get("/api/inventory/{business_id}/smart-orders")
async def generate_smart_orders(
    business_id: int,
    db: Session = Depends(get_db)
):
    """Generate smart reorder recommendations"""
    inventory_service = InventoryIntelligence(db)
    orders = await inventory_service.generate_smart_orders(business_id)
    return orders

@app.get("/api/inventory/{business_id}/dashboard")
async def get_inventory_dashboard(
    business_id: int,
    db: Session = Depends(get_db)
):
    """Get comprehensive inventory dashboard"""
    inventory_service = InventoryIntelligence(db)
    dashboard = await inventory_service.get_inventory_dashboard(business_id)
    return dashboard

@app.get("/api/inventory/{business_id}/waste-analysis")
async def get_waste_analysis(
    business_id: int,
    days: int = 30,
    db: Session = Depends(get_db)
):
    """Get waste patterns analysis"""
    inventory_service = InventoryIntelligence(db)
    analysis = await inventory_service.track_waste_patterns(business_id, days)
    return analysis

@app.get("/api/inventory/{business_id}/supplier-performance")
async def get_supplier_performance(
    business_id: int,
    db: Session = Depends(get_db)
):
    """Get supplier performance analysis"""
    inventory_service = InventoryIntelligence(db)
    performance = await inventory_service.get_supplier_performance(business_id)
    return performance

# Feature 6: Multi-Location Coordination Hub
@app.get("/api/multi-location/{business_id}/locations")
async def get_business_locations(
    business_id: int,
    db: Session = Depends(get_db)
):
    """Get all locations for a business"""
    from models import Location
    locations = db.query(Location).filter(
        Location.business_id == business_id,
        Location.is_active == True
    ).all()
    
    return [
        {
            "id": loc.id,
            "name": loc.name,
            "address": loc.address,
            "manager_id": loc.manager_id,
            "phone": loc.phone,
            "coordinates": loc.coordinates
        }
        for loc in locations
    ]

@app.post("/api/multi-location/staff-transfer")
async def create_staff_transfer(
    transfer_data: dict,
    db: Session = Depends(get_db)
):
    """Create staff transfer between locations"""
    from models import StaffTransfer
    
    transfer = StaffTransfer(
        staff_id=transfer_data["staff_id"],
        from_location_id=transfer_data["from_location_id"],
        to_location_id=transfer_data["to_location_id"],
        transfer_date=datetime.fromisoformat(transfer_data["transfer_date"]).date(),
        transfer_type=transfer_data.get("transfer_type", "temporary"),
        reason=transfer_data.get("reason"),
        requested_by=transfer_data.get("requested_by")
    )
    
    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    
    return {"transfer_id": transfer.id, "status": "pending"}

@app.get("/api/multi-location/{business_id}/transfers")
async def get_staff_transfers(
    business_id: int,
    db: Session = Depends(get_db)
):
    """Get staff transfers for business"""
    from models import StaffTransfer, Location
    
    transfers = db.query(StaffTransfer).join(
        Location, StaffTransfer.from_location_id == Location.id
    ).filter(Location.business_id == business_id).all()
    
    return [
        {
            "id": t.id,
            "staff_id": t.staff_id,
            "from_location_id": t.from_location_id,
            "to_location_id": t.to_location_id,
            "transfer_date": t.transfer_date.isoformat(),
            "transfer_type": t.transfer_type,
            "status": t.status,
            "reason": t.reason
        }
        for t in transfers
    ]

# Feature 7: Emergency Response Automation
@app.post("/api/emergency-response/{business_id}/incident")
async def create_emergency_incident(
    business_id: int,
    incident_data: dict,
    db: Session = Depends(get_db)
):
    """Create emergency incident and trigger response"""
    from models import EmergencyIncident
    
    # Generate AI response plan
    response_plan = await ai_service.generate_emergency_response(
        incident_data["emergency_type"],
        incident_data,
        {"business_id": business_id}
    )
    
    incident = EmergencyIncident(
        business_id=business_id,
        location_id=incident_data.get("location_id"),
        emergency_type=incident_data["emergency_type"],
        severity=incident_data.get("severity", "medium"),
        description=incident_data["description"],
        reported_by=incident_data.get("reported_by"),
        actions_taken=response_plan
    )
    
    db.add(incident)
    db.commit()
    db.refresh(incident)
    
    return {
        "incident_id": incident.id,
        "response_plan": response_plan,
        "status": "active"
    }

@app.get("/api/emergency-response/{business_id}/incidents")
async def get_emergency_incidents(
    business_id: int,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Get recent emergency incidents"""
    from models import EmergencyIncident
    
    incidents = db.query(EmergencyIncident).filter(
        EmergencyIncident.business_id == business_id
    ).order_by(EmergencyIncident.created_at.desc()).limit(limit).all()
    
    return [
        {
            "id": inc.id,
            "emergency_type": inc.emergency_type,
            "severity": inc.severity,
            "description": inc.description,
            "status": inc.status,
            "created_at": inc.created_at.isoformat(),
            "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None
        }
        for inc in incidents
    ]

# Feature 8: Customer Experience Integration
@app.get("/api/customer-experience/{business_id}/reviews")
async def get_customer_reviews(
    business_id: int,
    days: int = 30,
    db: Session = Depends(get_db)
):
    """Get customer reviews and analysis"""
    from models import CustomerReview
    from datetime import timedelta
    
    since_date = datetime.now() - timedelta(days=days)
    
    reviews = db.query(CustomerReview).filter(
        CustomerReview.business_id == business_id,
        CustomerReview.review_date >= since_date
    ).order_by(CustomerReview.review_date.desc()).all()
    
    # Analyze reviews with AI
    review_data = [
        {
            "platform": r.platform,
            "rating": r.rating,
            "review_text": r.review_text,
            "reviewer_name": r.reviewer_name,
            "review_date": r.review_date.isoformat()
        }
        for r in reviews
    ]
    
    analysis = await ai_service.analyze_customer_feedback(review_data)
    
    return {
        "total_reviews": len(reviews),
        "average_rating": sum(r.rating for r in reviews) / len(reviews) if reviews else 0,
        "reviews": review_data[:10],  # Latest 10 reviews
        "analysis": analysis
    }

@app.get("/api/customer-experience/{business_id}/service-metrics")
async def get_service_metrics(
    business_id: int,
    days: int = 7,
    db: Session = Depends(get_db)
):
    """Get service quality metrics"""
    from models import ServiceMetric
    from datetime import timedelta
    
    since_date = date.today() - timedelta(days=days)
    
    metrics = db.query(ServiceMetric).filter(
        ServiceMetric.business_id == business_id,
        ServiceMetric.metric_date >= since_date
    ).all()
    
    if not metrics:
        return {"message": "No service metrics available"}
    
    avg_wait_time = sum(m.average_wait_time or 0 for m in metrics) / len(metrics)
    avg_rating = sum(m.service_rating or 0 for m in metrics) / len(metrics)
    
    return {
        "period_days": days,
        "average_wait_time": round(avg_wait_time, 1),
        "average_service_rating": round(avg_rating, 1),
        "total_complaints": sum(m.complaint_count or 0 for m in metrics),
        "total_compliments": sum(m.compliment_count or 0 for m in metrics),
        "daily_metrics": [
            {
                "date": m.metric_date.isoformat(),
                "wait_time": m.average_wait_time,
                "rating": m.service_rating,
                "complaints": m.complaint_count,
                "compliments": m.compliment_count
            }
            for m in metrics
        ]
    }

@app.get("/api/customer-experience/staff/{staff_id}/performance")
async def get_staff_customer_performance(
    staff_id: int,
    days: int = 30,
    db: Session = Depends(get_db)
):
    """Get staff performance from customer perspective"""
    from models import StaffPerformanceMetric
    from datetime import timedelta
    
    since_date = date.today() - timedelta(days=days)
    
    metrics = db.query(StaffPerformanceMetric).filter(
        StaffPerformanceMetric.staff_id == staff_id,
        StaffPerformanceMetric.metric_date >= since_date
    ).all()
    
    if not metrics:
        return {"message": "No performance metrics available"}
    
    return {
        "staff_id": staff_id,
        "period_days": days,
        "average_customer_rating": sum(m.customer_rating or 0 for m in metrics) / len(metrics),
        "total_mentions": sum(m.customer_mentions or 0 for m in metrics),
        "positive_mentions": sum(m.positive_mentions or 0 for m in metrics),
        "negative_mentions": sum(m.negative_mentions or 0 for m in metrics),
        "punctuality_score": sum(m.punctuality_score or 0 for m in metrics) / len(metrics),
        "reliability_score": sum(m.reliability_score or 0 for m in metrics) / len(metrics)
    }

# Notification Service Endpoints
@app.post("/api/notifications/schedule/{draft_id}/send")
async def send_schedule_notifications(
    draft_id: str,
    notification_request: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Send schedule notifications to staff members"""
    
    try:
        notification_service = NotificationService(db)
        
        result = await notification_service.send_schedule_notifications(
            draft_id=draft_id,
            notification_settings=notification_request
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/notifications/schedule/{draft_id}/changes")
async def send_schedule_change_notifications(
    draft_id: str,
    change_request: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Send notifications about schedule changes"""
    
    try:
        notification_service = NotificationService(db)
        
        changes = change_request.get("changes", [])
        notification_settings = change_request.get("notification_settings", {})
        
        result = await notification_service.send_schedule_change_notifications(
            draft_id=draft_id,
            changes=changes,
            notification_settings=notification_settings
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/notifications/schedule/{draft_id}/status")
async def get_notification_status(
    draft_id: str,
    db: Session = Depends(get_db)
):
    """Get notification delivery status for a schedule draft"""
    
    try:
        notification_service = NotificationService(db)
        
        status = await notification_service.get_notification_status(draft_id)
        
        return status
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/notifications/schedule/{draft_id}/retry")
async def retry_failed_notifications(
    draft_id: str,
    retry_request: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db)
):
    """Retry failed notifications for a schedule draft"""
    
    try:
        notification_service = NotificationService(db)
        
        notification_ids = None
        if retry_request:
            notification_ids = retry_request.get("notification_ids")
        
        result = await notification_service.retry_failed_notifications(
            draft_id=draft_id,
            notification_ids=notification_ids
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/notifications/staff/{staff_id}/preferences")
async def get_staff_notification_preferences(
    staff_id: int,
    db: Session = Depends(get_db)
):
    """Get notification preferences for a staff member"""
    
    try:
        # Get staff member
        staff = db.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff member not found")
        
        # For now, return default preferences based on available contact methods
        preferences = {
            "staff_id": staff_id,
            "channels": []
        }
        
        if staff.phone_number:
            preferences["channels"].extend([
                {"channel": "whatsapp", "enabled": True, "priority": 1},
                {"channel": "sms", "enabled": True, "priority": 2}
            ])
        
        if staff.email:
            preferences["channels"].append(
                {"channel": "email", "enabled": True, "priority": 3}
            )
        
        return preferences
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/notifications/templates/{message_type}")
async def get_notification_templates(
    message_type: str,
    business_id: Optional[int] = None
):
    """Get notification message templates"""
    
    templates = {
        "schedule": [
            {
                "name": "Standard Schedule",
                "content": "Hi {staff_name}! Your schedule for {date_range} is ready. You have {shift_count} shifts totaling approximately {total_hours} hours.",
                "variables": ["staff_name", "date_range", "shift_count", "total_hours"],
                "message_type": "schedule"
            },
            {
                "name": "Schedule with Custom Message",
                "content": "Hi {staff_name}! Your schedule for {date_range} is ready.\n\n{shift_details}\n\nManager's note: {custom_message}",
                "variables": ["staff_name", "date_range", "shift_details", "custom_message"],
                "message_type": "schedule"
            }
        ],
        "change": [
            {
                "name": "Schedule Update",
                "content": "Hi {staff_name}! Your schedule has been updated:\n\n{changes}\n\nPlease check your updated schedule.",
                "variables": ["staff_name", "changes"],
                "message_type": "change"
            },
            {
                "name": "Last Minute Change",
                "content": "URGENT: Hi {staff_name}! Last minute schedule change:\n\n{changes}\n\nPlease confirm receipt.",
                "variables": ["staff_name", "changes"],
                "message_type": "change"
            }
        ]
    }
    
    return {
        "templates": templates.get(message_type, []),
        "message_type": message_type
    }

@app.post("/api/notifications/test")
async def test_notification_channels(
    test_request: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Test notification delivery to verify channel configuration"""
    
    try:
        staff_id = test_request.get("staff_id")
        channels = test_request.get("channels", ["whatsapp"])
        test_message = test_request.get("message", "This is a test notification from LocalOps AI.")
        
        if not staff_id:
            raise HTTPException(status_code=400, detail="staff_id is required")
        
        # Get staff member
        staff = db.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff member not found")
        
        notification_service = NotificationService(db)
        
        # Create a test draft for logging purposes
        test_draft_id = f"test-{datetime.now().timestamp()}"
        
        results = await notification_service._send_multi_channel_notification(
            staff=staff,
            message_content=test_message,
            channels=channels,
            draft_id=test_draft_id,
            notification_type="test"
        )
        
        return {
            "success": True,
            "staff_id": staff_id,
            "staff_name": staff.name,
            "channels_tested": channels,
            "results": results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/notifications/webhook/delivery-status")
async def notification_delivery_webhook(
    webhook_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Webhook endpoint for notification delivery status updates from external services"""
    
    try:
        notification_service = NotificationService(db)
        
        # Extract webhook data (format may vary by provider)
        external_id = webhook_data.get("message_id") or webhook_data.get("external_id")
        status = webhook_data.get("status")
        delivered_at_str = webhook_data.get("delivered_at")
        
        if not external_id or not status:
            raise HTTPException(status_code=400, detail="message_id and status are required")
        
        # Parse delivered_at if provided
        delivered_at = None
        if delivered_at_str:
            try:
                delivered_at = datetime.fromisoformat(delivered_at_str.replace('Z', '+00:00'))
            except ValueError:
                logger.warning(f"Invalid delivered_at format: {delivered_at_str}")
        
        # Update notification status
        success = await notification_service.update_delivery_status(
            external_id=external_id,
            status=status,
            delivered_at=delivered_at
        )
        
        if success:
            return {"success": True, "message": "Delivery status updated"}
        else:
            return {"success": False, "message": "Notification not found or invalid status"}
        
    except Exception as e:
        logger.error(f"Webhook processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Staff Preference Management Endpoints
@app.post("/api/staff/{staff_id}/preferences", response_model=StaffPreferenceResponse)
async def create_staff_preference(
    staff_id: int,
    preference: StaffPreferenceCreate,
    db: Session = Depends(get_db)
):
    """Create a new staff preference"""
    from models import StaffPreference
    from datetime import date
    
    # Verify staff exists
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Override staff_id from path parameter
    preference.staff_id = staff_id
    
    # Convert date strings to date objects
    effective_date = None
    expiry_date = None
    if preference.effective_date:
        effective_date = datetime.fromisoformat(preference.effective_date).date()
    if preference.expiry_date:
        expiry_date = datetime.fromisoformat(preference.expiry_date).date()
    
    db_preference = StaffPreference(
        staff_id=staff_id,
        preference_type=preference.preference_type,
        preference_value=preference.preference_value,
        priority=preference.priority,
        effective_date=effective_date,
        expiry_date=expiry_date,
        is_active=True
    )
    
    db.add(db_preference)
    db.commit()
    db.refresh(db_preference)
    
    # Return response with staff name
    return StaffPreferenceResponse(
        id=db_preference.id,
        staff_id=db_preference.staff_id,
        staff_name=staff.name,
        preference_type=db_preference.preference_type,
        preference_value=db_preference.preference_value,
        priority=db_preference.priority,
        effective_date=db_preference.effective_date.isoformat() if db_preference.effective_date else None,
        expiry_date=db_preference.expiry_date.isoformat() if db_preference.expiry_date else None,
        is_active=db_preference.is_active,
        created_at=db_preference.created_at
    )

@app.get("/api/staff/{staff_id}/preferences", response_model=List[StaffPreferenceResponse])
async def get_staff_preferences(
    staff_id: int,
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """Get all preferences for a staff member"""
    from models import StaffPreference
    
    # Verify staff exists
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    query = db.query(StaffPreference).filter(StaffPreference.staff_id == staff_id)
    
    if active_only:
        query = query.filter(StaffPreference.is_active == True)
    
    preferences = query.order_by(StaffPreference.created_at.desc()).all()
    
    # Convert to response format
    result = []
    for pref in preferences:
        result.append(StaffPreferenceResponse(
            id=pref.id,
            staff_id=pref.staff_id,
            staff_name=staff.name,
            preference_type=pref.preference_type,
            preference_value=pref.preference_value,
            priority=pref.priority,
            effective_date=pref.effective_date.isoformat() if pref.effective_date else None,
            expiry_date=pref.expiry_date.isoformat() if pref.expiry_date else None,
            is_active=pref.is_active,
            created_at=pref.created_at
        ))
    
    return result

@app.put("/api/staff/{staff_id}/preferences/{preference_id}", response_model=StaffPreferenceResponse)
async def update_staff_preference(
    staff_id: int,
    preference_id: int,
    preference_update: StaffPreferenceUpdate,
    db: Session = Depends(get_db)
):
    """Update a staff preference"""
    from models import StaffPreference
    from datetime import date
    
    # Verify staff exists
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Get preference
    preference = db.query(StaffPreference).filter(
        StaffPreference.id == preference_id,
        StaffPreference.staff_id == staff_id
    ).first()
    if not preference:
        raise HTTPException(status_code=404, detail="Preference not found")
    
    # Update fields
    if preference_update.preference_value is not None:
        preference.preference_value = preference_update.preference_value
    if preference_update.priority is not None:
        preference.priority = preference_update.priority
    if preference_update.effective_date is not None:
        preference.effective_date = datetime.fromisoformat(preference_update.effective_date).date()
    if preference_update.expiry_date is not None:
        preference.expiry_date = datetime.fromisoformat(preference_update.expiry_date).date()
    if preference_update.is_active is not None:
        preference.is_active = preference_update.is_active
    
    db.commit()
    db.refresh(preference)
    
    return StaffPreferenceResponse(
        id=preference.id,
        staff_id=preference.staff_id,
        staff_name=staff.name,
        preference_type=preference.preference_type,
        preference_value=preference.preference_value,
        priority=preference.priority,
        effective_date=preference.effective_date.isoformat() if preference.effective_date else None,
        expiry_date=preference.expiry_date.isoformat() if preference.expiry_date else None,
        is_active=preference.is_active,
        created_at=preference.created_at
    )

@app.delete("/api/staff/{staff_id}/preferences/{preference_id}")
async def delete_staff_preference(
    staff_id: int,
    preference_id: int,
    db: Session = Depends(get_db)
):
    """Delete a staff preference"""
    from models import StaffPreference
    
    # Verify staff exists
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Get preference
    preference = db.query(StaffPreference).filter(
        StaffPreference.id == preference_id,
        StaffPreference.staff_id == staff_id
    ).first()
    if not preference:
        raise HTTPException(status_code=404, detail="Preference not found")
    
    db.delete(preference)
    db.commit()
    
    return {"status": "success", "message": "Preference deleted successfully"}

# Business Constraint Management Endpoints
@app.post("/api/business/{business_id}/constraints", response_model=SchedulingConstraintResponse)
async def create_scheduling_constraint(
    business_id: int,
    constraint: SchedulingConstraintCreate,
    db: Session = Depends(get_db)
):
    """Create a new scheduling constraint for a business"""
    from models import SchedulingConstraint
    
    # Verify business exists
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Override business_id from path parameter
    constraint.business_id = business_id
    
    db_constraint = SchedulingConstraint(
        business_id=business_id,
        constraint_type=constraint.constraint_type,
        constraint_value=constraint.constraint_value,
        priority=constraint.priority,
        is_active=True
    )
    
    db.add(db_constraint)
    db.commit()
    db.refresh(db_constraint)
    
    return db_constraint

@app.get("/api/business/{business_id}/constraints", response_model=List[SchedulingConstraintResponse])
async def get_scheduling_constraints(
    business_id: int,
    active_only: bool = True,
    constraint_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all scheduling constraints for a business"""
    from models import SchedulingConstraint
    
    # Verify business exists
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    query = db.query(SchedulingConstraint).filter(SchedulingConstraint.business_id == business_id)
    
    if active_only:
        query = query.filter(SchedulingConstraint.is_active == True)
    
    if constraint_type:
        query = query.filter(SchedulingConstraint.constraint_type == constraint_type)
    
    constraints = query.order_by(SchedulingConstraint.created_at.desc()).all()
    
    return constraints

@app.put("/api/business/{business_id}/constraints/{constraint_id}", response_model=SchedulingConstraintResponse)
async def update_scheduling_constraint(
    business_id: int,
    constraint_id: int,
    constraint_update: SchedulingConstraintUpdate,
    db: Session = Depends(get_db)
):
    """Update a scheduling constraint"""
    from models import SchedulingConstraint
    
    # Verify business exists
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Get constraint
    constraint = db.query(SchedulingConstraint).filter(
        SchedulingConstraint.id == constraint_id,
        SchedulingConstraint.business_id == business_id
    ).first()
    if not constraint:
        raise HTTPException(status_code=404, detail="Constraint not found")
    
    # Update fields
    if constraint_update.constraint_value is not None:
        constraint.constraint_value = constraint_update.constraint_value
    if constraint_update.priority is not None:
        constraint.priority = constraint_update.priority
    if constraint_update.is_active is not None:
        constraint.is_active = constraint_update.is_active
    
    db.commit()
    db.refresh(constraint)
    
    return constraint

@app.delete("/api/business/{business_id}/constraints/{constraint_id}")
async def delete_scheduling_constraint(
    business_id: int,
    constraint_id: int,
    db: Session = Depends(get_db)
):
    """Delete a scheduling constraint"""
    from models import SchedulingConstraint
    
    # Verify business exists
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Get constraint
    constraint = db.query(SchedulingConstraint).filter(
        SchedulingConstraint.id == constraint_id,
        SchedulingConstraint.business_id == business_id
    ).first()
    if not constraint:
        raise HTTPException(status_code=404, detail="Constraint not found")
    
    db.delete(constraint)
    db.commit()
    
    return {"status": "success", "message": "Constraint deleted successfully"}

# Constraint Validation Endpoint
@app.post("/api/business/{business_id}/validate-constraints", response_model=ConstraintValidationResponse)
async def validate_scheduling_constraints(
    business_id: int,
    validation_request: ConstraintValidationRequest,
    db: Session = Depends(get_db)
):
    """Validate schedule assignments against business constraints and staff preferences"""
    from models import SchedulingConstraint, StaffPreference
    from services.constraint_solver import ConstraintSolver
    
    # Verify business exists
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Get active constraints
    constraints = db.query(SchedulingConstraint).filter(
        SchedulingConstraint.business_id == business_id,
        SchedulingConstraint.is_active == True
    ).all()
    
    # Get staff preferences for affected staff
    staff_ids = [assignment.get("staff_id") for assignment in validation_request.assignments if assignment.get("staff_id")]
    preferences = db.query(StaffPreference).filter(
        StaffPreference.staff_id.in_(staff_ids),
        StaffPreference.is_active == True
    ).all() if staff_ids else []
    
    # Initialize constraint solver
    constraint_solver = ConstraintSolver(db)
    
    # Validate constraints
    violations = []
    warnings = []
    
    try:
        validation_result = constraint_solver.validate_assignments(
            validation_request.assignments,
            constraints,
            preferences
        )
        
        violations = validation_result.get("violations", [])
        warnings = validation_result.get("warnings", [])
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Constraint validation failed: {str(e)}")
    
    return ConstraintValidationResponse(
        valid=len(violations) == 0,
        violations=violations,
        warnings=warnings,
        total_violations=len(violations),
        total_warnings=len(warnings)
    )

# Conflict Resolution Endpoint
@app.post("/api/business/{business_id}/resolve-conflicts")
async def resolve_scheduling_conflicts(
    business_id: int,
    request: ConstraintValidationRequest,
    db: Session = Depends(get_db)
):
    """Resolve scheduling conflicts based on constraint priorities and business rules"""
    
    from models import SchedulingConstraint, StaffPreference, DraftShiftAssignment
    from services.constraint_solver import ConstraintSolver, SchedulingContext
    from datetime import date, timedelta
    
    try:
        # Verify business exists
        business = db.query(Business).filter(Business.id == business_id).first()
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")
        
        # Get business constraints
        constraints = db.query(SchedulingConstraint).filter(
            SchedulingConstraint.business_id == business_id,
            SchedulingConstraint.is_active == True
        ).all()
        
        # Get staff preferences
        staff_ids = [assignment.get("staff_id") for assignment in request.assignments if assignment.get("staff_id")]
        staff_preferences = db.query(StaffPreference).filter(
            StaffPreference.staff_id.in_(staff_ids),
            StaffPreference.is_active == True
        ).all() if staff_ids else []
        
        # Create scheduling context
        context = SchedulingContext(
            business_id=business_id,
            constraints=constraints,
            staff_preferences=staff_preferences,
            date_range_start=date.today(),
            date_range_end=date.today() + timedelta(days=7)
        )
        
        # Initialize constraint solver
        solver = ConstraintSolver(db)
        
        # First, validate current assignments to find violations
        validation_result = solver.validate_assignments_against_constraints(
            request.assignments,
            constraints,
            staff_preferences,
            []
        )
        
        violations = validation_result.get("violations", [])
        
        if not violations:
            return {
                "status": "no_conflicts",
                "resolution_strategy": "none",
                "recommendations": [],
                "updated_assignments": request.assignments,
                "violation_summary": {
                    "critical": 0,
                    "high": 0,
                    "medium": 0,
                    "low": 0
                }
            }
        
        # Resolve conflicts
        resolution_result = solver.resolve_constraint_conflicts(violations, context)
        
        # Apply conflict resolution if we have draft assignments
        updated_assignments = request.assignments
        if hasattr(request, 'draft_id') and request.draft_id:
            # Get draft assignments
            draft_assignments = db.query(DraftShiftAssignment).filter(
                DraftShiftAssignment.draft_id == request.draft_id
            ).all()
            
            if draft_assignments:
                resolved_assignments = solver.apply_conflict_resolution(
                    draft_assignments,
                    resolution_result["resolution_strategy"],
                    resolution_result["recommendations"],
                    context
                )
                
                # Convert back to assignment format
                updated_assignments = [
                    {
                        "staff_id": a.staff_id,
                        "shift_id": a.shift_id,
                        "confidence_score": a.confidence_score
                    }
                    for a in resolved_assignments
                ]
        
        return {
            "status": resolution_result["status"],
            "resolution_strategy": resolution_result["resolution_strategy"],
            "recommendations": resolution_result["recommendations"],
            "updated_assignments": updated_assignments,
            "violation_summary": resolution_result["violation_summary"]
        }
        
    except Exception as e:
        logger.error(f"Error resolving scheduling conflicts: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to resolve scheduling conflicts: {str(e)}"
        )

# In-App Notification Endpoints
@app.get("/api/notifications/{staff_id}")
async def get_staff_notifications(
    staff_id: int,
    unread_only: bool = False,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Get in-app notifications for a staff member"""
    app_notification_service = AppNotificationService(db)
    notifications = await app_notification_service.get_staff_notifications(
        staff_id, unread_only, limit
    )
    return notifications

@app.post("/api/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    staff_id: int,
    db: Session = Depends(get_db)
):
    """Mark a notification as read"""
    app_notification_service = AppNotificationService(db)
    success = await app_notification_service.mark_notification_read(
        notification_id, staff_id
    )
    return {"success": success, "notification_id": notification_id}

@app.post("/api/notifications/{notification_id}/respond")
async def respond_to_notification(
    notification_id: int,
    response_data: dict,
    db: Session = Depends(get_db)
):
    """Respond to a replacement request notification"""
    app_notification_service = AppNotificationService(db)
    result = await app_notification_service.respond_to_replacement_request(
        notification_id=notification_id,
        staff_id=response_data["staff_id"],
        response=response_data["response"],  # "accept", "decline", "maybe"
        message=response_data.get("message")
    )
    return result

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)