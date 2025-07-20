"""
System Administration Service for Platform Owner Admin
Handles infrastructure monitoring, AI model management, and system configuration
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from pydantic import BaseModel
import psutil
import asyncio
import subprocess

from database import get_db
from models import InfrastructureMonitoring, PlatformConfig, AuditLog
from shared.authentication import require_platform_admin, get_current_user
from shared.audit_logging import AuditLogger

router = APIRouter(prefix="/api/platform/infrastructure", tags=["System Administration"])

# Pydantic models for API responses
class SystemHealth(BaseModel):
    overall_status: str
    components: List[Dict[str, Any]]
    last_updated: datetime
    system_metrics: Dict[str, Any]

class AIModelStatus(BaseModel):
    model_name: str
    status: str
    accuracy: float
    last_trained: datetime
    training_data_size: int
    performance_metrics: Dict[str, Any]

class SystemMetrics(BaseModel):
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    network_io: Dict[str, float]
    active_connections: int
    response_time_avg: float
    error_rate: float

class SystemConfig(BaseModel):
    config_key: str
    config_value: Dict[str, Any]
    description: str
    updated_at: datetime

class SystemAdministrationService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_logger = AuditLogger(db)
    
    def get_system_health(self) -> SystemHealth:
        """Get overall system health status"""
        try:
            # Get infrastructure monitoring data
            components = self.db.query(InfrastructureMonitoring).all()
            
            # Calculate overall status
            operational_count = sum(1 for c in components if c.status == 'operational')
            warning_count = sum(1 for c in components if c.status == 'warning')
            error_count = sum(1 for c in components if c.status == 'error')
            
            if error_count > 0:
                overall_status = 'error'
            elif warning_count > 0:
                overall_status = 'warning'
            else:
                overall_status = 'operational'
            
            # Get system metrics
            system_metrics = self._get_system_metrics()
            
            # Format component data
            component_data = []
            for component in components:
                component_data.append({
                    'name': component.component_name,
                    'status': component.status,
                    'uptime': float(component.uptime_percentage),
                    'response_time': component.response_time_ms,
                    'error_rate': float(component.error_rate),
                    'last_check': component.last_check.isoformat()
                })
            
            return SystemHealth(
                overall_status=overall_status,
                components=component_data,
                last_updated=datetime.utcnow(),
                system_metrics=system_metrics.dict()
            )
            
        except Exception as e:
            self.audit_logger.log_error("system_health", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get system health"
            )
    
    def get_ai_model_status(self) -> List[AIModelStatus]:
        """Get AI model status and performance"""
        try:
            # This would integrate with your actual AI model monitoring
            # For demo purposes, returning mock data
            ai_models = [
                {
                    'model_name': 'predictive_scheduling',
                    'status': 'operational',
                    'accuracy': 0.87,
                    'last_trained': datetime.utcnow() - timedelta(days=7),
                    'training_data_size': 15420,
                    'performance_metrics': {
                        'precision': 0.85,
                        'recall': 0.89,
                        'f1_score': 0.87,
                        'inference_time_ms': 245
                    }
                },
                {
                    'model_name': 'demand_forecasting',
                    'status': 'operational',
                    'accuracy': 0.92,
                    'last_trained': datetime.utcnow() - timedelta(days=3),
                    'training_data_size': 8920,
                    'performance_metrics': {
                        'precision': 0.91,
                        'recall': 0.93,
                        'f1_score': 0.92,
                        'inference_time_ms': 180
                    }
                },
                {
                    'model_name': 'staff_optimization',
                    'status': 'warning',
                    'accuracy': 0.78,
                    'last_trained': datetime.utcnow() - timedelta(days=14),
                    'training_data_size': 5670,
                    'performance_metrics': {
                        'precision': 0.76,
                        'recall': 0.80,
                        'f1_score': 0.78,
                        'inference_time_ms': 320
                    }
                }
            ]
            
            return [AIModelStatus(**model) for model in ai_models]
            
        except Exception as e:
            self.audit_logger.log_error("ai_model_status", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get AI model status"
            )
    
    def retrain_ai_model(self, model_name: str, user_id: int) -> Dict[str, Any]:
        """Retrain a specific AI model"""
        try:
            # This would trigger actual model retraining
            # For demo purposes, simulating the process
            
            # Log the action
            self.audit_logger.log_platform_action(
                user_id=user_id,
                user_email="",  # Would get from user lookup
                action="retrain_ai_model",
                resource_type="ai_model",
                resource_id=model_name,
                details={"model_name": model_name}
            )
            
            # Simulate retraining process
            # In production, this would:
            # 1. Trigger model retraining job
            # 2. Update model status to 'training'
            # 3. Monitor training progress
            # 4. Update model when complete
            
            return {
                "success": True,
                "model_name": model_name,
                "status": "training_initiated",
                "estimated_duration": "2-4 hours",
                "message": f"Retraining initiated for {model_name}"
            }
            
        except Exception as e:
            self.audit_logger.log_error("ai_model_retrain", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrain AI model"
            )
    
    def get_system_config(self) -> List[SystemConfig]:
        """Get system configuration settings"""
        try:
            configs = self.db.query(PlatformConfig).all()
            
            config_list = []
            for config in configs:
                config_list.append(SystemConfig(
                    config_key=config.config_key,
                    config_value=config.config_value,
                    description=config.description,
                    updated_at=config.updated_at
                ))
            
            return config_list
            
        except Exception as e:
            self.audit_logger.log_error("system_config", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get system configuration"
            )
    
    def update_system_config(self, config_key: str, config_value: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        """Update system configuration"""
        try:
            config = self.db.query(PlatformConfig).filter(PlatformConfig.config_key == config_key).first()
            
            if not config:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Configuration not found"
                )
            
            old_value = config.config_value
            config.config_value = config_value
            config.updated_at = datetime.utcnow()
            self.db.commit()
            
            # Log the action
            self.audit_logger.log_platform_action(
                user_id=user_id,
                user_email="",  # Would get from user lookup
                action="update_system_config",
                resource_type="system_config",
                resource_id=config_key,
                details={
                    "old_value": old_value,
                    "new_value": config_value
                }
            )
            
            return {
                "success": True,
                "config_key": config_key,
                "message": "Configuration updated successfully"
            }
            
        except HTTPException:
            raise
        except Exception as e:
            self.audit_logger.log_error("update_system_config", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update system configuration"
            )
    
    def get_performance_metrics(self, hours: int = 24) -> Dict[str, Any]:
        """Get system performance metrics over time"""
        try:
            # Get current system metrics
            current_metrics = self._get_system_metrics()
            
            # Get historical data (simplified - would query actual metrics database)
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(hours=hours)
            
            # Generate sample historical data
            historical_data = []
            current_time = start_time
            
            while current_time <= end_time:
                historical_data.append({
                    'timestamp': current_time.isoformat(),
                    'cpu_usage': 45 + (current_time.hour * 2) + (current_time.minute % 30),
                    'memory_usage': 60 + (current_time.hour * 1.5),
                    'disk_usage': 75 + (current_time.hour * 0.5),
                    'response_time': 150 + (current_time.hour * 10),
                    'error_rate': 0.001 + (current_time.hour * 0.0001)
                })
                current_time += timedelta(minutes=15)
            
            return {
                'current_metrics': current_metrics.dict(),
                'historical_data': historical_data,
                'summary': {
                    'avg_cpu_usage': sum(d['cpu_usage'] for d in historical_data) / len(historical_data),
                    'avg_memory_usage': sum(d['memory_usage'] for d in historical_data) / len(historical_data),
                    'avg_response_time': sum(d['response_time'] for d in historical_data) / len(historical_data),
                    'peak_cpu_usage': max(d['cpu_usage'] for d in historical_data),
                    'peak_memory_usage': max(d['memory_usage'] for d in historical_data)
                }
            }
            
        except Exception as e:
            self.audit_logger.log_error("performance_metrics", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get performance metrics"
            )
    
    def trigger_system_maintenance(self, maintenance_type: str, user_id: int) -> Dict[str, Any]:
        """Trigger system maintenance tasks"""
        try:
            valid_types = ['database_optimization', 'cache_clear', 'log_cleanup', 'backup']
            
            if maintenance_type not in valid_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid maintenance type. Must be one of: {valid_types}"
                )
            
            # Log the action
            self.audit_logger.log_platform_action(
                user_id=user_id,
                user_email="",  # Would get from user lookup
                action="trigger_maintenance",
                resource_type="system",
                resource_id=maintenance_type,
                details={"maintenance_type": maintenance_type}
            )
            
            # Simulate maintenance process
            # In production, this would trigger actual maintenance tasks
            
            return {
                "success": True,
                "maintenance_type": maintenance_type,
                "status": "initiated",
                "estimated_duration": "5-15 minutes",
                "message": f"{maintenance_type.replace('_', ' ').title()} initiated"
            }
            
        except HTTPException:
            raise
        except Exception as e:
            self.audit_logger.log_error("system_maintenance", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to trigger system maintenance"
            )
    
    def _get_system_metrics(self) -> SystemMetrics:
        """Get current system metrics"""
        try:
            # Get CPU usage
            cpu_usage = psutil.cpu_percent(interval=1)
            
            # Get memory usage
            memory = psutil.virtual_memory()
            memory_usage = memory.percent
            
            # Get disk usage
            disk = psutil.disk_usage('/')
            disk_usage = (disk.used / disk.total) * 100
            
            # Get network I/O
            network = psutil.net_io_counters()
            network_io = {
                'bytes_sent': network.bytes_sent,
                'bytes_recv': network.bytes_recv,
                'packets_sent': network.packets_sent,
                'packets_recv': network.packets_recv
            }
            
            # Get active connections (simplified)
            active_connections = len(psutil.net_connections())
            
            # Mock response time and error rate
            response_time_avg = 150.0  # Would get from actual monitoring
            error_rate = 0.001  # Would get from actual monitoring
            
            return SystemMetrics(
                cpu_usage=cpu_usage,
                memory_usage=memory_usage,
                disk_usage=disk_usage,
                network_io=network_io,
                active_connections=active_connections,
                response_time_avg=response_time_avg,
                error_rate=error_rate
            )
            
        except Exception as e:
            # Fallback to mock data if psutil fails
            return SystemMetrics(
                cpu_usage=45.0,
                memory_usage=65.0,
                disk_usage=75.0,
                network_io={'bytes_sent': 0, 'bytes_recv': 0, 'packets_sent': 0, 'packets_recv': 0},
                active_connections=0,
                response_time_avg=150.0,
                error_rate=0.001
            )

# API endpoints
@router.get("/health", response_model=SystemHealth)
def get_system_health(
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get overall system health status"""
    service = SystemAdministrationService(db)
    return service.get_system_health()

@router.get("/ai-models", response_model=List[AIModelStatus])
def get_ai_model_status(
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get AI model status and performance"""
    service = SystemAdministrationService(db)
    return service.get_ai_model_status()

@router.post("/ai-models/{model_name}/retrain")
def retrain_ai_model(
    model_name: str,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Retrain a specific AI model"""
    service = SystemAdministrationService(db)
    return service.retrain_ai_model(model_name, current_user.id)

@router.get("/config", response_model=List[SystemConfig])
def get_system_config(
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get system configuration settings"""
    service = SystemAdministrationService(db)
    return service.get_system_config()

@router.put("/config/{config_key}")
def update_system_config(
    config_key: str,
    config_value: Dict[str, Any],
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Update system configuration"""
    service = SystemAdministrationService(db)
    return service.update_system_config(config_key, config_value, current_user.id)

@router.get("/performance")
def get_performance_metrics(
    hours: int = 24,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get system performance metrics over time"""
    service = SystemAdministrationService(db)
    return service.get_performance_metrics(hours)

@router.post("/maintenance/{maintenance_type}")
def trigger_system_maintenance(
    maintenance_type: str,
    current_user: Staff = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Trigger system maintenance tasks"""
    service = SystemAdministrationService(db)
    return service.trigger_system_maintenance(maintenance_type, current_user.id) 