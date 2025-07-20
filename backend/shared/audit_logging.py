"""
Comprehensive Audit Logging Service
Tracks all admin actions, security events, and user activities for compliance
"""

import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("staff.id"))
    user_email = Column(String(255))
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50))  # business, user, system, etc.
    resource_id = Column(String(50))
    details = Column(JSON)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    session_id = Column(String(255))
    severity = Column(String(20), default="info")  # info, warning, error, critical
    workspace_id = Column(String(50))
    user_type = Column(String(20))  # platform_admin, workspace_admin

class SecurityEvent(Base):
    __tablename__ = "security_events"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    event_type = Column(String(50), nullable=False)  # login_failed, permission_denied, etc.
    user_id = Column(Integer, ForeignKey("staff.id"))
    user_email = Column(String(255))
    ip_address = Column(String(45))
    details = Column(JSON)
    severity = Column(String(20), default="warning")
    resolved = Column(Integer, default=0)  # 0 = unresolved, 1 = resolved

class AuditLogger:
    def __init__(self, db: Session):
        self.db = db
    
    def log_action(
        self,
        user_id: int,
        user_email: str,
        action: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None,
        severity: str = "info",
        workspace_id: Optional[str] = None,
        user_type: Optional[str] = None
    ):
        """Log a user action"""
        try:
            audit_log = AuditLog(
                user_id=user_id,
                user_email=user_email,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                details=details or {},
                ip_address=ip_address,
                user_agent=user_agent,
                session_id=session_id,
                severity=severity,
                workspace_id=workspace_id,
                user_type=user_type
            )
            
            self.db.add(audit_log)
            self.db.commit()
            
        except Exception as e:
            # Don't let audit logging failures break the main application
            print(f"Audit logging failed: {e}")
            self.db.rollback()
    
    def log_successful_login(self, user_id: int, ip_address: str, user_type: str):
        """Log successful login"""
        self.log_action(
            user_id=user_id,
            user_email="",  # Will be filled from user lookup
            action="login_successful",
            resource_type="authentication",
            ip_address=ip_address,
            severity="info",
            user_type=user_type
        )
    
    def log_failed_login(self, email: str, ip_address: str, user_type: str, reason: str):
        """Log failed login attempt"""
        self.log_action(
            user_id=0,  # Unknown user
            user_email=email,
            action="login_failed",
            resource_type="authentication",
            details={"reason": reason},
            ip_address=ip_address,
            severity="warning",
            user_type=user_type
        )
        
        # Also log as security event
        self.log_security_event(
            event_type="login_failed",
            user_email=email,
            ip_address=ip_address,
            details={"reason": reason, "user_type": user_type}
        )
    
    def log_security_event(
        self,
        event_type: str,
        user_id: Optional[int] = None,
        user_email: Optional[str] = None,
        ip_address: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: str = "warning"
    ):
        """Log a security event"""
        try:
            security_event = SecurityEvent(
                event_type=event_type,
                user_id=user_id,
                user_email=user_email,
                ip_address=ip_address,
                details=details or {},
                severity=severity
            )
            
            self.db.add(security_event)
            self.db.commit()
            
        except Exception as e:
            print(f"Security event logging failed: {e}")
            self.db.rollback()
    
    def log_platform_action(
        self,
        user_id: int,
        user_email: str,
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ):
        """Log platform admin action"""
        self.log_action(
            user_id=user_id,
            user_email=user_email,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            ip_address=ip_address,
            user_type="platform_admin"
        )
    
    def log_workspace_action(
        self,
        user_id: int,
        user_email: str,
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        workspace_id: Optional[str] = None
    ):
        """Log workspace admin action"""
        self.log_action(
            user_id=user_id,
            user_email=user_email,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            ip_address=ip_address,
            user_type="workspace_admin",
            workspace_id=workspace_id
        )
    
    def log_error(self, context: str, error_message: str, user_id: Optional[int] = None):
        """Log application errors"""
        self.log_action(
            user_id=user_id or 0,
            user_email="",
            action="error",
            resource_type="system",
            details={"context": context, "error": error_message},
            severity="error"
        )
    
    def get_audit_logs(
        self,
        user_id: Optional[int] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        workspace_id: Optional[str] = None,
        user_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[AuditLog]:
        """Retrieve audit logs with filtering"""
        query = self.db.query(AuditLog)
        
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        
        if action:
            query = query.filter(AuditLog.action == action)
        
        if resource_type:
            query = query.filter(AuditLog.resource_type == resource_type)
        
        if workspace_id:
            query = query.filter(AuditLog.workspace_id == workspace_id)
        
        if user_type:
            query = query.filter(AuditLog.user_type == user_type)
        
        if start_date:
            query = query.filter(AuditLog.timestamp >= start_date)
        
        if end_date:
            query = query.filter(AuditLog.timestamp <= end_date)
        
        return query.order_by(AuditLog.timestamp.desc()).limit(limit).offset(offset).all()
    
    def get_security_events(
        self,
        event_type: Optional[str] = None,
        severity: Optional[str] = None,
        resolved: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[SecurityEvent]:
        """Retrieve security events with filtering"""
        query = self.db.query(SecurityEvent)
        
        if event_type:
            query = query.filter(SecurityEvent.event_type == event_type)
        
        if severity:
            query = query.filter(SecurityEvent.severity == severity)
        
        if resolved is not None:
            query = query.filter(SecurityEvent.resolved == resolved)
        
        if start_date:
            query = query.filter(SecurityEvent.timestamp >= start_date)
        
        if end_date:
            query = query.filter(SecurityEvent.timestamp <= end_date)
        
        return query.order_by(SecurityEvent.timestamp.desc()).limit(limit).offset(offset).all()
    
    def get_audit_summary(self, days: int = 30) -> Dict[str, Any]:
        """Get audit summary statistics"""
        from datetime import timedelta
        
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Total actions
        total_actions = self.db.query(AuditLog).filter(
            AuditLog.timestamp >= start_date
        ).count()
        
        # Actions by type
        actions_by_type = self.db.query(
            AuditLog.action,
            self.db.func.count(AuditLog.id)
        ).filter(
            AuditLog.timestamp >= start_date
        ).group_by(AuditLog.action).all()
        
        # Security events
        security_events = self.db.query(SecurityEvent).filter(
            SecurityEvent.timestamp >= start_date
        ).count()
        
        # Unresolved security events
        unresolved_events = self.db.query(SecurityEvent).filter(
            SecurityEvent.timestamp >= start_date,
            SecurityEvent.resolved == 0
        ).count()
        
        return {
            "total_actions": total_actions,
            "actions_by_type": dict(actions_by_type),
            "security_events": security_events,
            "unresolved_events": unresolved_events,
            "period_days": days
        } 