from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Dict, Any
from app.models.models import Nurse, Shift, ReplacementLog

class SmartReplacementEngine:
    @staticmethod
    def find_candidates(db: Session, fatigued_nurse_id: str) -> List[Dict[str, Any]]:
        """Finds and ranks the top 5 replacement candidates for a highly fatigued nurse."""
        # 1. Get fatigued nurse details
        fatigued_nurse = db.query(Nurse).filter(Nurse.id == fatigued_nurse_id).first()
        if not fatigued_nurse:
            return []

        # Find active shift of fatigued nurse
        active_shift = db.query(Shift).filter(
            and_(
                Shift.nurse_id == fatigued_nurse_id,
                Shift.status == "Active"
            )
        ).first()

        # 2. Query candidates:
        # - Must not be the fatigued nurse
        # - Must be present (Status is 'Active' or 'Break' or ready to call in: let's filter 'Active'/'Break' for immediate availability, or 'Offline' if they are on call but fatigue < 40)
        # - Same skill category
        # - Current fatigue < 40
        candidates = db.query(Nurse).filter(
            and_(
                Nurse.id != fatigued_nurse_id,
                Nurse.skill_category == fatigued_nurse.skill_category,
                Nurse.current_fatigue < 40.0,
                Nurse.status.in_(["Active", "Break"])
            )
        ).all()

        recommendations = []
        for candidate in candidates:
            # 3. Check shift history & capacity
            # Sum of active/scheduled shift hours in the last 24h
            recent_shifts = db.query(Shift).filter(
                and_(
                    Shift.nurse_id == candidate.id,
                    Shift.start_time >= (datetime_now() - timedelta(hours=24))
                )
            ).all()
            
            total_hours_24h = sum(s.current_work_hours for s in recent_shifts)
            
            # Skip if they have already worked high hours
            if total_hours_24h >= 10.0:
                continue

            # Check if they were assigned a replacement recently (cooldown)
            recent_replacements = db.query(ReplacementLog).filter(
                and_(
                    ReplacementLog.replacement_nurse_id == candidate.id,
                    ReplacementLog.timestamp >= (datetime_now() - timedelta(hours=12))
                )
            ).count()
            
            if recent_replacements > 0:
                continue

            # 4. Calculate Recommendation Score:
            # Based purely on lowest fatigue score as requested (higher match score = lower fatigue)
            availability_score = round(100.0 - candidate.current_fatigue, 1)

            recommendations.append({
                "id": candidate.id,
                "name": candidate.name,
                "nurse_id": candidate.nurse_id,
                "department": candidate.department,
                "skill_category": candidate.skill_category,
                "fatigue_score": candidate.current_fatigue,
                "current_work_hours": round(total_hours_24h, 1),
                "availability_score": availability_score,
                "status": candidate.status
            })

        # FALLBACK 1: If we have fewer than 5 candidates, query offline standby nurses with same skills and fatigue < 50
        if len(recommendations) < 5:
            offline_candidates = db.query(Nurse).filter(
                and_(
                    Nurse.id != fatigued_nurse_id,
                    Nurse.skill_category == fatigued_nurse.skill_category,
                    Nurse.current_fatigue < 50.0,
                    Nurse.status == "Offline"
                )
            ).all()
            
            for candidate in offline_candidates:
                if len(recommendations) >= 5:
                    break
                if any(r["id"] == candidate.id for r in recommendations):
                    continue
                
                recent_shifts = db.query(Shift).filter(
                    and_(
                        Shift.nurse_id == candidate.id,
                        Shift.start_time >= (datetime_now() - timedelta(hours=24))
                    )
                ).all()
                total_hours_24h = sum(s.current_work_hours for s in recent_shifts)
                
                # Apply a slight penalty for offline status to rank them below active options
                availability_score = round(100.0 - candidate.current_fatigue - 10.0, 1)
                
                recommendations.append({
                    "id": candidate.id,
                    "name": candidate.name,
                    "nurse_id": candidate.nurse_id,
                    "department": candidate.department,
                    "skill_category": candidate.skill_category,
                    "fatigue_score": candidate.current_fatigue,
                    "current_work_hours": round(total_hours_24h, 1),
                    "availability_score": availability_score,
                    "status": candidate.status
                })

        # FALLBACK 2: If we still have fewer than 5 candidates, relax fatigue threshold for active/break nurses up to 65%
        if len(recommendations) < 5:
            relaxed_candidates = db.query(Nurse).filter(
                and_(
                    Nurse.id != fatigued_nurse_id,
                    Nurse.skill_category == fatigued_nurse.skill_category,
                    Nurse.current_fatigue >= 40.0,
                    Nurse.current_fatigue < 65.0,
                    Nurse.status.in_(["Active", "Break"])
                )
            ).all()
            
            for candidate in relaxed_candidates:
                if len(recommendations) >= 5:
                    break
                if any(r["id"] == candidate.id for r in recommendations):
                    continue
                    
                recent_shifts = db.query(Shift).filter(
                    and_(
                        Shift.nurse_id == candidate.id,
                        Shift.start_time >= (datetime_now() - timedelta(hours=24))
                    )
                ).all()
                total_hours_24h = sum(s.current_work_hours for s in recent_shifts)
                
                availability_score = round(100.0 - candidate.current_fatigue, 1)
                
                recommendations.append({
                    "id": candidate.id,
                    "name": candidate.name,
                    "nurse_id": candidate.nurse_id,
                    "department": candidate.department,
                    "skill_category": candidate.skill_category,
                    "fatigue_score": candidate.current_fatigue,
                    "current_work_hours": round(total_hours_24h, 1),
                    "availability_score": availability_score,
                    "status": candidate.status
                })

        # FALLBACK 3: If we STILL have fewer than 5 candidates, fetch any nurse in the hospital with the lowest fatigue
        if len(recommendations) < 5:
            any_nurses = db.query(Nurse).filter(
                Nurse.id != fatigued_nurse_id
            ).order_by(Nurse.current_fatigue.asc()).all()
            
            for candidate in any_nurses:
                if len(recommendations) >= 5:
                    break
                if any(r["id"] == candidate.id for r in recommendations):
                    continue
                    
                recent_shifts = db.query(Shift).filter(
                    and_(
                        Shift.nurse_id == candidate.id,
                        Shift.start_time >= (datetime_now() - timedelta(hours=24))
                    )
                ).all()
                total_hours_24h = sum(s.current_work_hours for s in recent_shifts)
                
                # Apply a penalty for skill category mismatch
                skill_penalty = 15.0 if candidate.skill_category != fatigued_nurse.skill_category else 0.0
                availability_score = round(100.0 - candidate.current_fatigue - skill_penalty, 1)
                
                recommendations.append({
                    "id": candidate.id,
                    "name": candidate.name,
                    "nurse_id": candidate.nurse_id,
                    "department": candidate.department,
                    "skill_category": candidate.skill_category,
                    "fatigue_score": candidate.current_fatigue,
                    "current_work_hours": round(total_hours_24h, 1),
                    "availability_score": availability_score,
                    "status": candidate.status
                })

        # Sort by availability score in descending order (highest score first)
        recommendations.sort(key=lambda x: x["availability_score"], reverse=True)
        
        # Add ranks
        for idx, rec in enumerate(recommendations[:5]):
            rec["recommendation_rank"] = idx + 1

        return recommendations[:5]

# Local helper to simulate utcnow in absence of datetime
def datetime_now():
    from datetime import datetime
    return datetime.utcnow()

def timedelta(hours):
    from datetime import timedelta
    return timedelta(hours=hours)
