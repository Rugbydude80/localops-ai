"""
Supabase Database Interface for LocalOps AI
This module provides a database interface using Supabase client instead of direct SQLAlchemy connections
"""

import os
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime
import logging

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class SupabaseDatabase:
    """Database interface using Supabase client"""
    
    def __init__(self):
        self.supabase_url = os.environ.get("SUPABASE_URL")
        self.supabase_key = os.environ.get("SUPABASE_ANON_KEY")
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Missing Supabase URL or key")
        
        self.client: Client = create_client(self.supabase_url, self.supabase_key)
    
    def get_businesses(self) -> List[Dict[str, Any]]:
        """Get all businesses"""
        try:
            response = self.client.table('businesses').select('*').execute()
            return response.data
        except Exception as e:
            logger.error(f"Error getting businesses: {e}")
            return []
    
    def get_business(self, business_id: int) -> Optional[Dict[str, Any]]:
        """Get a specific business by ID"""
        try:
            response = self.client.table('businesses').select('*').eq('id', business_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error getting business {business_id}: {e}")
            return None
    
    def get_staff(self, business_id: int) -> List[Dict[str, Any]]:
        """Get all staff for a business"""
        try:
            response = self.client.table('staff').select('*').eq('business_id', business_id).eq('is_active', True).execute()
            return response.data
        except Exception as e:
            logger.error(f"Error getting staff for business {business_id}: {e}")
            return []
    
    def get_staff_member(self, staff_id: int) -> Optional[Dict[str, Any]]:
        """Get a specific staff member by ID"""
        try:
            response = self.client.table('staff').select('*').eq('id', staff_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error getting staff member {staff_id}: {e}")
            return None
    
    def create_staff(self, staff_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new staff member"""
        try:
            response = self.client.table('staff').insert(staff_data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error creating staff: {e}")
            return None
    
    def update_staff(self, staff_id: int, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a staff member"""
        try:
            response = self.client.table('staff').update(updates).eq('id', staff_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error updating staff {staff_id}: {e}")
            return None
    
    def delete_staff(self, staff_id: int) -> bool:
        """Soft delete a staff member (set is_active to False)"""
        try:
            response = self.client.table('staff').update({'is_active': False}).eq('id', staff_id).execute()
            return len(response.data) > 0
        except Exception as e:
            logger.error(f"Error deleting staff {staff_id}: {e}")
            return False
    
    def get_shifts(self, business_id: int, start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get shifts for a business"""
        try:
            query = self.client.table('shifts').select('*').eq('business_id', business_id)
            
            if start_date:
                query = query.gte('date', start_date)
            if end_date:
                query = query.lte('date', end_date)
            
            response = query.execute()
            return response.data
        except Exception as e:
            logger.error(f"Error getting shifts for business {business_id}: {e}")
            return []
    
    def create_shift(self, shift_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new shift"""
        try:
            response = self.client.table('shifts').insert(shift_data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error creating shift: {e}")
            return None
    
    def get_emergency_requests(self, business_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """Get emergency requests for a business"""
        try:
            response = self.client.table('emergency_requests').select('*').eq('business_id', business_id).limit(limit).execute()
            return response.data
        except Exception as e:
            logger.error(f"Error getting emergency requests for business {business_id}: {e}")
            return []
    
    def create_emergency_request(self, request_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new emergency request"""
        try:
            response = self.client.table('emergency_requests').insert(request_data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error creating emergency request: {e}")
            return None
    
    def get_sick_leave_requests(self, business_id: int) -> List[Dict[str, Any]]:
        """Get sick leave requests for a business"""
        try:
            response = self.client.table('sick_leave_requests').select('*').eq('business_id', business_id).execute()
            return response.data
        except Exception as e:
            logger.error(f"Error getting sick leave requests for business {business_id}: {e}")
            return []
    
    def create_sick_leave_request(self, request_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new sick leave request"""
        try:
            response = self.client.table('sick_leave_requests').insert(request_data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error creating sick leave request: {e}")
            return None

# Global database instance
db = SupabaseDatabase()

def get_supabase_db() -> SupabaseDatabase:
    """Get the global Supabase database instance"""
    return db 