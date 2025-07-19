"""
Authentication and Authorization System for LocalOps AI
Production-ready authentication with JWT tokens and role-based access control
"""

import os
import jwt
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
import logging

from database import get_db
from models import Staff, UserRole, RolePermission

logger = logging.getLogger(__name__)

# Security configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

security = HTTPBearer()

# Pydantic models for authentication
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone_number: str
    business_id: int
    role: str = "staff"

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user_info: Dict[str, Any]

class TokenData(BaseModel):
    user_id: Optional[int] = None
    business_id: Optional[int] = None
    role: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class AuthService:
    """Authentication service for handling user authentication and authorization"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        try:
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        except Exception as e:
            logger.error(f"Password verification error: {e}")
            return False
    
    def hash_password(self, password: str) -> str:
        """Hash a password using bcrypt"""
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create a JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire, "type": "access"})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    
    def create_refresh_token(self, data: Dict[str, Any]) -> str:
        """Create a JWT refresh token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({"exp": expire, "type": "refresh"})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode a JWT token"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Token expired")
            return None
        except jwt.JWTError as e:
            logger.error(f"JWT verification error: {e}")
            return None
    
    def authenticate_user(self, email: str, password: str) -> Optional[Staff]:
        """Authenticate a user with email and password"""
        try:
            user = self.db.query(Staff).filter(
                Staff.email == email,
                Staff.is_active == True
            ).first()
            
            if not user:
                return None
            
            if not self.verify_password(password, user.password_hash):
                return None
            
            return user
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            return None
    
    def register_user(self, user_data: UserRegister) -> Staff:
        """Register a new user"""
        try:
            # Check if user already exists
            existing_user = self.db.query(Staff).filter(
                Staff.email == user_data.email
            ).first()
            
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User with this email already exists"
                )
            
            # Hash password
            hashed_password = self.hash_password(user_data.password)
            
            # Create user
            user = Staff(
                business_id=user_data.business_id,
                name=user_data.name,
                email=user_data.email,
                phone_number=user_data.phone_number,
                role=user_data.role,
                user_role="staff",  # Default role
                password_hash=hashed_password,
                is_active=True
            )
            
            self.db.add(user)
            self.db.commit()
            self.db.refresh(user)
            
            return user
        except Exception as e:
            self.db.rollback()
            logger.error(f"User registration error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to register user"
            )
    
    def change_password(self, user_id: int, current_password: str, new_password: str) -> bool:
        """Change user password"""
        try:
            user = self.db.query(Staff).filter(Staff.id == user_id).first()
            if not user:
                return False
            
            if not self.verify_password(current_password, user.password_hash):
                return False
            
            user.password_hash = self.hash_password(new_password)
            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            logger.error(f"Password change error: {e}")
            return False
    
    def get_user_permissions(self, user_id: int) -> List[str]:
        """Get user permissions based on their role"""
        try:
            user = self.db.query(Staff).filter(Staff.id == user_id).first()
            if not user:
                return []
            
            permissions = self.db.query(RolePermission).filter(
                RolePermission.role_name == user.user_role,
                RolePermission.permission_value == True
            ).all()
            
            return [p.permission_name for p in permissions]
        except Exception as e:
            logger.error(f"Permission retrieval error: {e}")
            return []
    
    def has_permission(self, user_id: int, permission: str) -> bool:
        """Check if user has a specific permission"""
        permissions = self.get_user_permissions(user_id)
        return permission in permissions
    
    def can_manage_user(self, manager_id: int, target_user_id: int) -> bool:
        """Check if a user can manage another user based on role hierarchy"""
        try:
            manager = self.db.query(Staff).filter(Staff.id == manager_id).first()
            target = self.db.query(Staff).filter(Staff.id == target_user_id).first()
            
            if not manager or not target:
                return False
            
            # Get role levels
            manager_role = self.db.query(UserRole).filter(
                UserRole.role_name == manager.user_role
            ).first()
            
            target_role = self.db.query(UserRole).filter(
                UserRole.role_name == target.user_role
            ).first()
            
            if not manager_role or not target_role:
                return False
            
            # Manager can manage users with lower or equal role level
            return manager_role.role_level >= target_role.role_level
        except Exception as e:
            logger.error(f"User management check error: {e}")
            return False

# Dependency functions
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Staff:
    """Get current authenticated user"""
    auth_service = AuthService(db)
    
    token = credentials.credentials
    payload = auth_service.verify_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("user_id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(Staff).filter(Staff.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user

def get_current_active_user(current_user: Staff = Depends(get_current_user)) -> Staff:
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user

def require_permission(permission: str):
    """Decorator to require a specific permission"""
    def permission_checker(current_user: Staff = Depends(get_current_user), db: Session = Depends(get_db)):
        auth_service = AuthService(db)
        if not auth_service.has_permission(current_user.id, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required"
            )
        return current_user
    return permission_checker

def require_role(role: str):
    """Decorator to require a specific role"""
    def role_checker(current_user: Staff = Depends(get_current_user)):
        if current_user.user_role != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' required"
            )
        return current_user
    return role_checker

def require_minimum_role(minimum_role_level: int):
    """Decorator to require a minimum role level"""
    def role_checker(current_user: Staff = Depends(get_current_user), db: Session = Depends(get_db)):
        user_role = db.query(UserRole).filter(
            UserRole.role_name == current_user.user_role
        ).first()
        
        if not user_role or user_role.role_level < minimum_role_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role level"
            )
        return current_user
    return role_checker

# Common permission decorators
require_admin = require_permission("manage_all_staff")
require_manager = require_minimum_role(60)  # Manager level and above
require_supervisor = require_minimum_role(40)  # Supervisor level and above
require_staff = require_minimum_role(20)  # Staff level and above

# Business-specific access control
def require_business_access(business_id_param: str = "business_id"):
    """Decorator to ensure user has access to the specified business"""
    def business_checker(
        current_user: Staff = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        # Superadmin can access all businesses
        if current_user.user_role == "superadmin":
            return current_user
        
        # Check if user belongs to the business
        if current_user.business_id != business_id_param:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this business"
            )
        
        return current_user
    return business_checker 