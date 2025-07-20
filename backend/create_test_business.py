#!/usr/bin/env python3

from database import get_db, engine, Base
from models import Business
from sqlalchemy.orm import sessionmaker

# Create database tables if they don't exist
Base.metadata.create_all(bind=engine)

# Create a session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    # Check if business with ID 1 already exists
    existing_business = db.query(Business).filter(Business.id == 1).first()
    
    if existing_business:
        print(f"Business with ID 1 already exists: {existing_business.name}")
    else:
        # Create a test business
        test_business = Business(
            id=1,
            name="Test Restaurant",
            type="restaurant",
            phone_number="+1234567890",
            email="test@restaurant.com",
            address="123 Test Street, Test City",
            owner_name="Test Owner",
            subscription_tier="starter",
            is_active=True
        )
        
        db.add(test_business)
        db.commit()
        print("Created test business with ID 1")
        
except Exception as e:
    print(f"Error: {e}")
    db.rollback()
finally:
    db.close() 