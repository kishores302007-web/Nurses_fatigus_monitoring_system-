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
            # - Lower fatigue is better (weights 50%)
            # - Lower total hours worked is better (weights 30%)
            # - Department proximity (same department gives bonus 20%)
            fatigue_component = (40.0 - candidate.current_fatigue) / 40.0 * 50.0
            work_hours_component = (10.0 - total_hours_24h) / 10.0 * 30.0
            dept_bonus = 20.0 if candidate.department == fatigued_nurse.department else 0.0
            
            availability_score = round(fatigue_component + work_hours_component + dept_bonus, 1)

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

        # Sort by availability score in descending order and limit to top 5
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
