from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models.models import Nurse, Shift, ReplacementLog, AuditLog

class ShiftOptimizer:
    @staticmethod
    def execute_replacement(db: Session, original_nurse_id: str, replacement_nurse_id: str, shift_id: str, justification: str) -> bool:
        """Executes the replacement roster changes atomically in the database."""
        try:
            now = datetime.utcnow()
            
            # 1. Fetch resources
            fatigued_nurse = db.query(Nurse).filter(Nurse.id == original_nurse_id).first()
            replacement_nurse = db.query(Nurse).filter(Nurse.id == replacement_nurse_id).first()
            active_shift = db.query(Shift).filter(Shift.id == shift_id).first()
            
            if not fatigued_nurse or not replacement_nurse or not active_shift:
                return False

            # 2. Modify original fatigued nurse:
            # - Shorten shift to end now
            work_duration = (now - active_shift.start_time).total_seconds() / 3600.0
            active_shift.end_time = now
            active_shift.status = "Replaced"
            active_shift.current_work_hours = round(max(0.0, work_duration), 2)
            
            # - Put original nurse on Break/Offline to enforce recovery rest
            fatigued_nurse.status = "Offline"
            
            # 3. Modify replacement nurse:
            # - Create new active shift starting now for the remaining time
            # Assuming original shift was 12 hours total
            remaining_hours = max(2.0, (active_shift.start_time + timedelta_hours(12) - now).total_seconds() / 3600.0)
            new_shift = Shift(
                nurse_id=replacement_nurse.id,
                start_time=now,
                end_time=now + timedelta_hours(remaining_hours),
                status="Active",
                current_work_hours=0.0
            )
            db.add(new_shift)
            
            # - Change replacement nurse status to Active
            replacement_nurse.status = "Active"
            
            # 4. Log replacement event
            log = ReplacementLog(
                original_nurse_id=original_nurse_id,
                replacement_nurse_id=replacement_nurse_id,
                shift_id=shift_id,
                timestamp=now,
                status="Accepted",
                justification=justification
            )
            db.add(log)
            
            # 5. Log audit trail
            audit = AuditLog(
                user="System Optimizer",
                action="SHIFT_REPLACEMENT_ACCEPTED",
                timestamp=now,
                details=f"Replaced fatigued nurse {fatigued_nurse.name} ({fatigued_nurse.nurse_id}) with {replacement_nurse.name} ({replacement_nurse.nurse_id}) for Shift ID {shift_id}. Justification: {justification}"
            )
            db.add(audit)
            
            db.commit()
            return True
            
        except Exception as e:
            db.rollback()
            print(f"Error executing replacement: {e}")
            return False

def timedelta_hours(hours):
    from datetime import timedelta
    return timedelta(hours=hours)
