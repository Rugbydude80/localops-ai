import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from models import (
    BoltOnManagement, BoltOnSubscription, BoltOnAuditLog, Business, 
    SumUpIntegration, SalesData, IntegrationLog, Staff
)
from schemas import (
    BoltOnAdminDashboard, BoltOnToggleResponse, BoltOnBulkActionResponse,
    BoltOnToggleRequest, BoltOnBulkActionRequest, BoltOnManagementUpdate,
    BoltOnUsageAnalytics
)

logger = logging.getLogger(__name__)

class BoltOnManagementService:
    """Service for managing bolt-on platform configuration and business entitlements"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_admin_dashboard(self, bolt_on_type: str) -> BoltOnAdminDashboard:
        """Get admin dashboard data for a specific bolt-on"""
        # Get platform configuration
        config = self.db.query(BoltOnManagement).filter(
            BoltOnManagement.bolt_on_type == bolt_on_type
        ).first()
        
        if not config:
            # Create default configuration
            config = BoltOnManagement(
                bolt_on_type=bolt_on_type,
                is_platform_enabled=True,
                monthly_price=29.99,
                required_plan="professional",
                description="SumUp POS integration for automated sales data sync",
                features=["sales_sync", "analytics", "staff_performance", "inventory_insights"]
            )
            self.db.add(config)
            self.db.commit()
        
        # Get all businesses with their bolt-on status
        businesses = self.db.query(Business).filter(Business.is_active == True).all()
        business_statuses = []
        
        total_revenue = 0.0
        active_subscriptions = 0
        
        for business in businesses:
            # Get subscription status
            subscription = self.db.query(BoltOnSubscription).filter(
                BoltOnSubscription.business_id == business.id,
                BoltOnSubscription.bolt_on_type == bolt_on_type,
                BoltOnSubscription.subscription_status == "active"
            ).first()
            
            # Get integration status
            integration = self.db.query(SumUpIntegration).filter(
                SumUpIntegration.business_id == business.id
            ).first()
            
            # Calculate 30-day usage
            usage_30d = None
            is_enabled = False
            is_entitled = False
            last_sync_at = None
            
            if integration:
                # Access the actual values from the database object
                is_enabled = bool(integration.is_enabled)
                last_sync_at = integration.last_sync_at
                
                if is_enabled:
                    thirty_days_ago = datetime.now() - timedelta(days=30)
                    sales_data = self.db.query(func.sum(SalesData.sale_value)).filter(
                        SalesData.business_id == business.id,
                        SalesData.sale_time >= thirty_days_ago
                    ).scalar()
                    usage_30d = sales_data or 0
                    total_revenue += float(config.monthly_price)
                    active_subscriptions += 1
            
            if subscription:
                is_entitled = subscription.subscription_status == "active"
            
            # Determine connection status
            connection_status = "inactive"
            error_message = None
            
            if is_entitled:
                if is_enabled:
                    if last_sync_at:
                        # Check if last sync was recent (within 24 hours)
                        if datetime.now() - last_sync_at < timedelta(hours=24):
                            connection_status = "active"
                        else:
                            connection_status = "error"
                            error_message = "Last sync was more than 24 hours ago"
                    else:
                        connection_status = "error"
                        error_message = "No sync data available"
                else:
                    connection_status = "inactive"
            else:
                connection_status = "inactive"
            
            business_statuses.append({
                "business_id": business.id,
                "business_name": business.name,
                "subscription_tier": business.subscription_tier,
                "bolt_on_type": bolt_on_type,
                "is_enabled": is_enabled,
                "is_entitled": is_entitled,
                "last_sync_at": last_sync_at,
                "usage_30d": usage_30d,
                "connection_status": connection_status,
                "error_message": error_message
            })
        
        return BoltOnAdminDashboard(
            bolt_on_type=bolt_on_type,
            platform_enabled=bool(config.is_platform_enabled),
            monthly_price=float(config.monthly_price),
            total_businesses=len(businesses),
            active_subscriptions=active_subscriptions,
            total_revenue=total_revenue,
            businesses=business_statuses
        )
    
    def toggle_business_bolt_on(self, toggle_request: BoltOnToggleRequest, 
                              performed_by: int) -> BoltOnToggleResponse:
        """Toggle bolt-on for a specific business"""
        try:
            # Get business
            business = self.db.query(Business).filter(Business.id == toggle_request.business_id).first()
            if not business:
                return BoltOnToggleResponse(
                    success=False,
                    message="Business not found",
                    new_status=False,
                    audit_log_id=0
                )
            
            # Get or create subscription
            subscription = self.db.query(BoltOnSubscription).filter(
                BoltOnSubscription.business_id == toggle_request.business_id,
                BoltOnSubscription.bolt_on_type == toggle_request.bolt_on_type
            ).first()
            
            old_value = {
                "subscription_status": subscription.subscription_status if subscription else None,
                "is_enabled": False
            }
            
            if toggle_request.enable:
                # Enable bolt-on
                if not subscription:
                    subscription = BoltOnSubscription(
                        business_id=toggle_request.business_id,
                        bolt_on_type=toggle_request.bolt_on_type,
                        subscription_status="active",
                        start_date=datetime.now().date(),
                        monthly_price=29.99,
                        features_enabled=["sales_sync", "analytics", "staff_performance"]
                    )
                    self.db.add(subscription)
                else:
                    # Update existing subscription
                    subscription.subscription_status = "active"
                    subscription.start_date = datetime.now().date()
                
                # Get or create integration
                integration = self.db.query(SumUpIntegration).filter(
                    SumUpIntegration.business_id == toggle_request.business_id
                ).first()
                
                if not integration:
                    integration = SumUpIntegration(
                        business_id=toggle_request.business_id,
                        is_enabled=True,
                        is_entitled=True
                    )
                    self.db.add(integration)
                else:
                    # Update existing integration
                    integration.is_entitled = True
                
                new_status = True
                message = f"SumUp bolt-on enabled for {business.name}"
                
            else:
                # Disable bolt-on
                if subscription:
                    subscription.subscription_status = "inactive"
                    subscription.end_date = datetime.now().date()
                
                # Disable integration
                integration = self.db.query(SumUpIntegration).filter(
                    SumUpIntegration.business_id == toggle_request.business_id
                ).first()
                
                if integration:
                    integration.is_enabled = False
                    integration.is_entitled = False
                
                new_status = False
                message = f"SumUp bolt-on disabled for {business.name}"
            
            # Create audit log
            audit_log = BoltOnAuditLog(
                business_id=toggle_request.business_id,
                bolt_on_type=toggle_request.bolt_on_type,
                action="toggle",
                performed_by=performed_by,
                old_value=old_value,
                new_value={"subscription_status": "active" if toggle_request.enable else "inactive"},
                reason=toggle_request.reason or f"{'Enabled' if toggle_request.enable else 'Disabled'} by admin"
            )
            self.db.add(audit_log)
            self.db.commit()
            
            return BoltOnToggleResponse(
                success=True,
                message=message,
                new_status=new_status,
                audit_log_id=audit_log.id
            )
            
        except Exception as e:
            logger.error(f"Error toggling bolt-on: {str(e)}")
            self.db.rollback()
            return BoltOnToggleResponse(
                success=False,
                message=f"Error toggling bolt-on: {str(e)}",
                new_status=False,
                audit_log_id=0
            )
    
    def perform_bulk_action(self, bulk_request: BoltOnBulkActionRequest, 
                          performed_by: int) -> BoltOnBulkActionResponse:
        """Perform bulk action on multiple businesses"""
        try:
            affected_businesses = 0
            audit_log_ids = []
            
            # Get target businesses based on action
            if bulk_request.action in ["enable_all", "disable_all"]:
                businesses = self.db.query(Business).filter(Business.is_active == True).all()
            elif bulk_request.action in ["enable_for_plan", "disable_for_plan"]:
                if not bulk_request.target_plan:
                    return BoltOnBulkActionResponse(
                        success=False,
                        message="Target plan required for plan-specific actions",
                        affected_businesses=0,
                        audit_log_ids=[]
                    )
                businesses = self.db.query(Business).filter(
                    and_(
                        Business.is_active == True,
                        Business.subscription_tier == bulk_request.target_plan
                    )
                ).all()
            else:
                return BoltOnBulkActionResponse(
                    success=False,
                    message="Invalid bulk action",
                    affected_businesses=0,
                    audit_log_ids=[]
                )
            
            enable = bulk_request.action.startswith("enable")
            
            for business in businesses:
                # Create toggle request for each business
                toggle_request = BoltOnToggleRequest(
                    business_id=business.id,
                    bolt_on_type=bulk_request.bolt_on_type,
                    enable=enable,
                    reason=bulk_request.reason or f"Bulk {bulk_request.action}"
                )
                
                # Toggle bolt-on for this business
                toggle_response = self.toggle_business_bolt_on(toggle_request, performed_by)
                
                if toggle_response.success:
                    affected_businesses += 1
                    audit_log_ids.append(toggle_response.audit_log_id)
            
            action_description = bulk_request.action.replace("_", " ")
            message = f"Bulk {action_description} completed. {affected_businesses} businesses affected."
            
            return BoltOnBulkActionResponse(
                success=True,
                message=message,
                affected_businesses=affected_businesses,
                audit_log_ids=audit_log_ids
            )
            
        except Exception as e:
            logger.error(f"Error performing bulk action: {str(e)}")
            return BoltOnBulkActionResponse(
                success=False,
                message=f"Error performing bulk action: {str(e)}",
                affected_businesses=0,
                audit_log_ids=[]
            )
    
    def get_business_analytics(self, bolt_on_type: str, business_id: int, 
                             period: str = "30d") -> BoltOnUsageAnalytics:
        """Get usage analytics for a specific business"""
        try:
            business = self.db.query(Business).filter(Business.id == business_id).first()
            if not business:
                raise ValueError("Business not found")
            
            # Calculate period days
            period_days = int(period.replace("d", ""))
            start_date = datetime.now() - timedelta(days=period_days)
            
            # Get sales data for the period
            sales_data = self.db.query(SalesData).filter(
                and_(
                    SalesData.business_id == business_id,
                    SalesData.sale_time >= start_date
                )
            ).all()
            
            # Calculate analytics
            total_sales = sum(sale.sale_value for sale in sales_data)
            transaction_count = len(sales_data)
            average_transaction = total_sales / transaction_count if transaction_count > 0 else 0
            
            # Calculate peak hours
            hourly_sales = {}
            for sale in sales_data:
                hour = sale.sale_time.hour
                if hour not in hourly_sales:
                    hourly_sales[hour] = {"sales": 0, "transactions": 0}
                hourly_sales[hour]["sales"] += sale.sale_value
                hourly_sales[hour]["transactions"] += 1
            
            peak_hours = [
                {"hour": hour, "sales": data["sales"], "transactions": data["transactions"]}
                for hour, data in sorted(hourly_sales.items())
            ]
            
            # Get top items (simplified - would need sales_items table)
            top_items = []  # Would calculate from sales_items table
            
            # Get sync errors
            sync_errors = self.db.query(IntegrationLog).filter(
                and_(
                    IntegrationLog.business_id == business_id,
                    IntegrationLog.integration_type == "sumup",
                    IntegrationLog.status == "error",
                    IntegrationLog.created_at >= start_date
                )
            ).count()
            
            # Check last sync success
            last_sync = self.db.query(IntegrationLog).filter(
                and_(
                    IntegrationLog.business_id == business_id,
                    IntegrationLog.integration_type == "sumup",
                    IntegrationLog.operation == "sync"
                )
            ).order_by(IntegrationLog.created_at.desc()).first()
            
            last_sync_success = last_sync.status == "success" if last_sync else False
            
            return BoltOnUsageAnalytics(
                business_id=business_id,
                business_name=business.name,
                period=period,
                total_sales=total_sales,
                transaction_count=transaction_count,
                average_transaction=average_transaction,
                peak_hours=peak_hours,
                top_items=top_items,
                sync_errors=sync_errors,
                last_sync_success=last_sync_success
            )
            
        except Exception as e:
            logger.error(f"Error getting business analytics: {str(e)}")
            raise
    
    def get_audit_logs(self, business_id: Optional[int] = None, 
                      bolt_on_type: Optional[str] = None, limit: int = 100) -> List[Dict]:
        """Get audit logs for bolt-on actions"""
        query = self.db.query(BoltOnAuditLog)
        
        if business_id:
            query = query.filter(BoltOnAuditLog.business_id == business_id)
        
        if bolt_on_type:
            query = query.filter(BoltOnAuditLog.bolt_on_type == bolt_on_type)
        
        logs = query.order_by(BoltOnAuditLog.created_at.desc()).limit(limit).all()
        
        result = []
        for log in logs:
            # Get performer name
            performer = self.db.query(Staff).filter(Staff.id == log.performed_by).first()
            performer_name = performer.name if performer else "Unknown"
            
            # Get business name
            business = self.db.query(Business).filter(Business.id == log.business_id).first()
            business_name = business.name if business else "Unknown"
            
            result.append({
                "id": log.id,
                "business_id": log.business_id,
                "business_name": business_name,
                "bolt_on_type": log.bolt_on_type,
                "action": log.action,
                "performed_by": log.performed_by,
                "performer_name": performer_name,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "reason": log.reason,
                "created_at": log.created_at
            })
        
        return result
    
    def update_platform_config(self, bolt_on_type: str, 
                             config_update: BoltOnManagementUpdate) -> bool:
        """Update platform-wide bolt-on configuration"""
        try:
            config = self.db.query(BoltOnManagement).filter(
                BoltOnManagement.bolt_on_type == bolt_on_type
            ).first()
            
            if not config:
                config = BoltOnManagement(bolt_on_type=bolt_on_type)
                self.db.add(config)
            
            # Update fields
            if config_update.is_platform_enabled is not None:
                config.is_platform_enabled = config_update.is_platform_enabled
            
            if config_update.monthly_price is not None:
                config.monthly_price = config_update.monthly_price
            
            if config_update.required_plan is not None:
                config.required_plan = config_update.required_plan
            
            if config_update.description is not None:
                config.description = config_update.description
            
            if config_update.features is not None:
                config.features = config_update.features
            
            config.updated_at = datetime.now()
            self.db.commit()
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating platform config: {str(e)}")
            self.db.rollback()
            return False 