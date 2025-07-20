"""
User Management Service for Platform Owner Admin
Handles cross-workspace user management, role assignments, and user analytics
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc
from pydantic import BaseModel

from database import get_db
from models import Staff, Business, AuditLog
from shared.authentication import require_platform_admin, get_current_user
from shared.audit_logging import AuditLogger

router = APIRouter(prefix="/api/platform/users", tags=["User Management"])

# Pydantic models for API responses
class UserSummary(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    user_role: str
    business_id: int
    business_name: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime]
    login_count: int
    activity_score: float

class UserAnalytics(BaseModel):
    total_users: int
    active_users: int
    users_by_role: Dict[str, int]
    users_by_workspace: List[Dict[str, Any]]
    recent_registrations: List[Dict[str, Any]]
    top_active_users: List[Dict[str, Any]]
    user_growth_rate: float

class UserActivity(BaseModel):
    user_id: int
    user_email: str
    business_name: str
    action: str
    timestamp: datetime
    ip_address: Optional[str]

class UserManagementService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_logger = AuditLogger(db)
    
    def get_all_users(
        self,
        page: int = 1,
        limit: int = 50,
        search: Optional[str] = None,
        user_role: Optional[str] = None,
        business_id: Optional[int] = None,
        is_active: Optional[bool] = None
    ) -> Dict[str, Any]:
        """Get all users with filtering and pagination"""
        query = self.db.query(Staff).join(Business, Staff.business_id == Business.id)
        
        # Apply filters
        if search:
            query = query.filter(
                or_(
                    Staff.email.ilike(f"%{search}%"),
                    Staff.first_name.ilike(f"%{search}%"),
                    Staff.last_name.ilike(f"%{search}%"),
                    Business.name.ilike(f"%{search}%")
                )
            )
        
        if user_role:
            query = query.filter(Staff.user_role == user_role)
        
        if business_id:
            query = query.filter(Staff.business_id == business_id)
        
        if is_active is not None:
            query = query.filter(Staff.is_active == is_active)
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        offset = (page - 1) * limit
        users = query.offset(offset).limit(limit).all()
        
        # Enrich with additional data
        user_summaries = []
        for user in users:
            # Get login count and last login (simplified)
            login_count = 0  # Would integrate with actual login tracking
            last_login = None  # Would integrate with actual login tracking
            
            # Calculate activity score
            activity_score = self._calculate_user_activity_score(user.id)
            
            user_summaries.append(UserSummary(
                id=user.id,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                user_role=user.user_role,
                business_id=user.business_id,
                business_name=user.business.name,
                is_active=user.is_active,
                created_at=user.created_at,
                last_login=last_login,
                login_count=login_count,
                activity_score=activity_score
            ))
        
        return {
            "users": user_summaries,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit
        }
    
    def get_user_analytics(self) -> UserAnalytics:
        """Get platform-wide user analytics"""
        # Total users
        total_users = self.db.query(Staff).count()
        active_users = self.db.query(Staff).filter(Staff.is_active == True).count()
        
        # Users by role
        users_by_role = {}
        role_counts = self.db.query(
            Staff.user_role,
            func.count(Staff.id).label('count')
        ).group_by(Staff.user_role).all()
        
        for role, count in role_counts:
            users_by_role[role] = count
        
        # Users by workspace
        workspace_counts = self.db.query(
            Business.name,
            func.count(Staff.id).label('user_count')
        ).join(Staff, Business.id == Staff.business_id).group_by(Business.id, Business.name).all()
        
        users_by_workspace = [
            {"workspace": name, "user_count": count}
            for name, count in workspace_counts
        ]
        
        # Recent registrations
        recent_registrations = self.db.query(Staff).order_by(
            desc(Staff.created_at)
        ).limit(10).all()
        
        recent_users = []
        for user in recent_registrations:
            recent_users.append({
                "id": user.id,
                "email": user.email,
                "name": f"{user.first_name} {user.last_name}",
                "business": user.business.name,
                "role": user.user_role,
                "created_at": user.created_at
            })
        
        # Top active users (simplified)
        top_active_users = self._get_top_active_users()
        
        # User growth rate
        user_growth_rate = self._calculate_user_growth_rate()
        
        return UserAnalytics(
            total_users=total_users,
            active_users=active_users,
            users_by_role=users_by_role,
            users_by_workspace=users_by_workspace,
            recent_registrations=recent_users,
            top_active_users=top_active_users,
            user_growth_rate=user_growth_rate
        )
    
    def get_user_activity(
        self,
        user_id: Optional[int] = None,
        business_id: Optional[int] = None,
        days: int = 30
    ) -> List[UserActivity]:
        """Get user activity logs"""
        query = self.db.query(AuditLog).filter(
            AuditLog.timestamp >= datetime.utcnow() - timedelta(days=days)
        )
        
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        
        if business_id:
            query = query.filter(AuditLog.workspace_id == str(business_id))
        
        activities = query.order_by(desc(AuditLog.timestamp)).limit(100).all()
        
        activity_list = []
        for activity in activities:
            # Get business name
            business_name = "Unknown"
            if activity.workspace_id:
                business = self.db.query(Business).filter(
                    Business.id == int(activity.workspace_id)
                ).first()
                if business:
                    business_name = business.name
            
            activity_list.append(UserActivity(
                user_id=activity.user_id,
                user_email=activity.user_email,
                business_name=business_name,
                action=activity.action,
                timestamp=activity.timestamp,
                ip_address=activity.ip_address
            ))
        
        return activity_list
    
    def update_user_role(self, user_id: int, new_role: str, admin_user_id: int) -> Dict[str, Any]:
        """Update user role"""
        user = self.db.query(Staff).filter(Staff.id == user_id).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        old_role = user.user_role
        user.user_role = new_role
        
        # Log the change
        self.audit_logger.log_platform_action(
            user_id=admin_user_id,
            user_email="",  # Will be filled from user lookup
            action="user_role_updated",
            resource_type="user",
            resource_id=str(user_id),
            details={
                "old_role": old_role,
                "new_role": new_role,
                "target_user_email": user.email
            }
        )
        
        self.db.commit()
        
        return {
            "message": "User role updated successfully",
            "user_id": user_id,
            "old_role": old_role,
            "new_role": new_role
        }
    
    def deactivate_user(self, user_id: int, admin_user_id: int) -> Dict[str, Any]:
        """Deactivate a user"""
        user = self.db.query(Staff).filter(Staff.id == user_id).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already deactivated"
            )
        
        user.is_active = False
        
        # Log the change
        self.audit_logger.log_platform_action(
            user_id=admin_user_id,
            user_email="",
            action="user_deactivated",
            resource_type="user",
            resource_id=str(user_id),
            details={"target_user_email": user.email}
        )
        
        self.db.commit()
        
        return {
            "message": "User deactivated successfully",
            "user_id": user_id,
            "user_email": user.email
        }
    
    def _calculate_user_activity_score(self, user_id: int) -> float:
        """Calculate user activity score based on recent actions"""
        # This would integrate with actual activity tracking
        # For now, return a random score between 0 and 100
        import random
        return round(random.uniform(0, 100), 1)
    
    def _get_top_active_users(self) -> List[Dict[str, Any]]:
        """Get top active users"""
        # This would integrate with actual activity tracking
        # For now, return sample data
        return [
            {
                "id": 1,
                "name": "Alice Johnson",
                "email": "alice@techcorp.com",
                "business": "TechCorp Solutions",
                "activity_score": 95.2,
                "last_activity": "2 hours ago"
            },
            {
                "id": 2,
                "name": "Bob Smith",
                "email": "bob@techcorp.com",
                "business": "TechCorp Solutions",
                "activity_score": 87.8,
                "last_activity": "4 hours ago"
            }
        ]
    
    def _calculate_user_growth_rate(self) -> float:
        """Calculate user growth rate"""
        # This would calculate actual growth rate
        # For now, return a sample rate
        return 12.5

# API Endpoints
@router.get("/", response_model=Dict[str, Any])
def get_users(
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    user_role: Optional[str] = None,
    business_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get all users with filtering and pagination"""
    service = UserManagementService(db)
    return service.get_all_users(page, limit, search, user_role, business_id, is_active)

@router.get("/analytics", response_model=UserAnalytics)
def get_user_analytics(
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get platform-wide user analytics"""
    service = UserManagementService(db)
    return service.get_user_analytics()

@router.get("/activity", response_model=List[UserActivity])
def get_user_activity(
    user_id: Optional[int] = None,
    business_id: Optional[int] = None,
    days: int = 30,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get user activity logs"""
    service = UserManagementService(db)
    return service.get_user_activity(user_id, business_id, days)

@router.put("/{user_id}/role")
def update_user_role(
    user_id: int,
    new_role: str,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Update user role"""
    service = UserManagementService(db)
    return service.update_user_role(user_id, new_role, current_user.id)

@router.put("/{user_id}/deactivate")
def deactivate_user(
    user_id: int,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Deactivate a user"""
    service = UserManagementService(db)
    return service.deactivate_user(user_id, current_user.id) 