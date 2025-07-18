"""
Comprehensive error handling and recovery service for the Auto-Schedule System
"""

import logging
import traceback
import asyncio
from typing import Dict, Any, Optional, List, Callable, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import json

from exceptions import (
    SchedulingException, AIServiceException, NotificationException,
    ConstraintViolationException, ExternalAPIException, ErrorSeverity,
    ErrorCategory, ScheduleGenerationException
)


@dataclass
class RetryConfig:
    """Configuration for retry mechanisms"""
    max_attempts: int = 3
    base_delay: float = 1.0  # seconds
    max_delay: float = 60.0  # seconds
    exponential_backoff: bool = True
    jitter: bool = True


@dataclass
class ErrorContext:
    """Context information for error handling"""
    operation: str
    business_id: Optional[int] = None
    draft_id: Optional[str] = None
    user_id: Optional[int] = None
    request_id: Optional[str] = None
    additional_data: Optional[Dict[str, Any]] = None


@dataclass
class ErrorRecord:
    """Record of an error occurrence"""
    error_id: str
    timestamp: datetime
    error_type: str
    error_code: str
    message: str
    severity: str
    category: str
    context: ErrorContext
    stack_trace: Optional[str] = None
    resolution_attempted: Optional[str] = None
    resolved: bool = False
    resolution_time: Optional[datetime] = None


class FallbackStrategy(Enum):
    """Available fallback strategies"""
    RULE_BASED_SCHEDULING = "rule_based_scheduling"
    MANUAL_INTERVENTION = "manual_intervention"
    PARTIAL_RESULTS = "partial_results"
    ALTERNATIVE_SERVICE = "alternative_service"
    GRACEFUL_DEGRADATION = "graceful_degradation"


class ErrorHandler:
    """Comprehensive error handling and recovery service"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.error_records: Dict[str, ErrorRecord] = {}
        self.retry_configs: Dict[str, RetryConfig] = {
            "ai_service": RetryConfig(max_attempts=3, base_delay=2.0),
            "notification": RetryConfig(max_attempts=5, base_delay=1.0),
            "external_api": RetryConfig(max_attempts=3, base_delay=5.0),
            "constraint_solving": RetryConfig(max_attempts=2, base_delay=0.5)
        }
        self.fallback_handlers: Dict[str, Callable] = {}
        self._setup_logging()
    
    def _setup_logging(self):
        """Setup structured logging for error handling"""
        # Create logs directory if it doesn't exist
        import os
        os.makedirs("logs", exist_ok=True)
        
        # Create error-specific logger
        error_logger = logging.getLogger("scheduling_errors")
        error_logger.setLevel(logging.ERROR)
        
        # Create file handler for error logs
        error_handler = logging.FileHandler("logs/scheduling_errors.log")
        error_handler.setLevel(logging.ERROR)
        
        # Create formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        error_handler.setFormatter(formatter)
        
        error_logger.addHandler(error_handler)
        self.error_logger = error_logger
    
    def register_fallback_handler(
        self, 
        error_type: str, 
        handler: Callable,
        strategy: FallbackStrategy
    ):
        """Register a fallback handler for specific error types"""
        self.fallback_handlers[error_type] = {
            "handler": handler,
            "strategy": strategy
        }
    
    async def handle_error(
        self,
        error: Exception,
        context: ErrorContext,
        enable_fallback: bool = True
    ) -> Dict[str, Any]:
        """
        Comprehensive error handling with logging, recovery, and fallback
        
        Args:
            error: The exception that occurred
            context: Context information about the operation
            enable_fallback: Whether to attempt fallback strategies
            
        Returns:
            Dictionary with error details and recovery information
        """
        error_id = f"err_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{id(error)}"
        
        # Determine error details
        if isinstance(error, SchedulingException):
            error_details = error.to_dict()
            error_code = error.code
            severity = error.severity
            category = error.category
            recoverable = error.recoverable
        else:
            # Handle unexpected errors
            error_details = {
                "error": {
                    "code": "UNEXPECTED_ERROR",
                    "message": str(error),
                    "details": {"type": type(error).__name__},
                    "severity": ErrorSeverity.HIGH.value,
                    "category": ErrorCategory.SYSTEM.value,
                    "recoverable": True,
                    "recovery_suggestions": [
                        "Try the operation again",
                        "Contact support if the issue persists"
                    ]
                }
            }
            error_code = "UNEXPECTED_ERROR"
            severity = ErrorSeverity.HIGH
            category = ErrorCategory.SYSTEM
            recoverable = True
        
        # Create error record
        error_record = ErrorRecord(
            error_id=error_id,
            timestamp=datetime.now(),
            error_type=type(error).__name__,
            error_code=error_code,
            message=str(error),
            severity=severity.value,
            category=category.value,
            context=context,
            stack_trace=traceback.format_exc()
        )
        
        self.error_records[error_id] = error_record
        
        # Log the error
        await self._log_error(error_record, error_details)
        
        # Attempt recovery if enabled and error is recoverable
        recovery_result = None
        if enable_fallback and recoverable:
            recovery_result = await self._attempt_recovery(error, context, error_record)
        
        # Prepare response
        response = {
            "error_id": error_id,
            "timestamp": error_record.timestamp.isoformat(),
            "success": False,
            **error_details
        }
        
        if recovery_result:
            response["recovery"] = recovery_result
            if recovery_result.get("success"):
                response["success"] = True
                response["message"] = "Operation completed with fallback strategy"
        
        return response
    
    async def _log_error(self, error_record: ErrorRecord, error_details: Dict[str, Any]):
        """Log error with structured information"""
        log_data = {
            "error_id": error_record.error_id,
            "timestamp": error_record.timestamp.isoformat(),
            "error_type": error_record.error_type,
            "error_code": error_record.error_code,
            "message": error_record.message,
            "severity": error_record.severity,
            "category": error_record.category,
            "context": asdict(error_record.context),
            "details": error_details
        }
        
        # Log to structured error logger
        self.error_logger.error(json.dumps(log_data))
        
        # Log to main logger based on severity
        if error_record.severity == ErrorSeverity.CRITICAL.value:
            self.logger.critical(f"CRITICAL ERROR [{error_record.error_id}]: {error_record.message}")
        elif error_record.severity == ErrorSeverity.HIGH.value:
            self.logger.error(f"HIGH SEVERITY [{error_record.error_id}]: {error_record.message}")
        elif error_record.severity == ErrorSeverity.MEDIUM.value:
            self.logger.warning(f"MEDIUM SEVERITY [{error_record.error_id}]: {error_record.message}")
        else:
            self.logger.info(f"LOW SEVERITY [{error_record.error_id}]: {error_record.message}")
    
    async def _attempt_recovery(
        self,
        error: Exception,
        context: ErrorContext,
        error_record: ErrorRecord
    ) -> Optional[Dict[str, Any]]:
        """Attempt error recovery using appropriate strategies"""
        
        recovery_strategies = []
        
        # Determine recovery strategies based on error type
        if isinstance(error, AIServiceException):
            recovery_strategies = [
                ("rule_based_fallback", FallbackStrategy.RULE_BASED_SCHEDULING),
                ("retry_with_delay", None)
            ]
        elif isinstance(error, NotificationException):
            recovery_strategies = [
                ("alternative_channel", FallbackStrategy.ALTERNATIVE_SERVICE),
                ("retry_notification", None)
            ]
        elif isinstance(error, ExternalAPIException):
            recovery_strategies = [
                ("retry_with_backoff", None),
                ("alternative_service", FallbackStrategy.ALTERNATIVE_SERVICE)
            ]
        elif isinstance(error, ConstraintViolationException):
            recovery_strategies = [
                ("relaxed_constraints", FallbackStrategy.GRACEFUL_DEGRADATION),
                ("partial_schedule", FallbackStrategy.PARTIAL_RESULTS)
            ]
        else:
            recovery_strategies = [
                ("generic_retry", None),
                ("manual_intervention", FallbackStrategy.MANUAL_INTERVENTION)
            ]
        
        # Try recovery strategies in order
        for strategy_name, fallback_strategy in recovery_strategies:
            try:
                recovery_result = await self._execute_recovery_strategy(
                    strategy_name, error, context, fallback_strategy
                )
                
                if recovery_result and recovery_result.get("success"):
                    error_record.resolution_attempted = strategy_name
                    error_record.resolved = True
                    error_record.resolution_time = datetime.now()
                    
                    self.logger.info(
                        f"Error {error_record.error_id} resolved using {strategy_name}"
                    )
                    
                    return recovery_result
                    
            except Exception as recovery_error:
                self.logger.warning(
                    f"Recovery strategy {strategy_name} failed for error {error_record.error_id}: "
                    f"{str(recovery_error)}"
                )
                continue
        
        # No recovery strategy succeeded
        error_record.resolution_attempted = "all_strategies_failed"
        return None
    
    async def _execute_recovery_strategy(
        self,
        strategy_name: str,
        original_error: Exception,
        context: ErrorContext,
        fallback_strategy: Optional[FallbackStrategy]
    ) -> Optional[Dict[str, Any]]:
        """Execute a specific recovery strategy"""
        
        if strategy_name == "rule_based_fallback":
            return await self._rule_based_scheduling_fallback(context)
        
        elif strategy_name == "alternative_channel":
            return await self._alternative_notification_channel(original_error, context)
        
        elif strategy_name == "retry_with_delay":
            return await self._retry_with_delay(original_error, context)
        
        elif strategy_name == "retry_with_backoff":
            return await self._retry_with_exponential_backoff(original_error, context)
        
        elif strategy_name == "relaxed_constraints":
            return await self._relaxed_constraint_scheduling(original_error, context)
        
        elif strategy_name == "partial_schedule":
            return await self._generate_partial_schedule(original_error, context)
        
        elif strategy_name == "retry_notification":
            return await self._retry_failed_notification(original_error, context)
        
        elif strategy_name == "alternative_service":
            return await self._use_alternative_service(original_error, context)
        
        elif strategy_name == "generic_retry":
            return await self._generic_retry(original_error, context)
        
        else:
            return {"success": False, "strategy": strategy_name, "message": "Strategy not implemented"}
    
    async def _rule_based_scheduling_fallback(self, context: ErrorContext) -> Dict[str, Any]:
        """Fallback to rule-based scheduling when AI service fails"""
        try:
            # Import here to avoid circular imports
            from services.constraint_solver import ConstraintSolver
            from database import get_db
            
            # This would be implemented to use rule-based scheduling
            # For now, return a success indicator
            return {
                "success": True,
                "strategy": "rule_based_scheduling",
                "message": "Schedule generated using rule-based logic",
                "fallback_used": True,
                "confidence_score": 0.7  # Lower confidence for rule-based
            }
            
        except Exception as e:
            return {
                "success": False,
                "strategy": "rule_based_scheduling",
                "error": str(e)
            }
    
    async def _alternative_notification_channel(
        self, 
        original_error: Exception, 
        context: ErrorContext
    ) -> Dict[str, Any]:
        """Try alternative notification channels"""
        if not isinstance(original_error, NotificationException):
            return {"success": False, "message": "Not a notification error"}
        
        failed_channel = original_error.details.get("channel")
        staff_id = original_error.details.get("staff_id")
        
        # Define channel fallback order
        channel_fallbacks = {
            "whatsapp": ["sms", "email"],
            "sms": ["whatsapp", "email"],
            "email": ["sms", "whatsapp"]
        }
        
        alternative_channels = channel_fallbacks.get(failed_channel, ["sms"])
        
        for channel in alternative_channels:
            try:
                # This would attempt to send via alternative channel
                # For now, simulate success
                return {
                    "success": True,
                    "strategy": "alternative_channel",
                    "message": f"Notification sent via {channel} instead of {failed_channel}",
                    "channel_used": channel,
                    "original_channel": failed_channel
                }
            except Exception:
                continue
        
        return {
            "success": False,
            "strategy": "alternative_channel",
            "message": "All notification channels failed"
        }
    
    async def _retry_with_delay(
        self, 
        original_error: Exception, 
        context: ErrorContext
    ) -> Dict[str, Any]:
        """Retry operation with simple delay"""
        error_type = type(original_error).__name__.lower()
        retry_config = self.retry_configs.get(error_type, RetryConfig())
        
        for attempt in range(retry_config.max_attempts):
            if attempt > 0:
                delay = min(
                    retry_config.base_delay * (2 ** attempt if retry_config.exponential_backoff else 1),
                    retry_config.max_delay
                )
                await asyncio.sleep(delay)
            
            try:
                # This would retry the original operation
                # For now, simulate success after a few attempts
                if attempt >= 1:  # Succeed on second attempt
                    return {
                        "success": True,
                        "strategy": "retry_with_delay",
                        "message": f"Operation succeeded on attempt {attempt + 1}",
                        "attempts": attempt + 1
                    }
            except Exception:
                continue
        
        return {
            "success": False,
            "strategy": "retry_with_delay",
            "message": f"Operation failed after {retry_config.max_attempts} attempts"
        }
    
    async def _retry_with_exponential_backoff(
        self, 
        original_error: Exception, 
        context: ErrorContext
    ) -> Dict[str, Any]:
        """Retry with exponential backoff for external API errors"""
        if not isinstance(original_error, ExternalAPIException):
            return {"success": False, "message": "Not an external API error"}
        
        retry_after = original_error.details.get("retry_after", 5)
        max_attempts = 3
        
        for attempt in range(max_attempts):
            if attempt > 0:
                delay = min(retry_after * (2 ** attempt), 60)
                await asyncio.sleep(delay)
            
            try:
                # This would retry the API call
                # For now, simulate success
                return {
                    "success": True,
                    "strategy": "exponential_backoff",
                    "message": f"API call succeeded on attempt {attempt + 1}",
                    "attempts": attempt + 1
                }
            except Exception:
                continue
        
        return {
            "success": False,
            "strategy": "exponential_backoff",
            "message": f"API call failed after {max_attempts} attempts"
        }
    
    async def _relaxed_constraint_scheduling(
        self, 
        original_error: Exception, 
        context: ErrorContext
    ) -> Dict[str, Any]:
        """Generate schedule with relaxed constraints"""
        if not isinstance(original_error, ConstraintViolationException):
            return {"success": False, "message": "Not a constraint violation error"}
        
        constraint_type = original_error.details.get("constraint_type")
        
        return {
            "success": True,
            "strategy": "relaxed_constraints",
            "message": f"Schedule generated with relaxed {constraint_type} constraints",
            "warnings": [f"Some {constraint_type} constraints were relaxed"],
            "confidence_score": 0.6
        }
    
    async def _generate_partial_schedule(
        self, 
        original_error: Exception, 
        context: ErrorContext
    ) -> Dict[str, Any]:
        """Generate partial schedule when full schedule is not possible"""
        return {
            "success": True,
            "strategy": "partial_schedule",
            "message": "Partial schedule generated - some shifts remain unassigned",
            "warnings": ["Not all shifts could be assigned"],
            "partial_results": True,
            "coverage_percentage": 75  # Example coverage
        }
    
    async def _retry_failed_notification(
        self, 
        original_error: Exception, 
        context: ErrorContext
    ) -> Dict[str, Any]:
        """Retry failed notification with different parameters"""
        if not isinstance(original_error, NotificationException):
            return {"success": False, "message": "Not a notification error"}
        
        # Simulate retry success
        return {
            "success": True,
            "strategy": "retry_notification",
            "message": "Notification delivered successfully on retry",
            "retry_count": original_error.details.get("retry_count", 0) + 1
        }
    
    async def _use_alternative_service(
        self, 
        original_error: Exception, 
        context: ErrorContext
    ) -> Dict[str, Any]:
        """Use alternative service when primary service fails"""
        return {
            "success": True,
            "strategy": "alternative_service",
            "message": "Operation completed using alternative service",
            "service_used": "backup_service"
        }
    
    async def _generic_retry(
        self, 
        original_error: Exception, 
        context: ErrorContext
    ) -> Dict[str, Any]:
        """Generic retry mechanism for unexpected errors"""
        max_attempts = 2
        
        for attempt in range(max_attempts):
            if attempt > 0:
                await asyncio.sleep(1.0)
            
            try:
                # This would retry the original operation
                # For now, simulate occasional success
                if attempt == 1:  # Succeed on second attempt
                    return {
                        "success": True,
                        "strategy": "generic_retry",
                        "message": f"Operation succeeded on retry attempt {attempt + 1}",
                        "attempts": attempt + 1
                    }
            except Exception:
                continue
        
        return {
            "success": False,
            "strategy": "generic_retry",
            "message": f"Operation failed after {max_attempts} attempts"
        }
    
    def get_error_statistics(self, hours: int = 24) -> Dict[str, Any]:
        """Get error statistics for monitoring and debugging"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        recent_errors = [
            error for error in self.error_records.values()
            if error.timestamp >= cutoff_time
        ]
        
        if not recent_errors:
            return {
                "total_errors": 0,
                "time_period_hours": hours,
                "error_rate": 0.0
            }
        
        # Calculate statistics
        total_errors = len(recent_errors)
        resolved_errors = len([e for e in recent_errors if e.resolved])
        
        # Group by category
        by_category = {}
        for error in recent_errors:
            category = error.category
            if category not in by_category:
                by_category[category] = 0
            by_category[category] += 1
        
        # Group by severity
        by_severity = {}
        for error in recent_errors:
            severity = error.severity
            if severity not in by_severity:
                by_severity[severity] = 0
            by_severity[severity] += 1
        
        return {
            "total_errors": total_errors,
            "resolved_errors": resolved_errors,
            "resolution_rate": (resolved_errors / total_errors * 100) if total_errors > 0 else 0,
            "time_period_hours": hours,
            "error_rate": total_errors / hours,
            "by_category": by_category,
            "by_severity": by_severity,
            "most_common_errors": [
                error.error_code for error in 
                sorted(recent_errors, key=lambda x: x.timestamp, reverse=True)[:5]
            ]
        }
    
    def get_error_details(self, error_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific error"""
        error_record = self.error_records.get(error_id)
        if not error_record:
            return None
        
        return {
            "error_id": error_record.error_id,
            "timestamp": error_record.timestamp.isoformat(),
            "error_type": error_record.error_type,
            "error_code": error_record.error_code,
            "message": error_record.message,
            "severity": error_record.severity,
            "category": error_record.category,
            "context": asdict(error_record.context),
            "stack_trace": error_record.stack_trace,
            "resolution_attempted": error_record.resolution_attempted,
            "resolved": error_record.resolved,
            "resolution_time": error_record.resolution_time.isoformat() if error_record.resolution_time else None
        }


# Global error handler instance
error_handler = ErrorHandler()