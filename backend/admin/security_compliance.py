"""
Security & Compliance Service for Platform Owner Admin
Handles audit logs, security events, compliance reporting, and security policy management
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc
from pydantic import BaseModel

from database import get_db
from models import Staff
from shared.authentication import require_platform_admin, get_current_user
from shared.audit_logging import AuditLogger, AuditLog, SecurityEvent

router = APIRouter(prefix="/api/platform/security", tags=["Security & Compliance"])

# Pydantic models for API responses
class SecurityEventSummary(BaseModel):
    id: int
    event_type: str
    user_email: Optional[str]
    ip_address: Optional[str]
    timestamp: datetime
    severity: str
    resolved: bool
    details: Dict[str, Any]

class AuditLogSummary(BaseModel):
    id: int
    user_email: str
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    timestamp: datetime
    ip_address: Optional[str]
    severity: str
    workspace_id: Optional[str]
    user_type: Optional[str]

class ComplianceReport(BaseModel):
    total_audit_logs: int
    total_security_events: int
    unresolved_security_events: int
    events_by_severity: Dict[str, int]
    events_by_type: Dict[str, int]
    recent_incidents: List[Dict[str, Any]]
    compliance_score: float
    last_audit_date: datetime

class SecurityMetrics(BaseModel):
    failed_login_attempts: int
    suspicious_activities: int
    permission_violations: int
    data_access_events: int
    system_health_score: float
    security_alerts: List[Dict[str, Any]]

class SecurityComplianceService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_logger = AuditLogger(db)
    
    def get_security_events(
        self,
        page: int = 1,
        limit: int = 50,
        event_type: Optional[str] = None,
        severity: Optional[str] = None,
        resolved: Optional[bool] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get security events with filtering and pagination"""
        query = self.db.query(SecurityEvent)
        
        # Apply filters
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
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        offset = (page - 1) * limit
        events = query.order_by(desc(SecurityEvent.timestamp)).offset(offset).limit(limit).all()
        
        # Convert to response format
        event_summaries = []
        for event in events:
            event_summaries.append(SecurityEventSummary(
                id=event.id,
                event_type=event.event_type,
                user_email=event.user_email,
                ip_address=event.ip_address,
                timestamp=event.timestamp,
                severity=event.severity,
                resolved=bool(event.resolved),
                details=event.details or {}
            ))
        
        return {
            "events": event_summaries,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit
        }
    
    def get_audit_logs(
        self,
        page: int = 1,
        limit: int = 50,
        user_id: Optional[int] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        workspace_id: Optional[str] = None,
        user_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get audit logs with filtering and pagination"""
        query = self.db.query(AuditLog)
        
        # Apply filters
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
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        offset = (page - 1) * limit
        logs = query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit).all()
        
        # Convert to response format
        log_summaries = []
        for log in logs:
            log_summaries.append(AuditLogSummary(
                id=log.id,
                user_email=log.user_email,
                action=log.action,
                resource_type=log.resource_type,
                resource_id=log.resource_id,
                timestamp=log.timestamp,
                ip_address=log.ip_address,
                severity=log.severity,
                workspace_id=log.workspace_id,
                user_type=log.user_type
            ))
        
        return {
            "logs": log_summaries,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit
        }
    
    def get_compliance_report(self) -> ComplianceReport:
        """Get comprehensive compliance report"""
        # Total counts
        total_audit_logs = self.db.query(AuditLog).count()
        total_security_events = self.db.query(SecurityEvent).count()
        unresolved_security_events = self.db.query(SecurityEvent).filter(
            SecurityEvent.resolved == False
        ).count()
        
        # Events by severity
        severity_counts = self.db.query(
            SecurityEvent.severity,
            func.count(SecurityEvent.id).label('count')
        ).group_by(SecurityEvent.severity).all()
        
        events_by_severity = {severity: count for severity, count in severity_counts}
        
        # Events by type
        type_counts = self.db.query(
            SecurityEvent.event_type,
            func.count(SecurityEvent.id).label('count')
        ).group_by(SecurityEvent.event_type).all()
        
        events_by_type = {event_type: count for event_type, count in type_counts}
        
        # Recent incidents
        recent_incidents = self.db.query(SecurityEvent).filter(
            SecurityEvent.severity.in_(["error", "critical"])
        ).order_by(desc(SecurityEvent.timestamp)).limit(10).all()
        
        incidents_list = []
        for incident in recent_incidents:
            incidents_list.append({
                "id": incident.id,
                "type": incident.event_type,
                "severity": incident.severity,
                "timestamp": incident.timestamp,
                "user_email": incident.user_email,
                "ip_address": incident.ip_address,
                "resolved": bool(incident.resolved)
            })
        
        # Calculate compliance score
        compliance_score = self._calculate_compliance_score()
        
        # Last audit date
        last_audit_date = datetime.utcnow()  # Would integrate with actual audit system
        
        return ComplianceReport(
            total_audit_logs=total_audit_logs,
            total_security_events=total_security_events,
            unresolved_security_events=unresolved_security_events,
            events_by_severity=events_by_severity,
            events_by_type=events_by_type,
            recent_incidents=incidents_list,
            compliance_score=compliance_score,
            last_audit_date=last_audit_date
        )
    
    def get_security_metrics(self) -> SecurityMetrics:
        """Get security metrics and alerts"""
        # Failed login attempts
        failed_login_attempts = self.db.query(SecurityEvent).filter(
            SecurityEvent.event_type == "login_failed"
        ).count()
        
        # Suspicious activities
        suspicious_activities = self.db.query(SecurityEvent).filter(
            SecurityEvent.event_type.in_(["suspicious_activity", "unusual_access"])
        ).count()
        
        # Permission violations
        permission_violations = self.db.query(SecurityEvent).filter(
            SecurityEvent.event_type == "permission_denied"
        ).count()
        
        # Data access events
        data_access_events = self.db.query(AuditLog).filter(
            AuditLog.action.in_(["data_access", "data_export", "data_import"])
        ).count()
        
        # System health score
        system_health_score = self._calculate_system_health_score()
        
        # Security alerts
        security_alerts = self._get_security_alerts()
        
        return SecurityMetrics(
            failed_login_attempts=failed_login_attempts,
            suspicious_activities=suspicious_activities,
            permission_violations=permission_violations,
            data_access_events=data_access_events,
            system_health_score=system_health_score,
            security_alerts=security_alerts
        )
    
    def resolve_security_event(self, event_id: int, admin_user_id: int) -> Dict[str, Any]:
        """Mark a security event as resolved"""
        event = self.db.query(SecurityEvent).filter(SecurityEvent.id == event_id).first()
        
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Security event not found"
            )
        
        if event.resolved:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security event is already resolved"
            )
        
        event.resolved = True
        
        # Log the resolution
        self.audit_logger.log_platform_action(
            user_id=admin_user_id,
            user_email="",
            action="security_event_resolved",
            resource_type="security_event",
            resource_id=str(event_id),
            details={
                "event_type": event.event_type,
                "severity": event.severity,
                "user_email": event.user_email
            }
        )
        
        self.db.commit()
        
        return {
            "message": "Security event resolved successfully",
            "event_id": event_id,
            "event_type": event.event_type
        }
    
    def export_audit_logs(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        format: str = "json"
    ) -> Dict[str, Any]:
        """Export audit logs for compliance reporting"""
        query = self.db.query(AuditLog)
        
        if start_date:
            query = query.filter(AuditLog.timestamp >= start_date)
        
        if end_date:
            query = query.filter(AuditLog.timestamp <= end_date)
        
        logs = query.order_by(AuditLog.timestamp).all()
        
        # Convert to export format
        export_data = []
        for log in logs:
            export_data.append({
                "id": log.id,
                "timestamp": log.timestamp.isoformat(),
                "user_id": log.user_id,
                "user_email": log.user_email,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "severity": log.severity,
                "workspace_id": log.workspace_id,
                "user_type": log.user_type,
                "details": log.details
            })
        
        return {
            "format": format,
            "total_records": len(export_data),
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
            "data": export_data
        }
    
    def _calculate_compliance_score(self) -> float:
        """Calculate overall compliance score"""
        # This would implement actual compliance scoring logic
        # For now, return a sample score
        return 94.7
    
    def _calculate_system_health_score(self) -> float:
        """Calculate system health score based on security metrics"""
        # This would implement actual health scoring logic
        # For now, return a sample score
        return 87.3
    
    def _get_security_alerts(self) -> List[Dict[str, Any]]:
        """Get current security alerts"""
        # This would integrate with actual alerting system
        # For now, return sample alerts
        return [
            {
                "id": 1,
                "type": "high_failed_logins",
                "severity": "warning",
                "message": "High number of failed login attempts detected",
                "timestamp": datetime.utcnow() - timedelta(hours=2),
                "affected_users": 5
            },
            {
                "id": 2,
                "type": "unusual_access_pattern",
                "severity": "info",
                "message": "Unusual access pattern detected from new IP",
                "timestamp": datetime.utcnow() - timedelta(hours=4),
                "affected_users": 1
            }
        ]

# API Endpoints
@router.get("/events", response_model=Dict[str, Any])
def get_security_events(
    page: int = 1,
    limit: int = 50,
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    resolved: Optional[bool] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get security events with filtering and pagination"""
    service = SecurityComplianceService(db)
    return service.get_security_events(page, limit, event_type, severity, resolved, start_date, end_date)

@router.get("/audit-logs", response_model=Dict[str, Any])
def get_audit_logs(
    page: int = 1,
    limit: int = 50,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    workspace_id: Optional[str] = None,
    user_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get audit logs with filtering and pagination"""
    service = SecurityComplianceService(db)
    return service.get_audit_logs(page, limit, user_id, action, resource_type, workspace_id, user_type, start_date, end_date)

@router.get("/compliance-report", response_model=ComplianceReport)
def get_compliance_report(
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get comprehensive compliance report"""
    service = SecurityComplianceService(db)
    return service.get_compliance_report()

@router.get("/metrics", response_model=SecurityMetrics)
def get_security_metrics(
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get security metrics and alerts"""
    service = SecurityComplianceService(db)
    return service.get_security_metrics()

@router.put("/events/{event_id}/resolve")
def resolve_security_event(
    event_id: int,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Mark a security event as resolved"""
    service = SecurityComplianceService(db)
    return service.resolve_security_event(event_id, current_user.id)

@router.get("/export-audit-logs")
def export_audit_logs(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    format: str = "json",
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Export audit logs for compliance reporting"""
    service = SecurityComplianceService(db)
    return service.export_audit_logs(start_date, end_date, format) 