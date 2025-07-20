#!/usr/bin/env python3
"""
Test script for SumUp POS integration
"""

import os
import sys
import asyncio
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import get_db, engine, Base
from models import (
    Business, SumUpIntegration, BoltOnSubscription, 
    SumUpLocation, SalesData, IntegrationLog
)
from services.sumup_integration import SumUpIntegrationService
from schemas import (
    SumUpOAuthRequest, SumUpSyncRequest, SumUpDisconnectRequest,
    SumUpUpgradePrompt
)

def create_test_business():
    """Create a test business for integration testing"""
    db = next(get_db())
    
    try:
        # Check if test business already exists
        business = db.query(Business).filter(Business.name == "Test SumUp Business").first()
        if business:
            print(f"Using existing test business: {business.id}")
            return business
        
        # Create new test business
        business = Business(
            name="Test SumUp Business",
            type="restaurant",
            phone_number="+44 20 7123 4567",
            email="test@sumup.localops.ai",
            address="123 Test Street, London, SW1A 1AA",
            owner_name="Test Owner",
            subscription_tier="professional",
            is_active=True
        )
        db.add(business)
        db.commit()
        db.refresh(business)
        
        print(f"Created test business: {business.id}")
        return business
        
    except Exception as e:
        print(f"Error creating test business: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def create_test_subscription(business_id: int):
    """Create a test SumUp bolt-on subscription"""
    db = next(get_db())
    
    try:
        # Check if subscription already exists
        subscription = db.query(BoltOnSubscription).filter(
            BoltOnSubscription.business_id == business_id,
            BoltOnSubscription.bolt_on_type == "sumup_sync"
        ).first()
        
        if subscription:
            print(f"Using existing subscription: {subscription.id}")
            return subscription
        
        # Create new subscription
        subscription = BoltOnSubscription(
            business_id=business_id,
            bolt_on_type="sumup_sync",
            subscription_status="active",
            start_date=datetime.now().date(),
            monthly_price=29.99,
            features_enabled=["sales_sync", "analytics", "scheduling_insights"]
        )
        db.add(subscription)
        db.commit()
        db.refresh(subscription)
        
        print(f"Created test subscription: {subscription.id}")
        return subscription
        
    except Exception as e:
        print(f"Error creating test subscription: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def test_entitlement_check():
    """Test entitlement checking functionality"""
    print("\n=== Testing Entitlement Check ===")
    
    business = create_test_business()
    db = next(get_db())
    
    try:
        sumup_service = SumUpIntegrationService(db)
        
        # Test without subscription
        is_entitled = sumup_service.check_entitlement(int(business.id))
        print(f"Entitlement without subscription: {is_entitled}")
        
        # Create subscription and test again
        create_test_subscription(int(business.id))
        is_entitled = sumup_service.check_entitlement(int(business.id))
        print(f"Entitlement with subscription: {is_entitled}")
        
    except Exception as e:
        print(f"Error testing entitlement: {e}")
    finally:
        db.close()

def test_upgrade_prompt():
    """Test upgrade prompt functionality"""
    print("\n=== Testing Upgrade Prompt ===")
    
    business = create_test_business()
    db = next(get_db())
    
    try:
        sumup_service = SumUpIntegrationService(db)
        upgrade_prompt = sumup_service.get_upgrade_prompt(business.id)
        
        print(f"Upgrade prompt: {upgrade_prompt}")
        print(f"Show upgrade: {upgrade_prompt.show_upgrade}")
        print(f"Current plan: {upgrade_prompt.current_plan}")
        print(f"Required plan: {upgrade_prompt.required_plan}")
        print(f"Bolt-on price: £{upgrade_prompt.bolt_on_price}")
        print(f"Features unlocked: {upgrade_prompt.features_unlocked}")
        
    except Exception as e:
        print(f"Error testing upgrade prompt: {e}")
    finally:
        db.close()

def test_integration_status():
    """Test integration status functionality"""
    print("\n=== Testing Integration Status ===")
    
    business = create_test_business()
    db = next(get_db())
    
    try:
        sumup_service = SumUpIntegrationService(db)
        status = sumup_service.get_integration_status(business.id)
        
        print(f"Integration status: {status}")
        print(f"Is connected: {status.is_connected}")
        print(f"Is entitled: {status.is_entitled}")
        print(f"Connection status: {status.connection_status}")
        
    except Exception as e:
        print(f"Error testing integration status: {e}")
    finally:
        db.close()

def test_integration_logging():
    """Test integration logging functionality"""
    print("\n=== Testing Integration Logging ===")
    
    business = create_test_business()
    db = next(get_db())
    
    try:
        sumup_service = SumUpIntegrationService(db)
        
        # Test logging an operation
        sumup_service._log_integration_operation(
            business_id=business.id,
            operation="test_operation",
            status="success",
            message="Test log entry",
            details={"test": "data"}
        )
        
        # Check if log was created
        logs = db.query(IntegrationLog).filter(
            IntegrationLog.business_id == business.id,
            IntegrationLog.integration_type == "sumup"
        ).all()
        
        print(f"Created {len(logs)} log entries")
        for log in logs:
            print(f"  - {log.operation}: {log.status} - {log.message}")
        
    except Exception as e:
        print(f"Error testing integration logging: {e}")
    finally:
        db.close()

def test_disconnect_integration():
    """Test disconnecting an integration"""
    print("\n=== Testing Disconnect Integration ===")
    
    business = create_test_business()
    db = next(get_db())
    
    try:
        sumup_service = SumUpIntegrationService(db)
        
        # Create a test integration
        integration = SumUpIntegration(
            business_id=business.id,
            is_enabled=True,
            is_entitled=True,
            access_token="test_token",
            refresh_token="test_refresh",
            merchant_id="test_merchant"
        )
        db.add(integration)
        db.commit()
        
        print(f"Created test integration: {integration.id}")
        
        # Test disconnecting
        disconnect_request = SumUpDisconnectRequest(
            business_id=business.id,
            revoke_tokens=False
        )
        
        result = sumup_service.disconnect_integration(disconnect_request)
        print(f"Disconnect result: {result}")
        
    except Exception as e:
        print(f"Error testing disconnect: {e}")
        db.rollback()
    finally:
        db.close()

def test_database_tables():
    """Test that all required database tables exist"""
    print("\n=== Testing Database Tables ===")
    
    db = next(get_db())
    
    try:
        # Test table existence by querying them
        tables_to_test = [
            ('sumup_integrations', SumUpIntegration),
            ('sumup_locations', SumUpLocation),
            ('sales_data', SalesData),
            ('integration_logs', IntegrationLog),
            ('bolt_on_subscriptions', BoltOnSubscription)
        ]
        
        for table_name, model in tables_to_test:
            try:
                count = db.query(model).count()
                print(f"✓ {table_name}: {count} records")
            except Exception as e:
                print(f"✗ {table_name}: Error - {e}")
        
    except Exception as e:
        print(f"Error testing database tables: {e}")
    finally:
        db.close()

def main():
    """Run all tests"""
    print("Starting SumUp Integration Tests")
    print("=" * 50)
    
    # Create database tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    try:
        test_database_tables()
        test_entitlement_check()
        test_upgrade_prompt()
        test_integration_status()
        test_integration_logging()
        test_disconnect_integration()
        
        print("\n" + "=" * 50)
        print("All tests completed successfully!")
        
    except Exception as e:
        print(f"\nTest failed with error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 