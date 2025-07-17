#!/usr/bin/env python3
"""
Database initialization script for LocalOps AI
Creates sample data for testing and development
"""

import asyncio
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from models import Business, Staff, EmergencyRequest

def create_sample_data():
    """Create sample data for testing"""
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Check if data already exists
        if db.query(Business).first():
            print("Sample data already exists. Skipping...")
            return
        
        # Create sample business
        business = Business(
            name="Milano's Kitchen",
            type="italian_restaurant",
            phone_number="+44 20 7123 4567",
            email="marco@milanos.co.uk",
            address="123 High Street, London, SW1A 1AA",
            owner_name="Marco Rossi",
            subscription_tier="professional"
        )
        db.add(business)
        db.commit()
        db.refresh(business)
        
        # Create sample staff
        staff_members = [
            {
                "name": "Sarah Johnson",
                "phone_number": "+44 7700 900001",
                "email": "sarah@milanos.co.uk",
                "role": "head_chef",
                "skills": ["kitchen", "management"],
                "reliability_score": 9.2
            },
            {
                "name": "Tom Wilson",
                "phone_number": "+44 7700 900002",
                "email": "tom@milanos.co.uk",
                "role": "sous_chef",
                "skills": ["kitchen"],
                "reliability_score": 8.5
            },
            {
                "name": "Emma Davis",
                "phone_number": "+44 7700 900003",
                "email": "emma@milanos.co.uk",
                "role": "server",
                "skills": ["front_of_house"],
                "reliability_score": 7.8
            },
            {
                "name": "James Brown",
                "phone_number": "+44 7700 900004",
                "email": "james@milanos.co.uk",
                "role": "bartender",
                "skills": ["bar", "front_of_house"],
                "reliability_score": 8.9
            },
            {
                "name": "Lisa Garcia",
                "phone_number": "+44 7700 900005",
                "email": "lisa@milanos.co.uk",
                "role": "server",
                "skills": ["front_of_house", "bar"],
                "reliability_score": 6.5
            },
            {
                "name": "Mike Taylor",
                "phone_number": "+44 7700 900006",
                "email": "mike@milanos.co.uk",
                "role": "line_cook",
                "skills": ["kitchen"],
                "reliability_score": 7.2
            }
        ]
        
        for staff_data in staff_members:
            staff = Staff(
                business_id=business.id,
                name=staff_data["name"],
                phone_number=staff_data["phone_number"],
                email=staff_data["email"],
                role=staff_data["role"],
                skills=staff_data["skills"],
                reliability_score=staff_data["reliability_score"],
                availability={
                    "monday": ["09:00-17:00"],
                    "tuesday": ["09:00-17:00"],
                    "wednesday": ["09:00-17:00"],
                    "thursday": ["09:00-17:00"],
                    "friday": ["09:00-22:00"],
                    "saturday": ["09:00-22:00"],
                    "sunday": ["12:00-20:00"]
                },
                hired_date=datetime.now() - timedelta(days=30),
                is_active=True
            )
            db.add(staff)
        
        db.commit()
        
        # Create sample emergency requests
        sample_requests = [
            {
                "shift_date": datetime.now() + timedelta(days=1),
                "shift_start": "18:00",
                "shift_end": "23:00",
                "required_skill": "kitchen",
                "urgency": "high",
                "message": "Head chef called in sick, need experienced kitchen staff",
                "status": "pending"
            },
            {
                "shift_date": datetime.now() + timedelta(days=2),
                "shift_start": "12:00",
                "shift_end": "16:00",
                "required_skill": "front_of_house",
                "urgency": "normal",
                "message": "Lunch service coverage needed",
                "status": "filled"
            }
        ]
        
        for req_data in sample_requests:
            request = EmergencyRequest(
                business_id=business.id,
                shift_date=req_data["shift_date"],
                shift_start=req_data["shift_start"],
                shift_end=req_data["shift_end"],
                required_skill=req_data["required_skill"],
                urgency=req_data["urgency"],
                message=req_data["message"],
                status=req_data["status"],
                created_at=datetime.now() - timedelta(hours=2)
            )
            db.add(request)
        
        db.commit()
        
        print("✅ Sample data created successfully!")
        print(f"   Business: {business.name}")
        print(f"   Staff members: {len(staff_members)}")
        print(f"   Emergency requests: {len(sample_requests)}")
        
    except Exception as e:
        print(f"❌ Error creating sample data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_sample_data()