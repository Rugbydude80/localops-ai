"""
Custom exceptions for the Auto-Schedule System with comprehensive error handling
"""

from typing import Dict, Any, Optional, List
from enum import Enum


class ErrorSeverity(Enum):
    """Error severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ErrorCategory(Enum):
    """Error categories for better classification"""
    AI_SERVICE = "ai_service"
    NOTIFICATION = "notification"
    CONSTRAINT_VIOLATION = "constraint_violation"
    DATA_VALIDATION = "data_validation"
    EXTERNAL_API = "external_api"
    SYSTEM = "system"
    BUSINESS_LOGIC = "business_logic"


class SchedulingException(Exception):
    """Base exception for all scheduling-related errors"""
    
    def __init__(
        self,
        code: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        category: ErrorCategory = ErrorCategory.SYSTEM,
        recoverable: bool = True,
        recovery_suggestions: Optional[List[str]] = None
    ):
        self.code = code
        self.message = message
        self.details = details or {}
        self.severity = severity
        self.category = category
        self.recoverable = recoverable
        self.recovery_suggestions = recovery_suggestions or []
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for API responses"""
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
                "severity": self.severity.value,
                "category": self.category.value,
                "recoverable": self.recoverable,
                "recovery_suggestions": self.recovery_suggestions
            }
        }


class AIServiceException(SchedulingException):
    """Exception for AI service failures"""
    
    def __init__(
        self,
        message: str,
        service_name: str = "OpenAI",
        error_type: str = "api_error",
        details: Optional[Dict[str, Any]] = None
    ):
        recovery_suggestions = [
            "The system will use rule-based scheduling as a fallback",
            "Try generating the schedule again in a few minutes",
            "Contact support if the issue persists"
        ]
        
        super().__init__(
            code="AI_SERVICE_UNAVAILABLE",
            message=f"{service_name} service error: {message}",
            details={
                "service_name": service_name,
                "error_type": error_type,
                **(details or {})
            },
            severity=ErrorSeverity.HIGH,
            category=ErrorCategory.AI_SERVICE,
            recoverable=True,
            recovery_suggestions=recovery_suggestions
        )


class NotificationException(SchedulingException):
    """Exception for notification delivery failures"""
    
    def __init__(
        self,
        message: str,
        channel: str,
        staff_id: int,
        retry_count: int = 0,
        details: Optional[Dict[str, Any]] = None
    ):
        recovery_suggestions = [
            f"Notification will be retried automatically (attempt {retry_count + 1}/3)",
            "Alternative notification channels will be attempted",
            "Staff can be notified manually if automatic delivery fails"
        ]
        
        super().__init__(
            code="NOTIFICATION_DELIVERY_FAILED",
            message=f"Failed to send {channel} notification: {message}",
            details={
                "channel": channel,
                "staff_id": staff_id,
                "retry_count": retry_count,
                **(details or {})
            },
            severity=ErrorSeverity.MEDIUM,
            category=ErrorCategory.NOTIFICATION,
            recoverable=True,
            recovery_suggestions=recovery_suggestions
        )


class ConstraintViolationException(SchedulingException):
    """Exception for scheduling constraint violations"""
    
    def __init__(
        self,
        constraint_type: str,
        violation_details: Dict[str, Any],
        affected_staff: Optional[List[int]] = None,
        affected_shifts: Optional[List[int]] = None
    ):
        recovery_suggestions = [
            "Review and adjust the scheduling constraints",
            "Consider hiring additional staff with required skills",
            "Modify shift requirements or timing",
            "Override constraints if business needs require it"
        ]
        
        super().__init__(
            code="CONSTRAINT_VIOLATION",
            message=f"Scheduling constraint violated: {constraint_type}",
            details={
                "constraint_type": constraint_type,
                "violation_details": violation_details,
                "affected_staff": affected_staff or [],
                "affected_shifts": affected_shifts or []
            },
            severity=ErrorSeverity.HIGH,
            category=ErrorCategory.CONSTRAINT_VIOLATION,
            recoverable=True,
            recovery_suggestions=recovery_suggestions
        )


class InsufficientStaffException(SchedulingException):
    """Exception for insufficient staff availability"""
    
    def __init__(
        self,
        required_skills: List[str],
        available_count: int,
        required_count: int,
        shift_details: Optional[Dict[str, Any]] = None
    ):
        recovery_suggestions = [
            f"Hire more staff with skills: {', '.join(required_skills)}",
            "Adjust shift requirements or timing",
            "Cross-train existing staff in required skills",
            "Consider splitting shifts or reducing coverage requirements"
        ]
        
        super().__init__(
            code="INSUFFICIENT_STAFF",
            message=f"Not enough staff available. Need {required_count}, have {available_count}",
            details={
                "required_skills": required_skills,
                "available_count": available_count,
                "required_count": required_count,
                "shift_details": shift_details or {}
            },
            severity=ErrorSeverity.HIGH,
            category=ErrorCategory.BUSINESS_LOGIC,
            recoverable=True,
            recovery_suggestions=recovery_suggestions
        )


class ExternalAPIException(SchedulingException):
    """Exception for external API failures"""
    
    def __init__(
        self,
        service_name: str,
        operation: str,
        error_message: str,
        status_code: Optional[int] = None,
        retry_after: Optional[int] = None
    ):
        recovery_suggestions = [
            f"The operation will be retried automatically",
            f"Check {service_name} service status",
            "Contact support if the issue persists"
        ]
        
        if retry_after:
            recovery_suggestions.insert(0, f"Retry after {retry_after} seconds")
        
        super().__init__(
            code="EXTERNAL_API_ERROR",
            message=f"{service_name} API error during {operation}: {error_message}",
            details={
                "service_name": service_name,
                "operation": operation,
                "status_code": status_code,
                "retry_after": retry_after
            },
            severity=ErrorSeverity.MEDIUM,
            category=ErrorCategory.EXTERNAL_API,
            recoverable=True,
            recovery_suggestions=recovery_suggestions
        )


class DataValidationException(SchedulingException):
    """Exception for data validation failures"""
    
    def __init__(
        self,
        field_name: str,
        field_value: Any,
        validation_rule: str,
        details: Optional[Dict[str, Any]] = None
    ):
        recovery_suggestions = [
            f"Correct the {field_name} field value",
            f"Ensure {field_name} meets the requirement: {validation_rule}",
            "Review the input data and try again"
        ]
        
        super().__init__(
            code="DATA_VALIDATION_ERROR",
            message=f"Validation failed for {field_name}: {validation_rule}",
            details={
                "field_name": field_name,
                "field_value": str(field_value),
                "validation_rule": validation_rule,
                **(details or {})
            },
            severity=ErrorSeverity.MEDIUM,
            category=ErrorCategory.DATA_VALIDATION,
            recoverable=True,
            recovery_suggestions=recovery_suggestions
        )


class ScheduleGenerationException(SchedulingException):
    """Exception for schedule generation failures"""
    
    def __init__(
        self,
        reason: str,
        partial_results: Optional[Dict[str, Any]] = None,
        fallback_available: bool = True
    ):
        recovery_suggestions = []
        
        if fallback_available:
            recovery_suggestions.extend([
                "A basic schedule will be generated using rule-based logic",
                "You can manually adjust assignments as needed",
                "Try generating again with different parameters"
            ])
        else:
            recovery_suggestions.extend([
                "Review scheduling parameters and constraints",
                "Ensure sufficient staff availability",
                "Contact support for assistance"
            ])
        
        super().__init__(
            code="SCHEDULE_GENERATION_FAILED",
            message=f"Schedule generation failed: {reason}",
            details={
                "reason": reason,
                "partial_results": partial_results or {},
                "fallback_available": fallback_available
            },
            severity=ErrorSeverity.HIGH,
            category=ErrorCategory.BUSINESS_LOGIC,
            recoverable=fallback_available,
            recovery_suggestions=recovery_suggestions
        )


class ConflictResolutionException(SchedulingException):
    """Exception for schedule conflict resolution failures"""
    
    def __init__(
        self,
        conflict_type: str,
        conflicting_assignments: List[Dict[str, Any]],
        resolution_attempted: str
    ):
        recovery_suggestions = [
            "Review conflicting assignments manually",
            "Adjust staff availability or shift timing",
            "Override conflicts if business needs require it",
            "Contact manager for manual resolution"
        ]
        
        super().__init__(
            code="CONFLICT_RESOLUTION_FAILED",
            message=f"Failed to resolve {conflict_type} conflict",
            details={
                "conflict_type": conflict_type,
                "conflicting_assignments": conflicting_assignments,
                "resolution_attempted": resolution_attempted
            },
            severity=ErrorSeverity.HIGH,
            category=ErrorCategory.BUSINESS_LOGIC,
            recoverable=True,
            recovery_suggestions=recovery_suggestions
        )


class SystemResourceException(SchedulingException):
    """Exception for system resource limitations"""
    
    def __init__(
        self,
        resource_type: str,
        current_usage: str,
        limit: str,
        operation: str
    ):
        recovery_suggestions = [
            "Try the operation again in a few minutes",
            "Reduce the scope of the operation",
            "Contact support to increase resource limits",
            "Consider upgrading your plan for higher limits"
        ]
        
        super().__init__(
            code="RESOURCE_LIMIT_EXCEEDED",
            message=f"{resource_type} limit exceeded during {operation}",
            details={
                "resource_type": resource_type,
                "current_usage": current_usage,
                "limit": limit,
                "operation": operation
            },
            severity=ErrorSeverity.MEDIUM,
            category=ErrorCategory.SYSTEM,
            recoverable=True,
            recovery_suggestions=recovery_suggestions
        )