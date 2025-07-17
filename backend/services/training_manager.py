from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from models import TrainingModule, StaffTrainingProgress, SkillCertification, Staff, Business
from services.ai import AIService
import json

class TrainingManager:
    def __init__(self, db: Session):
        self.db = db
        self.ai_service = AIService()
    
    async def create_training_module(self, business_id: int, module_data: Dict) -> Dict:
        """Create a new training module with AI-generated content"""
        
        # Generate AI content if not provided
        if not module_data.get("content_generated"):
            ai_content = await self.ai_service.generate_training_content(
                skill=module_data["title"],
                level=module_data.get("level", "basic"),
                duration_minutes=module_data.get("duration_minutes", 30)
            )
            
            module_data["description"] = ai_content.get("description", module_data.get("description"))
            module_data["quiz_questions"] = ai_content.get("quiz", [])
        
        # Create training module
        training_module = TrainingModule(
            business_id=business_id,
            title=module_data["title"],
            description=module_data.get("description"),
            video_url=module_data.get("video_url"),
            duration_minutes=module_data.get("duration_minutes", 30),
            required_for_skills=module_data.get("required_for_skills", []),
            compliance_requirement=module_data.get("compliance_requirement", False),
            quiz_questions=module_data.get("quiz_questions", []),
            passing_score=module_data.get("passing_score", 80)
        )
        
        self.db.add(training_module)
        self.db.commit()
        
        # Auto-assign to relevant staff
        if module_data.get("auto_assign", True):
            await self.auto_assign_training(training_module)
        
        return {
            "module_id": training_module.id,
            "title": training_module.title,
            "assigned_staff": await self.get_assigned_staff_count(training_module.id),
            "ai_generated": bool(module_data.get("quiz_questions"))
        }
    
    async def auto_assign_training(self, module: TrainingModule):
        """Automatically assign training to relevant staff"""
        
        # Get staff who need this training
        query = self.db.query(Staff).filter(
            Staff.business_id == module.business_id,
            Staff.is_active == True
        )
        
        # Filter by required skills if specified
        if module.required_for_skills:
            # In production, this would use proper JSON querying
            staff_members = query.all()
            relevant_staff = []
            
            for staff in staff_members:
                staff_skills = staff.skills or []
                if any(skill in staff_skills for skill in module.required_for_skills):
                    relevant_staff.append(staff)
        else:
            relevant_staff = query.all()
        
        # Create training progress records
        for staff in relevant_staff:
            existing = self.db.query(StaffTrainingProgress).filter(
                StaffTrainingProgress.staff_id == staff.id,
                StaffTrainingProgress.module_id == module.id
            ).first()
            
            if not existing:
                progress = StaffTrainingProgress(
                    staff_id=staff.id,
                    module_id=module.id,
                    status="not_started"
                )
                self.db.add(progress)
        
        self.db.commit()
    
    async def start_training(self, staff_id: int, module_id: int) -> Dict:
        """Start training for a staff member"""
        
        progress = self.db.query(StaffTrainingProgress).filter(
            StaffTrainingProgress.staff_id == staff_id,
            StaffTrainingProgress.module_id == module_id
        ).first()
        
        if not progress:
            # Create new progress record
            progress = StaffTrainingProgress(
                staff_id=staff_id,
                module_id=module_id,
                status="in_progress",
                started_at=datetime.now()
            )
            self.db.add(progress)
        else:
            progress.status = "in_progress"
            progress.started_at = datetime.now()
        
        self.db.commit()
        
        # Get module details
        module = self.db.query(TrainingModule).filter(
            TrainingModule.id == module_id
        ).first()
        
        return {
            "progress_id": progress.id,
            "module_title": module.title,
            "duration_minutes": module.duration_minutes,
            "video_url": module.video_url,
            "has_quiz": bool(module.quiz_questions),
            "started_at": progress.started_at.isoformat()
        }
    
    async def complete_training(self, staff_id: int, module_id: int, 
                              quiz_answers: List[int] = None) -> Dict:
        """Complete training and process quiz if applicable"""
        
        progress = self.db.query(StaffTrainingProgress).filter(
            StaffTrainingProgress.staff_id == staff_id,
            StaffTrainingProgress.module_id == module_id
        ).first()
        
        if not progress:
            raise ValueError("Training progress not found")
        
        module = self.db.query(TrainingModule).filter(
            TrainingModule.id == module_id
        ).first()
        
        # Process quiz if provided
        quiz_score = None
        passed = True
        
        if quiz_answers and module.quiz_questions:
            quiz_score = await self.grade_quiz(module.quiz_questions, quiz_answers)
            passed = quiz_score >= module.passing_score
        
        # Update progress
        progress.attempts += 1
        
        if passed:
            progress.status = "completed"
            progress.completed_at = datetime.now()
            progress.score = quiz_score
            
            # Generate certificate
            certificate_url = await self.generate_certificate(staff_id, module_id)
            progress.certificate_url = certificate_url
            
            # Create skill certification if applicable
            await self.create_skill_certifications(staff_id, module)
            
        else:
            progress.status = "in_progress"  # Allow retry
            progress.score = quiz_score
        
        self.db.commit()
        
        return {
            "completed": passed,
            "score": quiz_score,
            "passing_score": module.passing_score,
            "certificate_url": progress.certificate_url if passed else None,
            "attempts": progress.attempts,
            "can_retry": not passed and progress.attempts < 3
        }
    
    async def grade_quiz(self, questions: List[Dict], answers: List[int]) -> int:
        """Grade quiz answers and return percentage score"""
        
        if len(answers) != len(questions):
            return 0
        
        correct_answers = 0
        
        for i, question in enumerate(questions):
            if i < len(answers) and answers[i] == question.get("correct", 0):
                correct_answers += 1
        
        return int((correct_answers / len(questions)) * 100)
    
    async def generate_certificate(self, staff_id: int, module_id: int) -> str:
        """Generate training certificate"""
        
        staff = self.db.query(Staff).filter(Staff.id == staff_id).first()
        module = self.db.query(TrainingModule).filter(TrainingModule.id == module_id).first()
        
        # In production, this would generate a PDF certificate
        certificate_data = {
            "staff_name": staff.name,
            "module_title": module.title,
            "completion_date": datetime.now().isoformat(),
            "business_name": staff.business.name if staff.business else "Restaurant"
        }
        
        # Return mock certificate URL
        return f"/certificates/{staff_id}_{module_id}_{datetime.now().strftime('%Y%m%d')}.pdf"
    
    async def create_skill_certifications(self, staff_id: int, module: TrainingModule):
        """Create skill certifications based on completed training"""
        
        if not module.required_for_skills:
            return
        
        for skill in module.required_for_skills:
            # Check if certification already exists
            existing = self.db.query(SkillCertification).filter(
                SkillCertification.staff_id == staff_id,
                SkillCertification.skill_name == skill,
                SkillCertification.is_active == True
            ).first()
            
            if not existing:
                certification = SkillCertification(
                    staff_id=staff_id,
                    skill_name=skill,
                    level="basic",  # Could be determined by module difficulty
                    certified_date=date.today(),
                    expires_date=date.today() + timedelta(days=365) if module.compliance_requirement else None,
                    certifying_module_id=module.id
                )
                self.db.add(certification)
        
        self.db.commit()
    
    async def get_staff_training_dashboard(self, staff_id: int) -> Dict:
        """Get training dashboard for a staff member"""
        
        staff = self.db.query(Staff).filter(Staff.id == staff_id).first()
        
        # Get all training progress
        progress_records = self.db.query(StaffTrainingProgress).filter(
            StaffTrainingProgress.staff_id == staff_id
        ).all()
        
        # Get certifications
        certifications = self.db.query(SkillCertification).filter(
            SkillCertification.staff_id == staff_id,
            SkillCertification.is_active == True
        ).all()
        
        # Calculate statistics
        total_modules = len(progress_records)
        completed_modules = len([p for p in progress_records if p.status == "completed"])
        in_progress = len([p for p in progress_records if p.status == "in_progress"])
        
        # Get upcoming expirations
        upcoming_expirations = []
        for cert in certifications:
            if cert.expires_date and cert.expires_date <= date.today() + timedelta(days=30):
                upcoming_expirations.append({
                    "skill": cert.skill_name,
                    "expires_date": cert.expires_date.isoformat(),
                    "days_remaining": (cert.expires_date - date.today()).days
                })
        
        return {
            "staff_name": staff.name,
            "training_stats": {
                "total_modules": total_modules,
                "completed": completed_modules,
                "in_progress": in_progress,
                "completion_rate": (completed_modules / total_modules * 100) if total_modules > 0 else 0
            },
            "certifications": [
                {
                    "skill": cert.skill_name,
                    "level": cert.level,
                    "certified_date": cert.certified_date.isoformat(),
                    "expires_date": cert.expires_date.isoformat() if cert.expires_date else None
                }
                for cert in certifications
            ],
            "upcoming_expirations": upcoming_expirations,
            "available_modules": await self.get_available_modules(staff_id)
        }
    
    async def get_available_modules(self, staff_id: int) -> List[Dict]:
        """Get available training modules for a staff member"""
        
        staff = self.db.query(Staff).filter(Staff.id == staff_id).first()
        
        # Get all modules for the business
        all_modules = self.db.query(TrainingModule).filter(
            TrainingModule.business_id == staff.business_id,
            TrainingModule.is_active == True
        ).all()
        
        # Get existing progress
        existing_progress = {
            p.module_id: p for p in 
            self.db.query(StaffTrainingProgress).filter(
                StaffTrainingProgress.staff_id == staff_id
            ).all()
        }
        
        available_modules = []
        
        for module in all_modules:
            progress = existing_progress.get(module.id)
            
            # Check if staff should have access to this module
            if module.required_for_skills:
                staff_skills = staff.skills or []
                if not any(skill in staff_skills for skill in module.required_for_skills):
                    continue
            
            module_info = {
                "id": module.id,
                "title": module.title,
                "description": module.description,
                "duration_minutes": module.duration_minutes,
                "compliance_requirement": module.compliance_requirement,
                "status": progress.status if progress else "not_started",
                "score": progress.score if progress else None,
                "completed_at": progress.completed_at.isoformat() if progress and progress.completed_at else None
            }
            
            available_modules.append(module_info)
        
        return available_modules
    
    async def get_business_training_analytics(self, business_id: int) -> Dict:
        """Get training analytics for the business"""
        
        # Get all modules
        modules = self.db.query(TrainingModule).filter(
            TrainingModule.business_id == business_id
        ).all()
        
        # Get all progress records
        progress_records = self.db.query(StaffTrainingProgress).join(TrainingModule).filter(
            TrainingModule.business_id == business_id
        ).all()
        
        # Get all staff
        staff_count = self.db.query(Staff).filter(
            Staff.business_id == business_id,
            Staff.is_active == True
        ).count()
        
        # Calculate analytics
        total_assignments = len(progress_records)
        completed_trainings = len([p for p in progress_records if p.status == "completed"])
        in_progress = len([p for p in progress_records if p.status == "in_progress"])
        
        # Module completion rates
        module_stats = {}
        for module in modules:
            module_progress = [p for p in progress_records if p.module_id == module.id]
            module_completed = len([p for p in module_progress if p.status == "completed"])
            
            module_stats[module.title] = {
                "total_assigned": len(module_progress),
                "completed": module_completed,
                "completion_rate": (module_completed / len(module_progress) * 100) if module_progress else 0
            }
        
        # Compliance status
        compliance_modules = [m for m in modules if m.compliance_requirement]
        compliance_issues = []
        
        for module in compliance_modules:
            overdue_staff = self.db.query(StaffTrainingProgress).filter(
                StaffTrainingProgress.module_id == module.id,
                StaffTrainingProgress.status != "completed"
            ).count()
            
            if overdue_staff > 0:
                compliance_issues.append({
                    "module": module.title,
                    "overdue_staff": overdue_staff
                })
        
        return {
            "overview": {
                "total_modules": len(modules),
                "total_staff": staff_count,
                "total_assignments": total_assignments,
                "completion_rate": (completed_trainings / total_assignments * 100) if total_assignments > 0 else 0
            },
            "module_performance": module_stats,
            "compliance_status": {
                "total_compliance_modules": len(compliance_modules),
                "issues": compliance_issues
            },
            "recent_completions": await self.get_recent_completions(business_id, 7)
        }
    
    async def get_recent_completions(self, business_id: int, days: int) -> List[Dict]:
        """Get recent training completions"""
        
        since_date = datetime.now() - timedelta(days=days)
        
        recent_completions = self.db.query(StaffTrainingProgress).join(TrainingModule).join(Staff).filter(
            TrainingModule.business_id == business_id,
            StaffTrainingProgress.completed_at >= since_date,
            StaffTrainingProgress.status == "completed"
        ).order_by(StaffTrainingProgress.completed_at.desc()).limit(10).all()
        
        return [
            {
                "staff_name": completion.staff.name if hasattr(completion, 'staff') else "Unknown",
                "module_title": completion.module.title if hasattr(completion, 'module') else "Unknown",
                "completed_at": completion.completed_at.isoformat(),
                "score": completion.score
            }
            for completion in recent_completions
        ]
    
    async def get_assigned_staff_count(self, module_id: int) -> int:
        """Get count of staff assigned to a module"""
        
        return self.db.query(StaffTrainingProgress).filter(
            StaffTrainingProgress.module_id == module_id
        ).count()
    
    async def send_training_reminders(self, business_id: int) -> Dict:
        """Send reminders for overdue training"""
        
        # Get overdue training
        overdue_progress = self.db.query(StaffTrainingProgress).join(TrainingModule).filter(
            TrainingModule.business_id == business_id,
            StaffTrainingProgress.status.in_(["not_started", "in_progress"]),
            StaffTrainingProgress.started_at < datetime.now() - timedelta(days=7)
        ).all()
        
        reminders_sent = 0
        
        for progress in overdue_progress:
            # In production, this would send actual reminders via the messaging service
            print(f"Reminder: {progress.staff.name} - {progress.module.title}")
            reminders_sent += 1
        
        return {
            "reminders_sent": reminders_sent,
            "overdue_trainings": len(overdue_progress)
        }