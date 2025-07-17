from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import uvicorn
from datetime import datetime, timedelta
from typing import List, Optional
import os

from database import get_db, engine, Base
from models import Business, Staff, EmergencyRequest, ShiftCoverage, Shift, ShiftAssignment, SickLeaveRequest, MessageLog
from schemas import (
    StaffCreate, StaffResponse, EmergencyRequestCreate, 
    EmergencyRequestResponse, ShiftCoverageCreate, ShiftCreate, ShiftResponse,
    ShiftAssignmentCreate, ShiftAssignmentResponse, SickLeaveRequestCreate,
    SickLeaveRequestResponse, CalendarView, WeeklySchedule
)
from services.messaging import WhatsAppService
from services.ai import AIService
from services.predictive_scheduling import PredictiveScheduler
from services.smart_communication import SmartCommunicationHub
from services.training_manager import TrainingManager
from services.business_intelligence import BusinessIntelligenceService
from services.inventory_intelligence import InventoryIntelligence

# Tables already exist in Supabase, so we don't need to create them
# Base.metadata.create_all(bind=engine)

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
@app.post("/api/shifts", response_model=ShiftResponse)
async def create_shift(
    shift: ShiftCreate,
    db: Session = Depends(get_db)
):
    """Create a new shift"""
    db_shift = Shift(
        business_id=shift.business_id,
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

@app.post("/api/shift-assignments", response_model=ShiftAssignmentResponse)
async def assign_staff_to_shift(
    assignment: ShiftAssignmentCreate,
    db: Session = Depends(get_db)
):
    """Assign staff member to a shift"""
    
    # Check if shift exists
    shift = db.query(Shift).filter(Shift.id == assignment.shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    # Check if staff exists and has required skill
    staff = db.query(Staff).filter(Staff.id == assignment.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    if shift.required_skill not in staff.skills:
        raise HTTPException(
            status_code=400, 
            detail=f"Staff member does not have required skill: {shift.required_skill}"
        )
    
    # Check if already assigned
    existing = db.query(ShiftAssignment).filter(
        ShiftAssignment.shift_id == assignment.shift_id,
        ShiftAssignment.staff_id == assignment.staff_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Staff already assigned to this shift")
    
    # Create assignment
    db_assignment = ShiftAssignment(
        shift_id=assignment.shift_id,
        staff_id=assignment.staff_id,
        status="assigned"
    )
    db.add(db_assignment)
    
    # Update shift status if fully staffed
    current_assignments = db.query(ShiftAssignment).filter(
        ShiftAssignment.shift_id == assignment.shift_id
    ).count()
    
    if current_assignments + 1 >= shift.required_staff_count:
        shift.status = "filled"
    
    db.commit()
    db.refresh(db_assignment)
    return db_assignment

@app.post("/api/sick-leave", response_model=SickLeaveRequestResponse)
async def report_sick_leave(
    sick_leave: SickLeaveRequestCreate,
    db: Session = Depends(get_db)
):
    """Report sick leave and trigger replacement search with WhatsApp notifications"""
    
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
    
    # Find replacement staff with same skill
    qualified_staff = db.query(Staff).filter(
        Staff.business_id == sick_leave.business_id,
        Staff.is_active == True,
        Staff.skills.contains([shift.required_skill]),
        Staff.id != sick_leave.staff_id  # Exclude the sick staff member
    ).all()
    
    message_results = []
    
    if qualified_staff:
        # Create emergency request for replacement
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
        
        # Generate AI message for sick leave replacement
        ai_message = await ai_service.generate_coverage_message(
            business_name="Demo Restaurant",
            shift_date=shift.date,
            shift_start=shift.start_time,
            shift_end=shift.end_time,
            required_skill=shift.required_skill,
            urgency="high",
            custom_message=f"URGENT: {staff.name} called in sick. Need immediate replacement for {shift.title}."
        )
        
        # Send WhatsApp messages to qualified staff
        for qualified_staff_member in qualified_staff:
            try:
                result = await whatsapp_service.send_coverage_request(
                    phone_number=qualified_staff_member.phone_number,
                    staff_name=qualified_staff_member.name,
                    message=ai_message,
                    request_id=emergency_request.id
                )
                
                # Log the message
                message_log = MessageLog(
                    business_id=sick_leave.business_id,
                    staff_id=qualified_staff_member.id,
                    request_id=emergency_request.id,
                    message_type="sick_leave_replacement",
                    platform="whatsapp",
                    phone_number=qualified_staff_member.phone_number,
                    message_content=f"URGENT: {staff.name} called in sick. Need replacement for {shift.title} on {shift.date.strftime('%Y-%m-%d')} {shift.start_time}-{shift.end_time}. Can you cover?",
                    external_message_id=result.get("message_id"),
                    status="sent" if result.get("success") else "failed"
                )
                db.add(message_log)
                
                message_results.append({
                    "staff_id": qualified_staff_member.id,
                    "staff_name": qualified_staff_member.name,
                    "phone": qualified_staff_member.phone_number,
                    "sent": result.get("success", False),
                    "message_id": result.get("message_id")
                })
                
            except Exception as e:
                print(f"Failed to send message to {qualified_staff_member.name}: {e}")
                message_results.append({
                    "staff_id": qualified_staff_member.id,
                    "staff_name": qualified_staff_member.name,
                    "phone": qualified_staff_member.phone_number,
                    "sent": False,
                    "error": str(e)
                })
        
        db.commit()
    
    # Return enhanced response with messaging details
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
        "qualified_staff_count": len(qualified_staff),
        "messages_sent": len([r for r in message_results if r.get("sent")]),
        "message_results": message_results
    }

@app.get("/api/calendar/{business_id}")
async def get_calendar_view(
    business_id: int,
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db)
):
    """Get calendar view with shifts for date range"""
    
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)
    
    shifts = db.query(Shift).filter(
        Shift.business_id == business_id,
        Shift.date >= start,
        Shift.date <= end
    ).order_by(Shift.date, Shift.start_time).all()
    
    # Group shifts by date
    calendar_data = {}
    current_date = start
    
    while current_date <= end:
        date_str = current_date.strftime('%Y-%m-%d')
        day_shifts = [s for s in shifts if s.date.date() == current_date.date()]
        
        # Get assignment details for each shift
        detailed_shifts = []
        for shift in day_shifts:
            assignments = db.query(ShiftAssignment).filter(
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
                "assignments": []
            }
            
            for assignment in assignments:
                staff = db.query(Staff).filter(Staff.id == assignment.staff_id).first()
                if staff:
                    shift_data["assignments"].append({
                        "staff_id": assignment.staff_id,
                        "staff_name": staff.name,
                        "status": assignment.status
                    })
            
            detailed_shifts.append(shift_data)
        
        calendar_data[date_str] = {
            "date": date_str,
            "shifts": detailed_shifts,
            "total_shifts": len(day_shifts),
            "filled_shifts": len([s for s in day_shifts if s.status == "filled"]),
            "understaffed_shifts": len([s for s in day_shifts if s.status == "understaffed"])
        }
        
        current_date += timedelta(days=1)
    
    return calendar_data

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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)