import asyncio
import logging
from datetime import datetime, timedelta
from typing import List
from sqlalchemy.orm import Session
from database import get_db
from models import SumUpIntegration, BoltOnSubscription
from services.sumup_integration import SumUpIntegrationService

logger = logging.getLogger(__name__)

class SumUpSyncScheduler:
    """Background service for automatically syncing SumUp data"""
    
    def __init__(self):
        self.running = False
        self.sync_interval_hours = 1  # Default sync interval
    
    async def start(self):
        """Start the background sync scheduler"""
        self.running = True
        logger.info("Starting SumUp sync scheduler")
        
        while self.running:
            try:
                await self.sync_all_integrations()
                # Wait for next sync cycle
                await asyncio.sleep(self.sync_interval_hours * 3600)  # Convert hours to seconds
            except Exception as e:
                logger.error(f"Error in SumUp sync scheduler: {str(e)}")
                # Wait 5 minutes before retrying on error
                await asyncio.sleep(300)
    
    def stop(self):
        """Stop the background sync scheduler"""
        self.running = False
        logger.info("Stopping SumUp sync scheduler")
    
    async def sync_all_integrations(self):
        """Sync data for all active SumUp integrations"""
        db = next(get_db())
        
        try:
            # Get all active integrations
            integrations = db.query(SumUpIntegration).filter(
                SumUpIntegration.is_enabled == True
            ).all()
            
            logger.info(f"Found {len(integrations)} active SumUp integrations to sync")
            
            for integration in integrations:
                try:
                    # Check if business still has active subscription
                    subscription = db.query(BoltOnSubscription).filter(
                        BoltOnSubscription.business_id == integration.business_id,
                        BoltOnSubscription.bolt_on_type == "sumup_sync",
                        BoltOnSubscription.subscription_status == "active"
                    ).first()
                    
                    if not subscription:
                        logger.warning(f"Business {integration.business_id} no longer has active SumUp subscription")
                        integration.is_entitled = False
                        integration.is_enabled = False
                        db.commit()
                        continue
                    
                    # Perform sync
                    await self.sync_integration(integration, db)
                    
                except Exception as e:
                    logger.error(f"Error syncing integration for business {integration.business_id}: {str(e)}")
                    continue
                    
        except Exception as e:
            logger.error(f"Error in sync_all_integrations: {str(e)}")
        finally:
            db.close()
    
    async def sync_integration(self, integration: SumUpIntegration, db: Session):
        """Sync data for a specific integration"""
        try:
            sumup_service = SumUpIntegrationService(db)
            
            # Check if it's time to sync based on frequency
            last_sync = integration.last_sync_at
            sync_freq = integration.sync_frequency_hours or 1
            
            if last_sync:
                time_since_last_sync = datetime.now() - last_sync
                sync_frequency = timedelta(hours=sync_freq)
                
                if time_since_last_sync < sync_frequency:
                    logger.debug(f"Integration {integration.id} not due for sync yet")
                    return
            
            logger.info(f"Starting sync for integration {integration.id} (business {integration.business_id})")
            
            # Perform the sync
            from schemas import SumUpSyncRequest
            sync_request = SumUpSyncRequest(
                business_id=int(integration.business_id),
                force_sync=False  # Don't force sync for scheduled runs
            )
            
            result = sumup_service.sync_sales_data(sync_request)
            
            if result.success:
                logger.info(f"Successfully synced {result.transactions_synced} transactions for business {integration.business_id}")
            else:
                logger.error(f"Failed to sync integration {integration.id}: {result.message}")
                
        except Exception as e:
            logger.error(f"Error syncing integration {integration.id}: {str(e)}")
    
    async def manual_sync(self, business_id: int) -> bool:
        """Manually trigger a sync for a specific business"""
        db = next(get_db())
        
        try:
            integration = db.query(SumUpIntegration).filter(
                SumUpIntegration.business_id == business_id,
                SumUpIntegration.is_enabled == True
            ).first()
            
            if not integration:
                logger.warning(f"No active SumUp integration found for business {business_id}")
                return False
            
            await self.sync_integration(integration, db)
            return True
            
        except Exception as e:
            logger.error(f"Error in manual sync for business {business_id}: {str(e)}")
            return False
        finally:
            db.close()

# Global scheduler instance
sumup_scheduler = SumUpSyncScheduler()

async def start_sumup_scheduler():
    """Start the SumUp sync scheduler"""
    await sumup_scheduler.start()

def stop_sumup_scheduler():
    """Stop the SumUp sync scheduler"""
    sumup_scheduler.stop()

async def manual_sync_business(business_id: int) -> bool:
    """Manually sync a specific business"""
    return await sumup_scheduler.manual_sync(business_id) 