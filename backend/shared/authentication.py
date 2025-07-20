"""
Enhanced Authentication Service for Dual Admin Architecture
Supports platform owner and workspace admin authentication with 2FA
"""

import jwt
import bcrypt
import pyotp
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import Staff, Business, UserRole
from shared.audit_logging import AuditLogger

# Security configuration
JWT_SECRET_KEY = "your-super-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15  # Short timeout for platform admin
REFRESH_TOKEN_EXPIRE_DAYS = 7

# 2FA configuration
TOTP_ISSUER = "SynqForge"
TOTP_DIGITS = 6
TOTP_PERIOD = 30

class AuthTokens(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class PlatformAuthRequest(BaseModel):
    email: str
    password: str
    totp_code: str
    ip_address: str

class WorkspaceAuthRequest(BaseModel):
    workspace_id: str
    email: str
    password: str
    ip_address: str

class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_logger = AuditLogger(db)
        self.security = HTTPBearer()
    
    def authenticate_platform_admin(self, email: str, password: str, totp_code: str, ip_address: str) -> AuthTokens:
        """Authenticate platform admin with 2FA"""
        try:
            # Find platform admin user
            user = self.db.query(Staff).filter(
                Staff.email == email,
                Staff.user_role == "superadmin",
                Staff.is_active == True
            ).first()
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials"
                )
            
            # Verify password
            if not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
                self.audit_logger.log_failed_login(email, ip_address, "platform_admin", "invalid_password")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials"
                )
            
            # Verify 2FA code
            if not self._verify_totp(user, totp_code):
                self.audit_logger.log_failed_login(email, ip_address, "platform_admin", "invalid_2fa")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid 2FA code"
                )
            
            # Generate tokens
            tokens = self._generate_tokens(user.id, "platform_admin", None)
            
            # Log successful login
            self.audit_logger.log_successful_login(user.id, ip_address, "platform_admin")
            
            return tokens
            
        except HTTPException:
            raise
        except Exception as e:
            self.audit_logger.log_error("platform_auth", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication failed"
            )
    
    def authenticate_workspace_admin(self, workspace_id: str, email: str, password: str, ip_address: str) -> AuthTokens:
        """Authenticate workspace admin"""
        try:
            # Verify workspace exists and is active
            workspace = self.db.query(Business).filter(
                Business.id == workspace_id,
                Business.is_active == True
            ).first()
            
            if not workspace:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Workspace not found"
                )
            
            # Find workspace admin user
            user = self.db.query(Staff).filter(
                Staff.email == email,
                Staff.business_id == workspace_id,
                Staff.user_role.in_(["admin", "manager"]),
                Staff.is_active == True
            ).first()
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials"
                )
            
            # Verify password
            if not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
                self.audit_logger.log_failed_login(email, ip_address, "workspace_admin", "invalid_password")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials"
                )
            
            # Generate tokens
            tokens = self._generate_tokens(user.id, "workspace_admin", workspace_id)
            
            # Log successful login
            self.audit_logger.log_successful_login(user.id, ip_address, "workspace_admin")
            
            return tokens
            
        except HTTPException:
            raise
        except Exception as e:
            self.audit_logger.log_error("workspace_auth", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication failed"
            )
    
    def refresh_token(self, refresh_token: str) -> AuthTokens:
        """Refresh access token"""
        try:
            payload = jwt.decode(refresh_token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("sub")
            user_type = payload.get("user_type")
            workspace_id = payload.get("workspace_id")
            
            if not user_id or not user_type:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid refresh token"
                )
            
            # Verify user still exists and is active
            user = self.db.query(Staff).filter(
                Staff.id == user_id,
                Staff.is_active == True
            ).first()
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found"
                )
            
            # Generate new tokens
            tokens = self._generate_tokens(user.id, user_type, workspace_id)
            
            return tokens
            
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token expired"
            )
        except jwt.JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
    
    def _generate_tokens(self, user_id: int, user_type: str, workspace_id: Optional[str]) -> AuthTokens:
        """Generate access and refresh tokens"""
        # Access token payload
        access_payload = {
            "sub": str(user_id),
            "user_type": user_type,
            "workspace_id": workspace_id,
            "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
            "iat": datetime.utcnow()
        }
        
        # Refresh token payload
        refresh_payload = {
            "sub": str(user_id),
            "user_type": user_type,
            "workspace_id": workspace_id,
            "exp": datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
            "iat": datetime.utcnow(),
            "type": "refresh"
        }
        
        # Generate tokens
        access_token = jwt.encode(access_payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
        refresh_token = jwt.encode(refresh_payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
        
        return AuthTokens(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    
    def _verify_totp(self, user: Staff, totp_code: str) -> bool:
        """Verify TOTP 2FA code"""
        # In a real implementation, you'd store the TOTP secret securely
        # For demo purposes, we'll use a default secret
        totp_secret = getattr(user, 'totp_secret', None)
        if not totp_secret:
            # Generate and store TOTP secret for first-time setup
            totp_secret = pyotp.random_base32()
            # Store in database (implement this)
            pass
        
        totp = pyotp.TOTP(totp_secret, digits=TOTP_DIGITS, period=TOTP_PERIOD)
        return totp.verify(totp_code)
    
    def setup_2fa(self, user_id: int) -> str:
        """Setup 2FA for a user"""
        totp_secret = pyotp.random_base32()
        totp = pyotp.TOTP(totp_secret, digits=TOTP_DIGITS, period=TOTP_PERIOD)
        
        # Generate QR code URL for authenticator apps
        qr_url = totp.provisioning_uri(
            name=f"user_{user_id}",
            issuer_name=TOTP_ISSUER
        )
        
        # Store secret in database (implement this)
        # self.db.query(Staff).filter(Staff.id == user_id).update({"totp_secret": totp_secret})
        
        return qr_url

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    db: Session = Depends(get_db)
) -> Staff:
    """Get current authenticated user"""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        user_type = payload.get("user_type")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        user = db.query(Staff).filter(Staff.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        # Add user type to user object for easy access
        user.user_type = user_type
        user.workspace_id = payload.get("workspace_id")
        
        return user
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired"
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

def require_platform_admin(current_user: Staff = Depends(get_current_user)) -> Staff:
    """Require platform admin access"""
    if current_user.user_type != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform admin access required"
        )
    return current_user

def require_workspace_admin(current_user: Staff = Depends(get_current_user)) -> Staff:
    """Require workspace admin access"""
    if current_user.user_type != "workspace_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace admin access required"
        )
    return current_user

def require_workspace_access(workspace_id: str):
    """Require access to specific workspace"""
    def workspace_checker(current_user: Staff = Depends(get_current_user)) -> Staff:
        if current_user.user_type == "platform_admin":
            return current_user
        
        if current_user.workspace_id != workspace_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this workspace"
            )
        
        return current_user
    return workspace_checker 