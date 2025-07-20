import os
import requests
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from cryptography.fernet import Fernet
import base64
from sqlalchemy import func

from models import (
    SumUpIntegration, SumUpLocation, SalesData, SalesItem, IntegrationLog,
    SalesAnalytics, StaffSalesPerformance, BoltOnSubscription, Business
)
from schemas import (
    SumUpOAuthRequest, SumUpOAuthResponse, SumUpSyncRequest, SumUpSyncResponse,
    SumUpDisconnectRequest, SumUpDisconnectResponse, SumUpStatusResponse,
    SumUpUpgradePrompt
)

logger = logging.getLogger(__name__)

class SumUpIntegrationService:
    """Service for managing SumUp POS integration as a paid bolt-on"""
    
    def __init__(self, db: Session):
        self.db = db
        self.base_url = "https://api.sumup.com/v0.1"
        self.client_id = os.getenv("SUMUP_CLIENT_ID")
        self.client_secret = os.getenv("SUMUP_CLIENT_SECRET")
        self.encryption_key = os.getenv("ENCRYPTION_KEY", "your-encryption-key-here")
        self.fernet = Fernet(base64.urlsafe_b64encode(self.encryption_key.encode()[:32].ljust(32, b'0')))
    
    def _encrypt_token(self, token: str) -> str:
        """Encrypt OAuth tokens for secure storage"""
        return self.fernet.encrypt(token.encode()).decode()
    
    def _decrypt_token(self, encrypted_token: str) -> str:
        """Decrypt OAuth tokens for API calls"""
        return self.fernet.decrypt(encrypted_token.encode()).decode()
    
    def _log_integration_operation(self, business_id: int, operation: str, status: str, 
                                 message: str = None, details: Dict = None, 
                                 error_code: str = None, error_message: str = None):
        """Log integration operations for audit trail"""
        log = IntegrationLog(
            business_id=business_id,
            integration_type="sumup",
            operation=operation,
            status=status,
            message=message,
            details=details,
            error_code=error_code,
            error_message=error_message
        )
        self.db.add(log)
        self.db.commit()
    
    def check_entitlement(self, business_id: int) -> bool:
        """Check if business has paid bolt-on subscription for SumUp integration"""
        # Check if business has active SumUp bolt-on subscription
        subscription = self.db.query(BoltOnSubscription).filter(
            BoltOnSubscription.business_id == business_id,
            BoltOnSubscription.bolt_on_type == "sumup_sync",
            BoltOnSubscription.subscription_status == "active"
        ).first()
        
        if subscription:
            # Update integration entitlement status
            integration = self.db.query(SumUpIntegration).filter(
                SumUpIntegration.business_id == business_id
            ).first()
            
            if integration:
                integration.is_entitled = True
                self.db.commit()
            
            return True
        
        return False
    
    def get_upgrade_prompt(self, business_id: int) -> SumUpUpgradePrompt:
        """Get upgrade prompt for businesses without SumUp bolt-on"""
        business = self.db.query(Business).filter(Business.id == business_id).first()
        
        return SumUpUpgradePrompt(
            show_upgrade=True,
            current_plan=business.subscription_tier if business else "starter",
            required_plan="professional",  # SumUp integration requires Pro or higher
            bolt_on_price=29.99,  # Monthly bolt-on price
            features_unlocked=[
                "Automated sales data sync",
                "Staff performance analytics",
                "Demand-driven scheduling",
                "Inventory insights",
                "Revenue optimization"
            ],
            upgrade_url="/billing/upgrade?bolt_on=sumup_sync"
        )
    
    def exchange_authorization_code(self, oauth_request: SumUpOAuthRequest) -> SumUpOAuthResponse:
        """Exchange authorization code for access token"""
        try:
            # Check entitlement first
            if not self.check_entitlement(oauth_request.business_id):
                return SumUpOAuthResponse(
                    success=False,
                    message="SumUp integration requires a paid bolt-on subscription",
                    error="subscription_required"
                )
            
            # Exchange authorization code for tokens
            token_url = "https://api.sumup.com/token"
            token_data = {
                "grant_type": "authorization_code",
                "code": oauth_request.authorization_code,
                "redirect_uri": oauth_request.redirect_uri,
                "client_id": self.client_id,
                "client_secret": self.client_secret
            }
            
            response = requests.post(token_url, data=token_data)
            
            if response.status_code != 200:
                self._log_integration_operation(
                    oauth_request.business_id, "oauth_exchange", "error",
                    f"Token exchange failed: {response.status_code}",
                    {"response": response.text}
                )
                return SumUpOAuthResponse(
                    success=False,
                    message="Failed to authenticate with SumUp",
                    error="oauth_failed"
                )
            
            token_response = response.json()
            
            # Get merchant information
            merchant_info = self._get_merchant_info(token_response["access_token"])
            
            # Store integration configuration
            integration = self.db.query(SumUpIntegration).filter(
                SumUpIntegration.business_id == oauth_request.business_id
            ).first()
            
            if not integration:
                integration = SumUpIntegration(
                    business_id=oauth_request.business_id,
                    is_enabled=True,
                    is_entitled=True,
                    access_token=self._encrypt_token(token_response["access_token"]),
                    refresh_token=self._encrypt_token(token_response["refresh_token"]),
                    token_expires_at=datetime.now() + timedelta(seconds=token_response["expires_in"]),
                    merchant_id=merchant_info.get("merchant_id")
                )
                self.db.add(integration)
            else:
                integration.is_enabled = True
                integration.is_entitled = True
                integration.access_token = self._encrypt_token(token_response["access_token"])
                integration.refresh_token = self._encrypt_token(token_response["refresh_token"])
                integration.token_expires_at = datetime.now() + timedelta(seconds=token_response["expires_in"])
                integration.merchant_id = merchant_info.get("merchant_id")
            
            self.db.commit()
            
            # Sync locations
            self._sync_locations(oauth_request.business_id)
            
            self._log_integration_operation(
                oauth_request.business_id, "oauth_exchange", "success",
                "Successfully authenticated with SumUp"
            )
            
            return SumUpOAuthResponse(
                success=True,
                message="Successfully connected to SumUp",
                integration_id=integration.id
            )
            
        except Exception as e:
            logger.error(f"Error in OAuth exchange: {str(e)}")
            self._log_integration_operation(
                oauth_request.business_id, "oauth_exchange", "error",
                f"OAuth exchange error: {str(e)}"
            )
            return SumUpOAuthResponse(
                success=False,
                message="An error occurred during authentication",
                error="internal_error"
            )
    
    def _get_merchant_info(self, access_token: str) -> Dict[str, Any]:
        """Get merchant information from SumUp API"""
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.get(f"{self.base_url}/me", headers=headers)
        
        if response.status_code == 200:
            return response.json()
        return {}
    
    def _sync_locations(self, business_id: int):
        """Sync SumUp locations to LocalOps"""
        integration = self.db.query(SumUpIntegration).filter(
            SumUpIntegration.business_id == business_id,
            SumUpIntegration.is_enabled == True
        ).first()
        
        if not integration:
            return
        
        try:
            access_token = self._get_valid_access_token(integration)
            headers = {"Authorization": f"Bearer {access_token}"}
            
            response = requests.get(f"{self.base_url}/me/locations", headers=headers)
            
            if response.status_code == 200:
                locations = response.json()
                
                for location in locations:
                    # Check if location already exists
                    existing = self.db.query(SumUpLocation).filter(
                        SumUpLocation.business_id == business_id,
                        SumUpLocation.sumup_location_id == location["id"]
                    ).first()
                    
                    if not existing:
                        sumup_location = SumUpLocation(
                            business_id=business_id,
                            sumup_location_id=location["id"],
                            sumup_location_name=location.get("name", "Unknown Location")
                        )
                        self.db.add(sumup_location)
                
                self.db.commit()
                
        except Exception as e:
            logger.error(f"Error syncing locations: {str(e)}")
    
    def _get_valid_access_token(self, integration: SumUpIntegration) -> str:
        """Get valid access token, refreshing if necessary"""
        if integration.token_expires_at and integration.token_expires_at <= datetime.now():
            # Token expired, refresh it
            self._refresh_access_token(integration)
        
        return self._decrypt_token(integration.access_token)
    
    def _refresh_access_token(self, integration: SumUpIntegration):
        """Refresh expired access token"""
        try:
            refresh_token = self._decrypt_token(integration.refresh_token)
            
            token_url = "https://api.sumup.com/token"
            token_data = {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": self.client_id,
                "client_secret": self.client_secret
            }
            
            response = requests.post(token_url, data=token_data)
            
            if response.status_code == 200:
                token_response = response.json()
                
                integration.access_token = self._encrypt_token(token_response["access_token"])
                integration.refresh_token = self._encrypt_token(token_response["refresh_token"])
                integration.token_expires_at = datetime.now() + timedelta(seconds=token_response["expires_in"])
                
                self.db.commit()
                
                self._log_integration_operation(
                    integration.business_id, "token_refresh", "success",
                    "Successfully refreshed access token"
                )
            else:
                # Refresh failed, mark integration as disconnected
                integration.is_enabled = False
                self.db.commit()
                
                self._log_integration_operation(
                    integration.business_id, "token_refresh", "error",
                    f"Token refresh failed: {response.status_code}"
                )
                
        except Exception as e:
            logger.error(f"Error refreshing token: {str(e)}")
            integration.is_enabled = False
            self.db.commit()
    
    def sync_sales_data(self, sync_request: SumUpSyncRequest) -> SumUpSyncResponse:
        """Sync sales data from SumUp POS"""
        start_time = datetime.now()
        
        # Check entitlement
        if not self.check_entitlement(sync_request.business_id):
            return SumUpSyncResponse(
                success=False,
                message="SumUp integration requires a paid bolt-on subscription"
            )
        
        integration = self.db.query(SumUpIntegration).filter(
            SumUpIntegration.business_id == sync_request.business_id,
            SumUpIntegration.is_enabled == True
        ).first()
        
        if not integration:
            return SumUpSyncResponse(
                success=False,
                message="SumUp integration is not connected"
            )
        
        try:
            access_token = self._get_valid_access_token(integration)
            headers = {"Authorization": f"Bearer {access_token}"}
            
            # Determine sync date range
            if sync_request.sync_from_date:
                from_date = datetime.fromisoformat(sync_request.sync_from_date)
            else:
                # Default to last 7 days if no specific date
                from_date = datetime.now() - timedelta(days=7)
            
            to_date = datetime.now()
            
            # Get transactions from SumUp
            transactions_url = f"{self.base_url}/me/transactions"
            params = {
                "from": from_date.isoformat(),
                "to": to_date.isoformat(),
                "limit": 1000  # Adjust based on API limits
            }
            
            response = requests.get(transactions_url, headers=headers, params=params)
            
            if response.status_code != 200:
                self._log_integration_operation(
                    sync_request.business_id, "sync_sales", "error",
                    f"Failed to fetch transactions: {response.status_code}"
                )
                return SumUpSyncResponse(
                    success=False,
                    message="Failed to fetch sales data from SumUp"
                )
            
            transactions = response.json()
            synced_count = 0
            errors = []
            
            for transaction in transactions:
                try:
                    # Check if transaction already exists
                    existing = self.db.query(SalesData).filter(
                        SalesData.business_id == sync_request.business_id,
                        SalesData.sumup_transaction_id == transaction["id"]
                    ).first()
                    
                    if existing:
                        continue  # Skip already synced transactions
                    
                    # Create sales data record
                    sale_data = SalesData(
                        business_id=sync_request.business_id,
                        sumup_transaction_id=transaction["id"],
                        sumup_location_id=transaction.get("location_id", ""),
                        sale_time=datetime.fromisoformat(transaction["timestamp"]),
                        sale_value=float(transaction["amount"]),
                        payment_type=transaction.get("payment_type"),
                        items=transaction.get("items", []),
                        customer_count=transaction.get("customer_count", 1),
                        tip_amount=float(transaction.get("tip_amount", 0)),
                        discount_amount=float(transaction.get("discount_amount", 0)),
                        tax_amount=float(transaction.get("tax_amount", 0))
                    )
                    
                    self.db.add(sale_data)
                    self.db.flush()  # Get the ID
                    
                    # Create sales items
                    for item in transaction.get("items", []):
                        sale_item = SalesItem(
                            sale_id=sale_data.id,
                            item_sku=item.get("sku"),
                            item_name=item.get("name", "Unknown Item"),
                            quantity=float(item.get("quantity", 1)),
                            unit_price=float(item.get("unit_price", 0)),
                            total_price=float(item.get("total_price", 0)),
                            category=item.get("category")
                        )
                        self.db.add(sale_item)
                    
                    synced_count += 1
                    
                except Exception as e:
                    errors.append(f"Error processing transaction {transaction.get('id', 'unknown')}: {str(e)}")
            
            # Update last sync time
            integration.last_sync_at = datetime.now()
            self.db.commit()
            
            sync_duration = (datetime.now() - start_time).total_seconds()
            
            self._log_integration_operation(
                sync_request.business_id, "sync_sales", "success",
                f"Synced {synced_count} transactions",
                {"synced_count": synced_count, "errors": len(errors)}
            )
            
            return SumUpSyncResponse(
                success=True,
                message=f"Successfully synced {synced_count} transactions",
                transactions_synced=synced_count,
                errors=errors,
                sync_duration_seconds=sync_duration
            )
            
        except Exception as e:
            logger.error(f"Error syncing sales data: {str(e)}")
            self._log_integration_operation(
                sync_request.business_id, "sync_sales", "error",
                f"Sales sync error: {str(e)}"
            )
            return SumUpSyncResponse(
                success=False,
                message="An error occurred during sales sync"
            )
    
    def disconnect_integration(self, disconnect_request: SumUpDisconnectRequest) -> SumUpDisconnectResponse:
        """Disconnect SumUp integration"""
        integration = self.db.query(SumUpIntegration).filter(
            SumUpIntegration.business_id == disconnect_request.business_id
        ).first()
        
        if not integration:
            return SumUpDisconnectResponse(
                success=False,
                message="No SumUp integration found"
            )
        
        try:
            if disconnect_request.revoke_tokens and integration.access_token:
                # Revoke tokens with SumUp
                access_token = self._decrypt_token(integration.access_token)
                headers = {"Authorization": f"Bearer {access_token}"}
                
                revoke_url = "https://api.sumup.com/revoke"
                response = requests.post(revoke_url, headers=headers)
                
                tokens_revoked = response.status_code == 200
            else:
                tokens_revoked = False
            
            # Disable integration
            integration.is_enabled = False
            integration.access_token = None
            integration.refresh_token = None
            integration.token_expires_at = None
            
            self.db.commit()
            
            self._log_integration_operation(
                disconnect_request.business_id, "disconnect", "success",
                "SumUp integration disconnected"
            )
            
            return SumUpDisconnectResponse(
                success=True,
                message="SumUp integration disconnected successfully",
                tokens_revoked=tokens_revoked
            )
            
        except Exception as e:
            logger.error(f"Error disconnecting integration: {str(e)}")
            return SumUpDisconnectResponse(
                success=False,
                message="An error occurred while disconnecting"
            )
    
    def get_integration_status(self, business_id: int) -> SumUpStatusResponse:
        """Get current integration status"""
        integration = self.db.query(SumUpIntegration).filter(
            SumUpIntegration.business_id == business_id
        ).first()
        
        if not integration:
            return SumUpStatusResponse(
                is_connected=False,
                is_entitled=False,
                sync_frequency_hours=1,
                connection_status="disconnected"
            )
        
        # Check entitlement
        is_entitled = self.check_entitlement(business_id)
        
        # Determine connection status
        if not integration.is_enabled:
            connection_status = "disconnected"
        elif integration.token_expires_at and integration.token_expires_at <= datetime.now():
            connection_status = "expired"
        elif not integration.access_token:
            connection_status = "error"
        else:
            connection_status = "connected"
        
        # Get location count
        location_count = self.db.query(SumUpLocation).filter(
            SumUpLocation.business_id == business_id,
            SumUpLocation.is_active == True
        ).count()
        
        # Get transaction count
        total_transactions = self.db.query(SalesData).filter(
            SalesData.business_id == business_id
        ).count()
        
        # Get last 7 days sales
        seven_days_ago = datetime.now() - timedelta(days=7)
        last_7_days_sales = self.db.query(SalesData).filter(
            SalesData.business_id == business_id,
            SalesData.sale_time >= seven_days_ago
        ).with_entities(func.sum(SalesData.sale_value)).scalar() or 0
        
        return SumUpStatusResponse(
            is_connected=integration.is_enabled and connection_status == "connected",
            is_entitled=is_entitled,
            last_sync_at=integration.last_sync_at,
            sync_frequency_hours=integration.sync_frequency_hours,
            merchant_id=integration.merchant_id,
            location_count=location_count,
            total_transactions=total_transactions,
            last_7_days_sales=last_7_days_sales,
            connection_status=connection_status
        ) 