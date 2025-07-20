"""
Team Management Service for Workspace Admin
Handles workspace-specific team management, user invitations, and role assignments
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc
from pydantic import BaseModel

from database import get_db
from models import Staff, Business
from shared.authentication import require_workspace_admin, get_current_user
from shared.audit_logging import AuditLogger

router = APIRouter(prefix="/api/workspace/{workspace_id}/team", tags=["Team Management"])

# Pydantic models for API responses
class TeamMember(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    user_role: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime]
    activity_score: float
    permissions: List[str]

class TeamInvitation(BaseModel):
    email: str
    user_role: str
    invited_by: str
    invited_at: datetime
    expires_at: datetime
    status: str  # pending, accepted, expired

class TeamAnalytics(BaseModel):
    total_members: int
    active_members: int
    members_by_role: Dict[str, int]
    recent_activity: List[Dict[str, Any]]
    team_health_score: float
    average_activity_score: float

class TeamManagementService:
    def __init__(self, db: Session, workspace_id: str):
        self.db = db
        self.workspace_id = workspace_id
        self.audit_logger = AuditLogger(db)
    
    def get_team_members(
        self,
        page: int = 1,
        limit: int = 50,
        search: Optional[str] = None,
        user_role: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> Dict[str, Any]:
        """Get workspace team members with filtering and pagination"""
        query = self.db.query(Staff).filter(Staff.business_id == self.workspace_id)
        
        # Apply filters
        if search:
            query = query.filter(
                or_(
                    Staff.email.ilike(f"%{search}%"),
                    Staff.first_name.ilike(f"%{search}%"),
                    Staff.last_name.ilike(f"%{search}%")
                )
            )
        
        if user_role:
            query = query.filter(Staff.user_role == user_role)
        
        if is_active is not None:
            query = query.filter(Staff.is_active == is_active)
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        offset = (page - 1) * limit
        members = query.offset(offset).limit(limit).all()
        
        # Enrich with additional data
        member_summaries = []
        for member in members:
            # Get permissions based on role
            permissions = self._get_role_permissions(member.user_role)
            
            # Calculate activity score
            activity_score = self._calculate_member_activity_score(member.id)
            
            # Get last login (simplified)
            last_login = None  # Would integrate with actual login tracking
            
            member_summaries.append(TeamMember(
                id=member.id,
                email=member.email,
                first_name=member.first_name,
                last_name=member.last_name,
                user_role=member.user_role,
                is_active=member.is_active,
                created_at=member.created_at,
                last_login=last_login,
                activity_score=activity_score,
                permissions=permissions
            ))
        
        return {
            "members": member_summaries,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit
        }
    
    def invite_team_member(
        self,
        email: str,
        user_role: str,
        invited_by_user_id: int
    ) -> Dict[str, Any]:
        """Invite a new team member"""
        # Check if user already exists in workspace
        existing_member = self.db.query(Staff).filter(
            Staff.email == email,
            Staff.business_id == self.workspace_id
        ).first()
        
        if existing_member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member of this workspace"
            )
        
        # Validate role
        valid_roles = ["admin", "manager", "supervisor", "staff"]
        if user_role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
            )
        
        # Create invitation (simplified - would integrate with email service)
        invitation = {
            "email": email,
            "user_role": user_role,
            "invited_by": "Admin User",  # Would get from user lookup
            "invited_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(days=7),
            "status": "pending"
        }
        
        # Log the invitation
        self.audit_logger.log_workspace_action(
            user_id=invited_by_user_id,
            user_email="",
            action="team_member_invited",
            resource_type="team_member",
            resource_id=email,
            details={
                "email": email,
                "role": user_role,
                "workspace_id": self.workspace_id
            },
            workspace_id=self.workspace_id
        )
        
        return {
            "message": "Team member invitation sent successfully",
            "invitation": invitation
        }
    
    def update_member_role(
        self,
        member_id: int,
        new_role: str,
        updated_by_user_id: int
    ) -> Dict[str, Any]:
        """Update team member role"""
        member = self.db.query(Staff).filter(
            Staff.id == member_id,
            Staff.business_id == self.workspace_id
        ).first()
        
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Team member not found"
            )
        
        # Validate role
        valid_roles = ["admin", "manager", "supervisor", "staff"]
        if new_role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
            )
        
        old_role = member.user_role
        member.user_role = new_role
        
        # Log the change
        self.audit_logger.log_workspace_action(
            user_id=updated_by_user_id,
            user_email="",
            action="member_role_updated",
            resource_type="team_member",
            resource_id=str(member_id),
            details={
                "old_role": old_role,
                "new_role": new_role,
                "member_email": member.email
            },
            workspace_id=self.workspace_id
        )
        
        self.db.commit()
        
        return {
            "message": "Team member role updated successfully",
            "member_id": member_id,
            "old_role": old_role,
            "new_role": new_role
        }
    
    def deactivate_member(
        self,
        member_id: int,
        deactivated_by_user_id: int
    ) -> Dict[str, Any]:
        """Deactivate a team member"""
        member = self.db.query(Staff).filter(
            Staff.id == member_id,
            Staff.business_id == self.workspace_id
        ).first()
        
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Team member not found"
            )
        
        if not member.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Team member is already deactivated"
            )
        
        member.is_active = False
        
        # Log the deactivation
        self.audit_logger.log_workspace_action(
            user_id=deactivated_by_user_id,
            user_email="",
            action="member_deactivated",
            resource_type="team_member",
            resource_id=str(member_id),
            details={"member_email": member.email},
            workspace_id=self.workspace_id
        )
        
        self.db.commit()
        
        return {
            "message": "Team member deactivated successfully",
            "member_id": member_id,
            "member_email": member.email
        }
    
    def get_team_analytics(self) -> TeamAnalytics:
        """Get team analytics"""
        # Total members
        total_members = self.db.query(Staff).filter(
            Staff.business_id == self.workspace_id
        ).count()
        
        active_members = self.db.query(Staff).filter(
            Staff.business_id == self.workspace_id,
            Staff.is_active == True
        ).count()
        
        # Members by role
        role_counts = self.db.query(
            Staff.user_role,
            func.count(Staff.id).label('count')
        ).filter(
            Staff.business_id == self.workspace_id
        ).group_by(Staff.user_role).all()
        
        members_by_role = {role: count for role, count in role_counts}
        
        # Recent activity (simplified)
        recent_activity = self._get_recent_team_activity()
        
        # Team health score
        team_health_score = self._calculate_team_health_score()
        
        # Average activity score
        average_activity_score = self._calculate_average_activity_score()
        
        return TeamAnalytics(
            total_members=total_members,
            active_members=active_members,
            members_by_role=members_by_role,
            recent_activity=recent_activity,
            team_health_score=team_health_score,
            average_activity_score=average_activity_score
        )
    
    def _get_role_permissions(self, user_role: str) -> List[str]:
        """Get permissions for a given role"""
        permissions_map = {
            "admin": ["read", "write", "delete", "manage_team", "manage_settings", "view_analytics"],
            "manager": ["read", "write", "manage_team", "view_analytics"],
            "supervisor": ["read", "write", "view_analytics"],
            "staff": ["read", "write"]
        }
        return permissions_map.get(user_role, ["read"])
    
    def _calculate_member_activity_score(self, member_id: int) -> float:
        """Calculate activity score for a team member"""
        # This would integrate with actual activity tracking
        # For now, return a random score between 0 and 100
        import random
        return round(random.uniform(0, 100), 1)
    
    def _get_recent_team_activity(self) -> List[Dict[str, Any]]:
        """Get recent team activity"""
        # This would integrate with actual activity tracking
        # For now, return sample data
        return [
            {
                "id": 1,
                "member": "Alice Johnson",
                "action": "Completed task",
                "project": "Q4 Features",
                "timestamp": datetime.utcnow() - timedelta(hours=2)
            },
            {
                "id": 2,
                "member": "Bob Smith",
                "action": "Started new story",
                "project": "API Integration",
                "timestamp": datetime.utcnow() - timedelta(hours=4)
            }
        ]
    
    def _calculate_team_health_score(self) -> float:
        """Calculate overall team health score"""
        # This would implement actual health scoring logic
        # For now, return a sample score
        return 87.5
    
    def _calculate_average_activity_score(self) -> float:
        """Calculate average activity score for the team"""
        # This would calculate actual average
        # For now, return a sample score
        return 76.3

# API Endpoints
@router.get("/", response_model=Dict[str, Any])
def get_team_members(
    workspace_id: str,
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    user_role: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: Staff = Depends(require_workspace_admin),
    db: Session = Depends(get_db)
):
    """Get workspace team members"""
    service = TeamManagementService(db, workspace_id)
    return service.get_team_members(page, limit, search, user_role, is_active)

@router.post("/invite")
def invite_team_member(
    workspace_id: str,
    email: str,
    user_role: str,
    current_user: Staff = Depends(require_workspace_admin),
    db: Session = Depends(get_db)
):
    """Invite a new team member"""
    service = TeamManagementService(db, workspace_id)
    return service.invite_team_member(email, user_role, current_user.id)

@router.put("/{member_id}/role")
def update_member_role(
    workspace_id: str,
    member_id: int,
    new_role: str,
    current_user: Staff = Depends(require_workspace_admin),
    db: Session = Depends(get_db)
):
    """Update team member role"""
    service = TeamManagementService(db, workspace_id)
    return service.update_member_role(member_id, new_role, current_user.id)

@router.put("/{member_id}/deactivate")
def deactivate_member(
    workspace_id: str,
    member_id: int,
    current_user: Staff = Depends(require_workspace_admin),
    db: Session = Depends(get_db)
):
    """Deactivate a team member"""
    service = TeamManagementService(db, workspace_id)
    return service.deactivate_member(member_id, current_user.id)

@router.get("/analytics", response_model=TeamAnalytics)
def get_team_analytics(
    workspace_id: str,
    current_user: Staff = Depends(require_workspace_admin),
    db: Session = Depends(get_db)
):
    """Get team analytics"""
    service = TeamManagementService(db, workspace_id)
    return service.get_team_analytics() 