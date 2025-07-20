"""
Platform Management Service for Platform Owner Admin
Handles global business operations, analytics, and platform-wide management
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from pydantic import BaseModel

from database import get_db
from models import Business, Staff, AuditLog, SecurityEvent
from shared.authentication import require_platform_admin, get_current_user
from shared.audit_logging import AuditLogger

router = APIRouter(prefix="/api/platform", tags=["Platform Management"])

# Pydantic models for API responses
class BusinessSummary(BaseModel):
    id: int
    name: str
    type: str
    subscription_tier: str
    is_active: bool
    created_at: datetime
    staff_count: int
    last_activity: Optional[datetime]
    revenue_monthly: float
    health_score: float

class PlatformAnalytics(BaseModel):
    total_businesses: int
    active_businesses: int
    total_revenue_monthly: float
    revenue_growth_percentage: float
    churn_rate: float
    new_businesses_this_month: int
    top_performing_businesses: List[Dict[str, Any]]
    subscription_distribution: Dict[str, int]

class RevenueData(BaseModel):
    date: str
    revenue: float
    new_subscriptions: int
    cancellations: int

class PlatformManagementService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_logger = AuditLogger(db)
    
    def get_all_businesses(
        self,
        page: int = 1,
        limit: int = 50,
        search: Optional[str] = None,
        subscription_tier: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> Dict[str, Any]:
        """Get all businesses with filtering and pagination"""
        query = self.db.query(Business)
        
        # Apply filters
        if search:
            query = query.filter(
                or_(
                    Business.name.ilike(f"%{search}%"),
                    Business.email.ilike(f"%{search}%"),
                    Business.owner_name.ilike(f"%{search}%")
                )
            )
        
        if subscription_tier:
            query = query.filter(Business.subscription_tier == subscription_tier)
        
        if is_active is not None:
            query = query.filter(Business.is_active == is_active)
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        offset = (page - 1) * limit
        businesses = query.offset(offset).limit(limit).all()
        
        # Enrich with additional data
        business_summaries = []
        for business in businesses:
            # Get staff count
            staff_count = self.db.query(Staff).filter(
                Staff.business_id == business.id,
                Staff.is_active == True
            ).count()
            
            # Get last activity (simplified - would need more complex logic)
            last_activity = business.created_at
            
            # Calculate revenue (simplified - would integrate with billing system)
            revenue_monthly = self._calculate_monthly_revenue(business.subscription_tier)
            
            # Calculate health score
            health_score = self._calculate_business_health(business.id)
            
            business_summaries.append(BusinessSummary(
                id=business.id,
                name=business.name,
                type=business.type,
                subscription_tier=business.subscription_tier,
                is_active=business.is_active,
                created_at=business.created_at,
                staff_count=staff_count,
                last_activity=last_activity,
                revenue_monthly=revenue_monthly,
                health_score=health_score
            ))
        
        return {
            "businesses": business_summaries,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit
        }
    
    def get_platform_analytics(self) -> PlatformAnalytics:
        """Get platform-wide analytics"""
        # Total businesses
        total_businesses = self.db.query(Business).count()
        active_businesses = self.db.query(Business).filter(Business.is_active == True).count()
        
        # Revenue calculations
        total_revenue_monthly = self._calculate_total_monthly_revenue()
        revenue_growth_percentage = self._calculate_revenue_growth()
        
        # Churn rate
        churn_rate = self._calculate_churn_rate()
        
        # New businesses this month
        start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        new_businesses_this_month = self.db.query(Business).filter(
            Business.created_at >= start_of_month
        ).count()
        
        # Top performing businesses
        top_performing_businesses = self._get_top_performing_businesses()
        
        # Subscription distribution
        subscription_distribution = self._get_subscription_distribution()
        
        return PlatformAnalytics(
            total_businesses=total_businesses,
            active_businesses=active_businesses,
            total_revenue_monthly=total_revenue_monthly,
            revenue_growth_percentage=revenue_growth_percentage,
            churn_rate=churn_rate,
            new_businesses_this_month=new_businesses_this_month,
            top_performing_businesses=top_performing_businesses,
            subscription_distribution=subscription_distribution
        )
    
    def get_revenue_data(self, days: int = 30) -> List[RevenueData]:
        """Get revenue data over time"""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # This would integrate with a real billing system
        # For now, we'll generate sample data
        revenue_data = []
        current_date = start_date
        
        while current_date <= end_date:
            # Simulate daily revenue
            daily_revenue = 1500 + (current_date.day * 50)  # Sample calculation
            new_subscriptions = 2 if current_date.day % 7 == 0 else 0
            cancellations = 1 if current_date.day % 14 == 0 else 0
            
            revenue_data.append(RevenueData(
                date=current_date.strftime("%Y-%m-%d"),
                revenue=daily_revenue,
                new_subscriptions=new_subscriptions,
                cancellations=cancellations
            ))
            
            current_date += timedelta(days=1)
        
        return revenue_data
    
    def update_business_status(self, business_id: int, is_active: bool, user_id: int) -> Dict[str, Any]:
        """Update business active status"""
        business = self.db.query(Business).filter(Business.id == business_id).first()
        
        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found"
            )
        
        old_status = business.is_active
        business.is_active = is_active
        self.db.commit()
        
        # Log the action
        self.audit_logger.log_platform_action(
            user_id=user_id,
            user_email="",  # Would get from user lookup
            action="update_business_status",
            resource_type="business",
            resource_id=str(business_id),
            details={
                "old_status": old_status,
                "new_status": is_active
            }
        )
        
        return {
            "success": True,
            "business_id": business_id,
            "is_active": is_active,
            "message": f"Business status updated to {'active' if is_active else 'inactive'}"
        }
    
    def update_subscription_tier(self, business_id: int, new_tier: str, user_id: int) -> Dict[str, Any]:
        """Update business subscription tier"""
        business = self.db.query(Business).filter(Business.id == business_id).first()
        
        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found"
            )
        
        valid_tiers = ["starter", "professional", "enterprise"]
        if new_tier not in valid_tiers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid subscription tier. Must be one of: {valid_tiers}"
            )
        
        old_tier = business.subscription_tier
        business.subscription_tier = new_tier
        self.db.commit()
        
        # Log the action
        self.audit_logger.log_platform_action(
            user_id=user_id,
            user_email="",  # Would get from user lookup
            action="update_subscription_tier",
            resource_type="business",
            resource_id=str(business_id),
            details={
                "old_tier": old_tier,
                "new_tier": new_tier
            }
        )
        
        return {
            "success": True,
            "business_id": business_id,
            "subscription_tier": new_tier,
            "message": f"Subscription tier updated from {old_tier} to {new_tier}"
        }
    
    def _calculate_monthly_revenue(self, subscription_tier: str) -> float:
        """Calculate monthly revenue for a subscription tier"""
        tier_pricing = {
            "starter": 29.99,
            "professional": 59.99,
            "enterprise": 108.99
        }
        return tier_pricing.get(subscription_tier, 0.0)
    
    def _calculate_total_monthly_revenue(self) -> float:
        """Calculate total monthly revenue across all businesses"""
        businesses = self.db.query(Business).filter(Business.is_active == True).all()
        total_revenue = 0.0
        
        for business in businesses:
            total_revenue += self._calculate_monthly_revenue(business.subscription_tier)
        
        return total_revenue
    
    def _calculate_revenue_growth(self) -> float:
        """Calculate revenue growth percentage (simplified)"""
        # This would compare current month vs previous month
        # For demo purposes, return a sample growth rate
        return 12.5  # 12.5% growth
    
    def _calculate_churn_rate(self) -> float:
        """Calculate customer churn rate"""
        # This would analyze cancellations vs total customers
        # For demo purposes, return a sample churn rate
        return 2.3  # 2.3% monthly churn
    
    def _calculate_business_health(self, business_id: int) -> float:
        """Calculate business health score (0-100)"""
        # This would analyze various factors like:
        # - Staff activity
        # - Feature usage
        # - Support tickets
        # - Payment history
        
        # For demo purposes, return a sample health score
        import random
        return round(random.uniform(60, 95), 1)
    
    def _get_top_performing_businesses(self) -> List[Dict[str, Any]]:
        """Get top performing businesses"""
        # This would analyze various performance metrics
        # For demo purposes, return sample data
        return [
            {
                "id": 1,
                "name": "TechCorp Solutions",
                "revenue": 108.99,
                "health_score": 94.2,
                "staff_count": 15
            },
            {
                "id": 2,
                "name": "Innovation Labs",
                "revenue": 108.99,
                "health_score": 91.8,
                "staff_count": 12
            }
        ]
    
    def _get_subscription_distribution(self) -> Dict[str, int]:
        """Get distribution of subscription tiers"""
        distribution = {}
        
        for tier in ["starter", "professional", "enterprise"]:
            count = self.db.query(Business).filter(
                Business.subscription_tier == tier,
                Business.is_active == True
            ).count()
            distribution[tier] = count
        
        return distribution

# API endpoints
@router.get("/businesses", response_model=Dict[str, Any])
def get_businesses(
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    subscription_tier: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get all businesses with filtering and pagination"""
    service = PlatformManagementService(db)
    return service.get_all_businesses(page, limit, search, subscription_tier, is_active)

@router.get("/analytics", response_model=PlatformAnalytics)
def get_platform_analytics(
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get platform-wide analytics"""
    service = PlatformManagementService(db)
    return service.get_platform_analytics()

@router.get("/revenue", response_model=List[RevenueData])
def get_revenue_data(
    days: int = 30,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get revenue data over time"""
    service = PlatformManagementService(db)
    return service.get_revenue_data(days)

@router.put("/businesses/{business_id}/status")
def update_business_status(
    business_id: int,
    is_active: bool,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Update business active status"""
    service = PlatformManagementService(db)
    return service.update_business_status(business_id, is_active, current_user.id)

@router.put("/businesses/{business_id}/subscription")
def update_subscription_tier(
    business_id: int,
    subscription_tier: str,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Update business subscription tier"""
    service = PlatformManagementService(db)
    return service.update_subscription_tier(business_id, subscription_tier, current_user.id) 