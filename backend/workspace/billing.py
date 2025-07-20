"""
Billing Service for Workspace Admin
Handles subscription management, usage tracking, payment methods, and invoice history
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc
from pydantic import BaseModel

from database import get_db
from models import Business, Staff
from shared.authentication import require_workspace_admin, get_current_user
from shared.audit_logging import AuditLogger

router = APIRouter(prefix="/api/workspace/{workspace_id}/billing", tags=["Billing"])

# Pydantic models for API responses
class SubscriptionInfo(BaseModel):
    current_plan: str
    plan_name: str
    monthly_cost: float
    next_billing_date: datetime
    status: str  # active, past_due, cancelled
    features: List[str]
    usage_limits: Dict[str, Any]
    current_usage: Dict[str, Any]

class Invoice(BaseModel):
    id: str
    invoice_number: str
    amount: float
    currency: str
    status: str  # paid, pending, overdue
    due_date: datetime
    paid_date: Optional[datetime]
    items: List[Dict[str, Any]]

class PaymentMethod(BaseModel):
    id: str
    type: str  # card, bank_account
    last_four: str
    brand: Optional[str]  # visa, mastercard, etc.
    expiry_month: Optional[int]
    expiry_year: Optional[int]
    is_default: bool

class BillingAnalytics(BaseModel):
    total_spent: float
    average_monthly_cost: float
    cost_trend: List[Dict[str, Any]]
    usage_trend: List[Dict[str, Any]]
    upcoming_charges: float

class BillingService:
    def __init__(self, db: Session, workspace_id: str):
        self.db = db
        self.workspace_id = workspace_id
        self.audit_logger = AuditLogger(db)
    
    def get_subscription_info(self) -> SubscriptionInfo:
        """Get current subscription information"""
        business = self.db.query(Business).filter(
            Business.id == self.workspace_id
        ).first()
        
        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )
        
        # Get plan details
        plan_details = self._get_plan_details(business.subscription_tier)
        
        # Calculate usage
        current_usage = self._calculate_current_usage()
        
        # Next billing date (simplified)
        next_billing_date = datetime.utcnow() + timedelta(days=30)
        
        return SubscriptionInfo(
            current_plan=business.subscription_tier,
            plan_name=plan_details["name"],
            monthly_cost=plan_details["monthly_cost"],
            next_billing_date=next_billing_date,
            status="active",  # Would check actual status
            features=plan_details["features"],
            usage_limits=plan_details["limits"],
            current_usage=current_usage
        )
    
    def get_invoices(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get invoice history"""
        # This would integrate with actual billing system
        # For now, return sample data
        invoices = self._get_sample_invoices()
        
        # Apply filters
        if status:
            invoices = [inv for inv in invoices if inv["status"] == status]
        
        # Apply pagination
        total = len(invoices)
        offset = (page - 1) * limit
        paginated_invoices = invoices[offset:offset + limit]
        
        # Convert to response format
        invoice_list = []
        for inv in paginated_invoices:
            invoice_list.append(Invoice(
                id=inv["id"],
                invoice_number=inv["invoice_number"],
                amount=inv["amount"],
                currency=inv["currency"],
                status=inv["status"],
                due_date=inv["due_date"],
                paid_date=inv.get("paid_date"),
                items=inv["items"]
            ))
        
        return {
            "invoices": invoice_list,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit
        }
    
    def get_payment_methods(self) -> List[PaymentMethod]:
        """Get payment methods"""
        # This would integrate with actual payment processor
        # For now, return sample data
        return [
            PaymentMethod(
                id="pm_1234567890",
                type="card",
                last_four="4242",
                brand="visa",
                expiry_month=12,
                expiry_year=2025,
                is_default=True
            ),
            PaymentMethod(
                id="pm_0987654321",
                type="card",
                last_four="5555",
                brand="mastercard",
                expiry_month=6,
                expiry_year=2026,
                is_default=False
            )
        ]
    
    def update_subscription(
        self,
        new_plan: str,
        updated_by_user_id: int
    ) -> Dict[str, Any]:
        """Update subscription plan"""
        business = self.db.query(Business).filter(
            Business.id == self.workspace_id
        ).first()
        
        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )
        
        # Validate plan
        valid_plans = ["starter", "professional", "enterprise"]
        if new_plan not in valid_plans:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid plan. Must be one of: {', '.join(valid_plans)}"
            )
        
        old_plan = business.subscription_tier
        business.subscription_tier = new_plan
        
        # Log the change
        self.audit_logger.log_workspace_action(
            user_id=updated_by_user_id,
            user_email="",
            action="subscription_updated",
            resource_type="subscription",
            resource_id=self.workspace_id,
            details={
                "old_plan": old_plan,
                "new_plan": new_plan,
                "workspace_id": self.workspace_id
            },
            workspace_id=self.workspace_id
        )
        
        self.db.commit()
        
        return {
            "message": "Subscription updated successfully",
            "old_plan": old_plan,
            "new_plan": new_plan,
            "effective_date": datetime.utcnow()
        }
    
    def cancel_subscription(
        self,
        reason: Optional[str] = None,
        cancelled_by_user_id: int = None
    ) -> Dict[str, Any]:
        """Cancel subscription"""
        business = self.db.query(Business).filter(
            Business.id == self.workspace_id
        ).first()
        
        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )
        
        # Set cancellation date
        business.subscription_tier = "cancelled"
        # Would also set cancellation_date field
        
        # Log the cancellation
        self.audit_logger.log_workspace_action(
            user_id=cancelled_by_user_id,
            user_email="",
            action="subscription_cancelled",
            resource_type="subscription",
            resource_id=self.workspace_id,
            details={
                "reason": reason,
                "workspace_id": self.workspace_id
            },
            workspace_id=self.workspace_id
        )
        
        self.db.commit()
        
        return {
            "message": "Subscription cancelled successfully",
            "cancellation_date": datetime.utcnow(),
            "reason": reason
        }
    
    def get_billing_analytics(self) -> BillingAnalytics:
        """Get billing analytics"""
        # This would integrate with actual billing data
        # For now, return sample data
        
        # Total spent
        total_spent = 1250.75
        
        # Average monthly cost
        average_monthly_cost = 108.99
        
        # Cost trend (last 6 months)
        cost_trend = []
        for i in range(6):
            date = datetime.utcnow() - timedelta(days=30 * i)
            cost_trend.append({
                "month": date.strftime("%Y-%m"),
                "cost": 108.99 + (i * 5)  # Sample trend
            })
        
        # Usage trend
        usage_trend = []
        for i in range(6):
            date = datetime.utcnow() - timedelta(days=30 * i)
            usage_trend.append({
                "month": date.strftime("%Y-%m"),
                "users": 15 + (i * 2),  # Sample trend
                "projects": 12 + i
            })
        
        # Upcoming charges
        upcoming_charges = 108.99
        
        return BillingAnalytics(
            total_spent=total_spent,
            average_monthly_cost=average_monthly_cost,
            cost_trend=cost_trend,
            usage_trend=usage_trend,
            upcoming_charges=upcoming_charges
        )
    
    def _get_plan_details(self, plan_tier: str) -> Dict[str, Any]:
        """Get plan details"""
        plans = {
            "starter": {
                "name": "Starter Plan",
                "monthly_cost": 29.99,
                "features": ["Basic scheduling", "Team management", "Email support"],
                "limits": {"users": 5, "projects": 10, "storage": "5GB"}
            },
            "professional": {
                "name": "Professional Plan",
                "monthly_cost": 79.99,
                "features": ["Advanced scheduling", "Team management", "Priority support", "Analytics"],
                "limits": {"users": 25, "projects": 50, "storage": "25GB"}
            },
            "enterprise": {
                "name": "Enterprise Plan",
                "monthly_cost": 199.99,
                "features": ["Advanced scheduling", "Team management", "Priority support", "Analytics", "Custom integrations"],
                "limits": {"users": 100, "projects": 200, "storage": "100GB"}
            }
        }
        return plans.get(plan_tier, plans["starter"])
    
    def _calculate_current_usage(self) -> Dict[str, Any]:
        """Calculate current usage"""
        # This would integrate with actual usage tracking
        return {
            "users": 15,
            "projects": 12,
            "storage": "8.5GB"
        }
    
    def _get_sample_invoices(self) -> List[Dict[str, Any]]:
        """Get sample invoice data"""
        return [
            {
                "id": "inv_001",
                "invoice_number": "INV-2024-001",
                "amount": 108.99,
                "currency": "GBP",
                "status": "paid",
                "due_date": datetime.utcnow() - timedelta(days=15),
                "paid_date": datetime.utcnow() - timedelta(days=10),
                "items": [
                    {"description": "Enterprise Plan", "amount": 108.99}
                ]
            },
            {
                "id": "inv_002",
                "invoice_number": "INV-2024-002",
                "amount": 108.99,
                "currency": "GBP",
                "status": "pending",
                "due_date": datetime.utcnow() + timedelta(days=15),
                "items": [
                    {"description": "Enterprise Plan", "amount": 108.99}
                ]
            }
        ]

# API Endpoints
@router.get("/subscription", response_model=SubscriptionInfo)
def get_subscription_info(
    workspace_id: str,
    current_user: Staff = Depends(require_workspace_admin),
    db: Session = Depends(get_db)
):
    """Get current subscription information"""
    service = BillingService(db, workspace_id)
    return service.get_subscription_info()

@router.get("/invoices", response_model=Dict[str, Any])
def get_invoices(
    workspace_id: str,
    page: int = 1,
    limit: int = 20,
    status: Optional[str] = None,
    current_user: Staff = Depends(require_workspace_admin),
    db: Session = Depends(get_db)
):
    """Get invoice history"""
    service = BillingService(db, workspace_id)
    return service.get_invoices(page, limit, status)

@router.get("/payment-methods", response_model=List[PaymentMethod])
def get_payment_methods(
    workspace_id: str,
    current_user: Staff = Depends(require_workspace_admin),
    db: Session = Depends(get_db)
):
    """Get payment methods"""
    service = BillingService(db, workspace_id)
    return service.get_payment_methods()

@router.put("/subscription")
def update_subscription(
    workspace_id: str,
    new_plan: str,
    current_user: Staff = Depends(require_workspace_admin),
    db: Session = Depends(get_db)
):
    """Update subscription plan"""
    service = BillingService(db, workspace_id)
    return service.update_subscription(new_plan, current_user.id)

@router.post("/cancel")
def cancel_subscription(
    workspace_id: str,
    reason: Optional[str] = None,
    current_user: Staff = Depends(require_workspace_admin),
    db: Session = Depends(get_db)
):
    """Cancel subscription"""
    service = BillingService(db, workspace_id)
    return service.cancel_subscription(reason, current_user.id)

@router.get("/analytics", response_model=BillingAnalytics)
def get_billing_analytics(
    workspace_id: str,
    current_user: Staff = Depends(require_workspace_admin),
    db: Session = Depends(get_db)
):
    """Get billing analytics"""
    service = BillingService(db, workspace_id)
    return service.get_billing_analytics() 