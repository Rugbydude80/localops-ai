"""
API endpoints for error monitoring and system health
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

from database import get_db
from services.error_handler import error_handler
from services.ai_scheduling_engine import AISchedulingEngine
from services.notification_service import NotificationService

router = APIRouter(prefix="/api/system", tags=["System Health & Error Monitoring"])


@router.get("/health/detailed")
async def detailed_health_check(db: Session = Depends(get_db)):
    """Comprehensive system health check with component status"""
    
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "components": {},
        "error_summary": {},
        "uptime": "unknown"
    }
    
    try:
        # Check database connectivity
        db.execute("SELECT 1")
        health_status["components"]["database"] = {
            "status": "healthy",
            "response_time_ms": 0  # Would measure actual response time
        }
    except Exception as e:
        health_status["components"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        health_status["status"] = "degraded"
    
    # Check AI service availability
    try:
        ai_engine = AISchedulingEngine(db)
        if ai_engine.ai_enabled:
            health_status["components"]["ai_service"] = {
                "status": "healthy",
                "provider": "OpenAI",
                "model": ai_engine.model
            }
        else:
            health_status["components"]["ai_service"] = {
                "status": "disabled",
                "message": "AI service not configured"
            }
    except Exception as e:
        health_status["components"]["ai_service"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        health_status["status"] = "degraded"
    
    # Check notification services
    try:
        notification_service = NotificationService(db)
        health_status["components"]["notifications"] = {
            "status": "healthy",
            "channels": ["whatsapp", "sms", "email"]
        }
    except Exception as e:
        health_status["components"]["notifications"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        health_status["status"] = "degraded"
    
    # Get error statistics
    try:
        error_stats = error_handler.get_error_statistics(hours=24)
        health_status["error_summary"] = {
            "last_24h_errors": error_stats["total_errors"],
            "resolution_rate": error_stats["resolution_rate"],
            "error_rate_per_hour": error_stats["error_rate"],
            "critical_errors": error_stats["by_severity"].get("critical", 0),
            "high_severity_errors": error_stats["by_severity"].get("high", 0)
        }
        
        # Mark as unhealthy if too many critical errors
        if error_stats["by_severity"].get("critical", 0) > 5:
            health_status["status"] = "unhealthy"
        elif error_stats["error_rate"] > 10:  # More than 10 errors per hour
            health_status["status"] = "degraded"
            
    except Exception as e:
        health_status["error_summary"] = {"error": f"Failed to get error statistics: {str(e)}"}
    
    return health_status


@router.get("/errors/statistics")
async def get_error_statistics(
    hours: int = Query(24, ge=1, le=168, description="Hours to look back (1-168)"),
    category: Optional[str] = Query(None, description="Filter by error category"),
    severity: Optional[str] = Query(None, description="Filter by error severity")
):
    """Get comprehensive error statistics and trends"""
    
    try:
        # Get basic statistics
        stats = error_handler.get_error_statistics(hours=hours)
        
        # Add additional analysis
        enhanced_stats = {
            **stats,
            "analysis": {
                "health_score": _calculate_health_score(stats),
                "trend": _analyze_error_trend(stats),
                "recommendations": _generate_health_recommendations(stats)
            },
            "filters_applied": {
                "hours": hours,
                "category": category,
                "severity": severity
            }
        }
        
        return enhanced_stats
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve error statistics: {str(e)}"
        )


@router.get("/errors/{error_id}")
async def get_error_details(error_id: str):
    """Get detailed information about a specific error"""
    
    try:
        error_details = error_handler.get_error_details(error_id)
        
        if not error_details:
            raise HTTPException(
                status_code=404,
                detail=f"Error {error_id} not found"
            )
        
        return error_details
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve error details: {str(e)}"
        )


@router.get("/errors")
async def list_recent_errors(
    limit: int = Query(50, ge=1, le=500, description="Number of errors to return"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    category: Optional[str] = Query(None, description="Filter by category"),
    resolved: Optional[bool] = Query(None, description="Filter by resolution status")
):
    """List recent errors with filtering options"""
    
    try:
        # Get all error records
        all_errors = list(error_handler.error_records.values())
        
        # Apply filters
        filtered_errors = all_errors
        
        if severity:
            filtered_errors = [e for e in filtered_errors if e.severity == severity]
        
        if category:
            filtered_errors = [e for e in filtered_errors if e.category == category]
        
        if resolved is not None:
            filtered_errors = [e for e in filtered_errors if e.resolved == resolved]
        
        # Sort by timestamp (most recent first)
        filtered_errors.sort(key=lambda x: x.timestamp, reverse=True)
        
        # Limit results
        limited_errors = filtered_errors[:limit]
        
        # Convert to response format
        error_list = []
        for error in limited_errors:
            error_list.append({
                "error_id": error.error_id,
                "timestamp": error.timestamp.isoformat(),
                "error_type": error.error_type,
                "error_code": error.error_code,
                "message": error.message,
                "severity": error.severity,
                "category": error.category,
                "resolved": error.resolved,
                "resolution_attempted": error.resolution_attempted,
                "context": {
                    "operation": error.context.operation,
                    "business_id": error.context.business_id,
                    "draft_id": error.context.draft_id
                }
            })
        
        return {
            "errors": error_list,
            "total_found": len(filtered_errors),
            "returned": len(error_list),
            "filters": {
                "severity": severity,
                "category": category,
                "resolved": resolved,
                "limit": limit
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list errors: {str(e)}"
        )


@router.post("/errors/test")
async def test_error_handling(
    error_type: str = Query("ai_service", description="Type of error to simulate"),
    enable_recovery: bool = Query(True, description="Enable recovery mechanisms")
):
    """Test error handling mechanisms (for development/testing)"""
    
    try:
        from services.error_handler import ErrorContext
        from exceptions import (
            AIServiceException, NotificationException, ConstraintViolationException,
            InsufficientStaffException, ExternalAPIException
        )
        
        # Create test error based on type
        if error_type == "ai_service":
            test_error = AIServiceException(
                message="Test AI service failure",
                service_name="OpenAI",
                error_type="test_error"
            )
        elif error_type == "notification":
            test_error = NotificationException(
                message="Test notification failure",
                channel="whatsapp",
                staff_id=999,
                details={"test": True}
            )
        elif error_type == "constraint":
            test_error = ConstraintViolationException(
                constraint_type="test_constraint",
                violation_details={"test": "data"},
                affected_staff=[999]
            )
        elif error_type == "insufficient_staff":
            test_error = InsufficientStaffException(
                required_skills=["test_skill"],
                available_count=0,
                required_count=5
            )
        elif error_type == "external_api":
            test_error = ExternalAPIException(
                service_name="TestAPI",
                operation="test_operation",
                error_message="Test API failure",
                status_code=503
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown error type: {error_type}"
            )
        
        # Create test context
        test_context = ErrorContext(
            operation="test_error_handling",
            additional_data={"test": True, "error_type": error_type}
        )
        
        # Handle the test error
        result = await error_handler.handle_error(
            test_error, test_context, enable_fallback=enable_recovery
        )
        
        return {
            "test_completed": True,
            "error_type": error_type,
            "recovery_enabled": enable_recovery,
            "result": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error testing failed: {str(e)}"
        )


def _calculate_health_score(stats: Dict[str, Any]) -> float:
    """Calculate overall system health score (0-100)"""
    
    if stats["total_errors"] == 0:
        return 100.0
    
    # Base score
    score = 100.0
    
    # Deduct points for errors
    score -= min(stats["total_errors"] * 2, 30)  # Max 30 points for error count
    
    # Deduct more for high severity errors
    high_severity = stats["by_severity"].get("high", 0) + stats["by_severity"].get("critical", 0)
    score -= min(high_severity * 5, 40)  # Max 40 points for high severity
    
    # Add points for good resolution rate
    if stats["total_errors"] > 0:
        resolution_bonus = (stats["resolution_rate"] / 100) * 20  # Max 20 points
        score += resolution_bonus
    
    return max(0.0, min(100.0, score))


def _analyze_error_trend(stats: Dict[str, Any]) -> str:
    """Analyze error trend (would need historical data for real implementation)"""
    
    error_rate = stats["error_rate"]
    
    if error_rate == 0:
        return "stable"
    elif error_rate < 1:
        return "low"
    elif error_rate < 5:
        return "moderate"
    elif error_rate < 10:
        return "high"
    else:
        return "critical"


def _generate_health_recommendations(stats: Dict[str, Any]) -> List[str]:
    """Generate health recommendations based on error statistics"""
    
    recommendations = []
    
    if stats["total_errors"] == 0:
        recommendations.append("System is running smoothly with no errors detected")
        return recommendations
    
    # High error rate
    if stats["error_rate"] > 5:
        recommendations.append("High error rate detected - investigate system load and performance")
    
    # Low resolution rate
    if stats["resolution_rate"] < 70:
        recommendations.append("Low error resolution rate - review error handling mechanisms")
    
    # Critical errors
    critical_errors = stats["by_severity"].get("critical", 0)
    if critical_errors > 0:
        recommendations.append(f"{critical_errors} critical errors detected - immediate attention required")
    
    # Category-specific recommendations
    by_category = stats["by_category"]
    
    if by_category.get("ai_service", 0) > 3:
        recommendations.append("Multiple AI service errors - check OpenAI API status and configuration")
    
    if by_category.get("notification", 0) > 5:
        recommendations.append("Multiple notification errors - verify external service configurations")
    
    if by_category.get("constraint_violation", 0) > 2:
        recommendations.append("Constraint violations detected - review scheduling rules and staff availability")
    
    if not recommendations:
        recommendations.append("Monitor error trends and consider preventive measures")
    
    return recommendations