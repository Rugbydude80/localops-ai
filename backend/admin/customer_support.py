"""
Customer Support Service for Platform Owner Admin
Handles universal support ticket management across all workspaces
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from pydantic import BaseModel

from database import get_db
from models import SupportTicket, SupportTicketResponse, Business, Staff, AuditLog
from shared.authentication import require_platform_admin, get_current_user
from shared.audit_logging import AuditLogger

router = APIRouter(prefix="/api/platform/support", tags=["Customer Support"])

# Pydantic models for API responses
class SupportTicketSummary(BaseModel):
    id: int
    workspace_id: int
    workspace_name: str
    subject: str
    priority: str
    status: str
    created_at: datetime
    updated_at: datetime
    user_name: str
    assigned_to_name: Optional[str]
    response_count: int
    last_response_at: Optional[datetime]

class SupportTicketDetail(BaseModel):
    id: int
    workspace_id: int
    workspace_name: str
    user_id: int
    user_name: str
    subject: str
    description: str
    priority: str
    status: str
    assigned_to: Optional[int]
    assigned_to_name: Optional[str]
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]
    responses: List[Dict[str, Any]]

class SupportAnalytics(BaseModel):
    total_tickets: int
    open_tickets: int
    resolved_tickets: int
    avg_response_time_hours: float
    avg_resolution_time_hours: float
    tickets_by_priority: Dict[str, int]
    tickets_by_status: Dict[str, int]
    tickets_by_workspace: List[Dict[str, Any]]

class CustomerSupportService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_logger = AuditLogger(db)
    
    def get_all_tickets(
        self,
        page: int = 1,
        limit: int = 50,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        workspace_id: Optional[int] = None,
        assigned_to: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get all support tickets with filtering and pagination"""
        try:
            query = self.db.query(SupportTicket)
            
            # Apply filters
            if status:
                query = query.filter(SupportTicket.status == status)
            
            if priority:
                query = query.filter(SupportTicket.priority == priority)
            
            if workspace_id:
                query = query.filter(SupportTicket.workspace_id == workspace_id)
            
            if assigned_to:
                query = query.filter(SupportTicket.assigned_to == assigned_to)
            
            # Get total count
            total = query.count()
            
            # Apply pagination
            offset = (page - 1) * limit
            tickets = query.order_by(SupportTicket.created_at.desc()).offset(offset).limit(limit).all()
            
            # Enrich with additional data
            ticket_summaries = []
            for ticket in tickets:
                # Get workspace name
                workspace = self.db.query(Business).filter(Business.id == ticket.workspace_id).first()
                workspace_name = workspace.name if workspace else "Unknown Workspace"
                
                # Get user name
                user = self.db.query(Staff).filter(Staff.id == ticket.user_id).first()
                user_name = user.name if user else "Unknown User"
                
                # Get assigned to name
                assigned_to_name = None
                if ticket.assigned_to:
                    assigned_user = self.db.query(Staff).filter(Staff.id == ticket.assigned_to).first()
                    assigned_to_name = assigned_user.name if assigned_user else "Unknown"
                
                # Get response count
                response_count = self.db.query(SupportTicketResponse).filter(
                    SupportTicketResponse.ticket_id == ticket.id
                ).count()
                
                # Get last response time
                last_response = self.db.query(SupportTicketResponse).filter(
                    SupportTicketResponse.ticket_id == ticket.id
                ).order_by(SupportTicketResponse.created_at.desc()).first()
                
                last_response_at = last_response.created_at if last_response else None
                
                ticket_summaries.append(SupportTicketSummary(
                    id=ticket.id,
                    workspace_id=ticket.workspace_id,
                    workspace_name=workspace_name,
                    subject=ticket.subject,
                    priority=ticket.priority,
                    status=ticket.status,
                    created_at=ticket.created_at,
                    updated_at=ticket.updated_at,
                    user_name=user_name,
                    assigned_to_name=assigned_to_name,
                    response_count=response_count,
                    last_response_at=last_response_at
                ))
            
            return {
                "tickets": ticket_summaries,
                "total": total,
                "page": page,
                "limit": limit,
                "total_pages": (total + limit - 1) // limit
            }
            
        except Exception as e:
            self.audit_logger.log_error("get_support_tickets", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get support tickets"
            )
    
    def get_ticket_detail(self, ticket_id: int) -> SupportTicketDetail:
        """Get detailed information about a specific ticket"""
        try:
            ticket = self.db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
            
            if not ticket:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Ticket not found"
                )
            
            # Get workspace name
            workspace = self.db.query(Business).filter(Business.id == ticket.workspace_id).first()
            workspace_name = workspace.name if workspace else "Unknown Workspace"
            
            # Get user name
            user = self.db.query(Staff).filter(Staff.id == ticket.user_id).first()
            user_name = user.name if user else "Unknown User"
            
            # Get assigned to name
            assigned_to_name = None
            if ticket.assigned_to:
                assigned_user = self.db.query(Staff).filter(Staff.id == ticket.assigned_to).first()
                assigned_to_name = assigned_user.name if assigned_user else "Unknown"
            
            # Get responses
            responses = self.db.query(SupportTicketResponse).filter(
                SupportTicketResponse.ticket_id == ticket.id
            ).order_by(SupportTicketResponse.created_at.asc()).all()
            
            response_data = []
            for response in responses:
                responder = self.db.query(Staff).filter(Staff.id == response.user_id).first()
                response_data.append({
                    'id': response.id,
                    'user_id': response.user_id,
                    'user_name': responder.name if responder else "Unknown",
                    'response': response.response,
                    'is_internal': response.is_internal,
                    'created_at': response.created_at.isoformat()
                })
            
            return SupportTicketDetail(
                id=ticket.id,
                workspace_id=ticket.workspace_id,
                workspace_name=workspace_name,
                user_id=ticket.user_id,
                user_name=user_name,
                subject=ticket.subject,
                description=ticket.description,
                priority=ticket.priority,
                status=ticket.status,
                assigned_to=ticket.assigned_to,
                assigned_to_name=assigned_to_name,
                created_at=ticket.created_at,
                updated_at=ticket.updated_at,
                resolved_at=ticket.resolved_at,
                responses=response_data
            )
            
        except HTTPException:
            raise
        except Exception as e:
            self.audit_logger.log_error("get_ticket_detail", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get ticket details"
            )
    
    def update_ticket_status(
        self,
        ticket_id: int,
        status: str,
        assigned_to: Optional[int],
        user_id: int
    ) -> Dict[str, Any]:
        """Update ticket status and assignment"""
        try:
            ticket = self.db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
            
            if not ticket:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Ticket not found"
                )
            
            valid_statuses = ['open', 'in_progress', 'resolved', 'closed']
            if status not in valid_statuses:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status. Must be one of: {valid_statuses}"
                )
            
            old_status = ticket.status
            old_assigned_to = ticket.assigned_to
            
            ticket.status = status
            ticket.assigned_to = assigned_to
            ticket.updated_at = datetime.utcnow()
            
            if status == 'resolved':
                ticket.resolved_at = datetime.utcnow()
            
            self.db.commit()
            
            # Log the action
            self.audit_logger.log_platform_action(
                user_id=user_id,
                user_email="",  # Would get from user lookup
                action="update_ticket_status",
                resource_type="support_ticket",
                resource_id=str(ticket_id),
                details={
                    "old_status": old_status,
                    "new_status": status,
                    "old_assigned_to": old_assigned_to,
                    "new_assigned_to": assigned_to
                }
            )
            
            return {
                "success": True,
                "ticket_id": ticket_id,
                "status": status,
                "assigned_to": assigned_to,
                "message": f"Ticket status updated to {status}"
            }
            
        except HTTPException:
            raise
        except Exception as e:
            self.audit_logger.log_error("update_ticket_status", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update ticket status"
            )
    
    def add_ticket_response(
        self,
        ticket_id: int,
        response: str,
        is_internal: bool,
        user_id: int
    ) -> Dict[str, Any]:
        """Add a response to a support ticket"""
        try:
            ticket = self.db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
            
            if not ticket:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Ticket not found"
                )
            
            # Create response
            ticket_response = SupportTicketResponse(
                ticket_id=ticket_id,
                user_id=user_id,
                response=response,
                is_internal=is_internal
            )
            
            self.db.add(ticket_response)
            
            # Update ticket
            ticket.updated_at = datetime.utcnow()
            self.db.commit()
            
            # Log the action
            self.audit_logger.log_platform_action(
                user_id=user_id,
                user_email="",  # Would get from user lookup
                action="add_ticket_response",
                resource_type="support_ticket",
                resource_id=str(ticket_id),
                details={
                    "response_length": len(response),
                    "is_internal": is_internal
                }
            )
            
            return {
                "success": True,
                "ticket_id": ticket_id,
                "response_id": ticket_response.id,
                "message": "Response added successfully"
            }
            
        except HTTPException:
            raise
        except Exception as e:
            self.audit_logger.log_error("add_ticket_response", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add ticket response"
            )
    
    def get_support_analytics(self, days: int = 30) -> SupportAnalytics:
        """Get support analytics and metrics"""
        try:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)
            
            # Get tickets in date range
            tickets = self.db.query(SupportTicket).filter(
                SupportTicket.created_at >= start_date
            ).all()
            
            total_tickets = len(tickets)
            open_tickets = sum(1 for t in tickets if t.status in ['open', 'in_progress'])
            resolved_tickets = sum(1 for t in tickets if t.status == 'resolved')
            
            # Calculate average response time
            response_times = []
            for ticket in tickets:
                first_response = self.db.query(SupportTicketResponse).filter(
                    SupportTicketResponse.ticket_id == ticket.id
                ).order_by(SupportTicketResponse.created_at.asc()).first()
                
                if first_response:
                    response_time = (first_response.created_at - ticket.created_at).total_seconds() / 3600
                    response_times.append(response_time)
            
            avg_response_time_hours = sum(response_times) / len(response_times) if response_times else 0
            
            # Calculate average resolution time
            resolution_times = []
            for ticket in tickets:
                if ticket.resolved_at:
                    resolution_time = (ticket.resolved_at - ticket.created_at).total_seconds() / 3600
                    resolution_times.append(resolution_time)
            
            avg_resolution_time_hours = sum(resolution_times) / len(resolution_times) if resolution_times else 0
            
            # Tickets by priority
            tickets_by_priority = {}
            for ticket in tickets:
                priority = ticket.priority
                tickets_by_priority[priority] = tickets_by_priority.get(priority, 0) + 1
            
            # Tickets by status
            tickets_by_status = {}
            for ticket in tickets:
                status = ticket.status
                tickets_by_status[status] = tickets_by_status.get(status, 0) + 1
            
            # Tickets by workspace
            workspace_tickets = {}
            for ticket in tickets:
                workspace_id = ticket.workspace_id
                if workspace_id not in workspace_tickets:
                    workspace = self.db.query(Business).filter(Business.id == workspace_id).first()
                    workspace_name = workspace.name if workspace else "Unknown"
                    workspace_tickets[workspace_id] = {
                        'workspace_id': workspace_id,
                        'workspace_name': workspace_name,
                        'ticket_count': 0
                    }
                workspace_tickets[workspace_id]['ticket_count'] += 1
            
            tickets_by_workspace = list(workspace_tickets.values())
            tickets_by_workspace.sort(key=lambda x: x['ticket_count'], reverse=True)
            
            return SupportAnalytics(
                total_tickets=total_tickets,
                open_tickets=open_tickets,
                resolved_tickets=resolved_tickets,
                avg_response_time_hours=round(avg_response_time_hours, 2),
                avg_resolution_time_hours=round(avg_resolution_time_hours, 2),
                tickets_by_priority=tickets_by_priority,
                tickets_by_status=tickets_by_status,
                tickets_by_workspace=tickets_by_workspace
            )
            
        except Exception as e:
            self.audit_logger.log_error("support_analytics", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get support analytics"
            )
    
    def impersonate_user(self, user_id: int, workspace_id: int, reason: str, admin_id: int) -> Dict[str, Any]:
        """Impersonate a user for troubleshooting"""
        try:
            # Verify user exists and belongs to workspace
            user = self.db.query(Staff).filter(
                Staff.id == user_id,
                Staff.business_id == workspace_id
            ).first()
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found in workspace"
                )
            
            # Create impersonation log
            # This would use the UserImpersonationLog model
            # For demo purposes, just logging the action
            
            # Log the action
            self.audit_logger.log_platform_action(
                user_id=admin_id,
                user_email="",  # Would get from user lookup
                action="impersonate_user",
                resource_type="user",
                resource_id=str(user_id),
                details={
                    "target_user_id": user_id,
                    "workspace_id": workspace_id,
                    "reason": reason
                }
            )
            
            # In production, this would:
            # 1. Create impersonation session
            # 2. Generate temporary access token
            # 3. Log the impersonation start
            
            return {
                "success": True,
                "user_id": user_id,
                "workspace_id": workspace_id,
                "user_name": user.name,
                "impersonation_token": "temp_token_12345",  # Would be real token
                "expires_at": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
                "message": f"Impersonation started for {user.name}"
            }
            
        except HTTPException:
            raise
        except Exception as e:
            self.audit_logger.log_error("impersonate_user", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to impersonate user"
            )

# API endpoints
@router.get("/tickets", response_model=Dict[str, Any])
def get_all_tickets(
    page: int = 1,
    limit: int = 50,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    workspace_id: Optional[int] = None,
    assigned_to: Optional[int] = None,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get all support tickets with filtering and pagination"""
    service = CustomerSupportService(db)
    return service.get_all_tickets(page, limit, status, priority, workspace_id, assigned_to)

@router.get("/tickets/{ticket_id}", response_model=SupportTicketDetail)
def get_ticket_detail(
    ticket_id: int,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific ticket"""
    service = CustomerSupportService(db)
    return service.get_ticket_detail(ticket_id)

@router.put("/tickets/{ticket_id}/status")
def update_ticket_status(
    ticket_id: int,
    status: str,
    assigned_to: Optional[int] = None,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Update ticket status and assignment"""
    service = CustomerSupportService(db)
    return service.update_ticket_status(ticket_id, status, assigned_to, current_user.id)

@router.post("/tickets/{ticket_id}/responses")
def add_ticket_response(
    ticket_id: int,
    response: str,
    is_internal: bool = False,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Add a response to a support ticket"""
    service = CustomerSupportService(db)
    return service.add_ticket_response(ticket_id, response, is_internal, current_user.id)

@router.get("/analytics", response_model=SupportAnalytics)
def get_support_analytics(
    days: int = 30,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get support analytics and metrics"""
    service = CustomerSupportService(db)
    return service.get_support_analytics(days)

@router.post("/impersonate")
def impersonate_user(
    user_id: int,
    workspace_id: int,
    reason: str,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Impersonate a user for troubleshooting"""
    service = CustomerSupportService(db)
    return service.impersonate_user(user_id, workspace_id, reason, current_user.id) 