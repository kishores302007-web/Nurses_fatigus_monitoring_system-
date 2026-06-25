import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc

from app.core.config import settings
from app.core.database import get_db, SessionLocal, Base, engine
from app.core.security import verify_password, create_access_token, get_password_hash
from app.models.models import User, Nurse, Device, SensorRecord, FatigueLog, Shift, Alert, AuditLog, ReplacementLog
from app.schemas.schemas import UserLogin, Token, RAGQuery, RAGResponse, ReplacementCreate, UserCreate, ShiftAllot, ProposedFixtureConfirm, ShiftAllotProposed
from app.ml.pipeline import ml_pipeline
from app.ml.simulator import seed_db, generate_live_reading
from app.services.replacement_engine import SmartReplacementEngine
from app.services.shift_optimizer import ShiftOptimizer
from app.rag.assistant import rag_assistant

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("FastAPIServer")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS Middleware setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSockets Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Connection might be closed already
                pass

manager = ConnectionManager()

# Background live simulator task
async def live_sensor_simulator_loop():
    """Periodically drifts nurse physiological data, computes fatigue scores, and broadcasts over WebSockets."""
    await asyncio.sleep(5)  # Wait for server to boot up fully
    logger.info("Starting Live Telemetry Simulator background task...")
    
    while True:
        try:
            db: Session = SessionLocal()
            # 1. Fetch active nurses
            active_nurses = db.query(Nurse).filter(Nurse.status == "Active").all()
            if not active_nurses:
                db.close()
                await asyncio.sleep(3.0)
                continue
                
            # Drift 3 random nurses each cycle to keep it dynamic but not overloaded
            nurses_to_update = random_sample(active_nurses, min(len(active_nurses), 3))
            
            for nurse in nurses_to_update:
                device = db.query(Device).filter(Device.assigned_nurse_id == nurse.id).first()
                if not device:
                    continue
                    
                # Find active shift to see hours worked
                active_shift = db.query(Shift).filter(
                    and_(Shift.nurse_id == nurse.id, Shift.status == "Active")
                ).first()
                hours_worked = active_shift.current_work_hours if active_shift else 6.0
                
                # Increment worked time slightly (e.g. 5 minutes equivalent drift)
                if active_shift:
                    active_shift.current_work_hours += 0.05
                
                # Generate live raw signal
                raw = generate_live_reading(nurse.name, hours_worked)
                
                # Add sensor record
                record = SensorRecord(
                    device_id=device.id,
                    heart_rate=raw["heart_rate"],
                    hrv=raw["hrv"],
                    spo2=raw["spo2"],
                    gsr_voltage=raw["gsr_voltage"],
                    skin_temp=raw["skin_temp"],
                    activity_x=raw["activity_x"],
                    activity_y=raw["activity_y"],
                    activity_z=raw["activity_z"],
                    timestamp=datetime.utcnow()
                )
                db.add(record)
                
                # Compute Fatigue Score
                features = ml_pipeline.extract_features(
                    hr=raw["heart_rate"], hrv=raw["hrv"], spo2=raw["spo2"],
                    gsr=raw["gsr_voltage"], temp=raw["skin_temp"],
                    act_x=raw["activity_x"], act_y=raw["activity_y"], act_z=raw["activity_z"],
                    sleep_hours_last_night=raw["sleep_hours"]
                )
                fatigue_score, risk_level, is_anomaly = ml_pipeline.predict_fatigue(features)
                
                # Projections
                projections = ml_pipeline.predict_future_fatigue(fatigue_score, hours_worked)
                
                # Save fatigue log
                log = FatigueLog(
                    nurse_id=nurse.id,
                    timestamp=datetime.utcnow(),
                    fatigue_score=fatigue_score,
                    risk_level=risk_level,
                    predicted_2h=projections["predicted_2h"],
                    predicted_4h=projections["predicted_4h"],
                    predicted_end_shift=projections["predicted_end_shift"]
                )
                db.add(log)
                
                # Update nurse values
                nurse.current_fatigue = fatigue_score
                nurse.last_seen = datetime.utcnow()
                
                # Update device last seen
                device.last_seen = datetime.utcnow()
                device.status = "Active"
                
                # Check for Alerts
                # Low: >60, High: >75, Critical: >90
                if fatigue_score > 60:
                    alert_type = "Low"
                    if fatigue_score > 90:
                        alert_type = "Critical"
                    elif fatigue_score > 75:
                        alert_type = "High"
                        
                    # Check if active alert already exists for this nurse to prevent spamming
                    existing_alert = db.query(Alert).filter(
                        and_(
                            Alert.nurse_id == nurse.id,
                            Alert.alert_type == alert_type,
                            Alert.resolved == False
                        )
                    ).first()
                    
                    if not existing_alert:
                        new_alert = Alert(
                            nurse_id=nurse.id,
                            alert_type=alert_type,
                            fatigue_score=fatigue_score,
                            status="Active",
                            resolved=False,
                            description=f"Automated Alert: Nurse {nurse.name} fatigue score is critical ({fatigue_score}). Swap advised." if fatigue_score > 75 else f"Fatigue warning: Nurse {nurse.name} showing moderate stress."
                        )
                        db.add(new_alert)
                
                db.commit()
                
                # Broadcast payload via WebSockets
                websocket_payload = {
                    "type": "TELEMETRY_UPDATE",
                    "nurse_id": nurse.id,
                    "nurse_name": nurse.name,
                    "nurse_code": nurse.nurse_id,
                    "department": nurse.department,
                    "fatigue_score": fatigue_score,
                    "risk_level": risk_level,
                    "is_anomaly": is_anomaly,
                    "shift_hours": round(hours_worked, 1),
                    "telemetry": {
                        "heart_rate": raw["heart_rate"],
                        "hrv": raw["hrv"],
                        "spo2": raw["spo2"],
                        "gsr_voltage": raw["gsr_voltage"],
                        "skin_temp": raw["skin_temp"]
                    },
                    "predictions": projections
                }
                await manager.broadcast(websocket_payload)
                
            db.close()
        except Exception as e:
            logger.error(f"Error in Live Telemetry loop: {e}")
            
        await asyncio.sleep(2.5) # cycle every 2.5 seconds

# Database startup operations
@app.on_event("startup")
async def startup_event():
    # 1. Create tables and seed DB
    db = SessionLocal()
    try:
        seed_db(db)
    finally:
        db.close()
        
    # 2. Spawn simulation loop task
    asyncio.create_task(live_sensor_simulator_loop())

def random_sample(population, k):
    import random
    return random.sample(population, k)

# --- ENDPOINTS ---

@app.post(settings.API_V1_STR + "/auth/register")
def register(form_data: UserCreate, db: Session = Depends(get_db)):
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Registration is disabled for this platform. Please contact the administrator."
    )

@app.post(settings.API_V1_STR + "/auth/login", response_model=Token)
def login(form_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(subject=user.username)
    return {"access_token": access_token, "token_type": "bearer"}

@app.get(f"{settings.API_V1_STR}/nurses")
def list_nurses(db: Session = Depends(get_db)):
    nurses = db.query(Nurse).all()
    result = []
    for n in nurses:
        # Check active shift hours
        active_shift = db.query(Shift).filter(
            and_(Shift.nurse_id == n.id, Shift.status == "Active")
        ).first()
        work_hours = active_shift.current_work_hours if active_shift else 0.0
        
        # Get latest device
        device = db.query(Device).filter(Device.assigned_nurse_id == n.id).first()
        device_status = device.status if device else "None"
        
        result.append({
            "id": n.id,
            "nurse_id": n.nurse_id,
            "name": n.name,
            "email": n.email,
            "department": n.department,
            "skill_category": n.skill_category,
            "status": n.status,
            "current_fatigue": n.current_fatigue,
            "device_status": device_status,
            "work_hours": round(work_hours, 1),
            "last_seen": n.last_seen.isoformat()
        })
    return result

@app.get(f"{settings.API_V1_STR}/nurses/kpis")
def get_kpis(db: Session = Depends(get_db)):
    total = db.query(Nurse).count()
    active = db.query(Nurse).filter(Nurse.status.in_(["Active", "Break"])).count()
    high_fatigue = db.query(Nurse).filter(and_(Nurse.status.in_(["Active", "Break"]), Nurse.current_fatigue >= 75)).count()
    
    # Replacement candidates = present, skill match, fatigue < 40
    avail_replacements = db.query(Nurse).filter(
        and_(
            Nurse.status.in_(["Active", "Break"]),
            Nurse.current_fatigue < 40.0
        )
    ).count()
    
    # Shift Coverage % = (Active Nurses / Target count) e.g. target 40
    coverage = round((active / float(total)) * 100.0, 1) if total > 0 else 0.0
    
    return {
        "total_nurses": total,
        "active_nurses": active,
        "high_fatigue_nurses": high_fatigue,
        "available_replacements": avail_replacements,
        "shift_coverage_pct": coverage
    }

@app.get(f"{settings.API_V1_STR}/nurses/charts")
def get_dashboard_charts(db: Session = Depends(get_db)):
    # 1. Department Presence Chart
    dept_presence = {}
    for d in ["ICU", "Emergency", "Cardiology", "General Ward"]:
        active_count = db.query(Nurse).filter(and_(Nurse.department == d, Nurse.status.in_(["Active", "Break"]))).count()
        total_count = db.query(Nurse).filter(Nurse.department == d).count()
        dept_presence[d] = {"active": active_count, "total": total_count}

    # 2. Shift Distribution (Day vs Night)
    # Mocking historical rosters distribution
    shift_dist = [
        {"name": "Morning Shift (07:00 - 19:00)", "value": 26},
        {"name": "Night Shift (19:00 - 07:00)", "value": 14},
        {"name": "Off-Duty", "value": 10}
    ]

    return {
        "dept_presence": dept_presence,
        "shift_distribution": shift_dist
    }

@app.get(settings.API_V1_STR + "/nurses/{nurse_id}/replacement-candidates")
def get_replacement_candidates(nurse_id: str, db: Session = Depends(get_db)):
    candidates = SmartReplacementEngine.find_candidates(db, nurse_id)
    return candidates

@app.post(f"{settings.API_V1_STR}/shifts/replace")
def trigger_replacement(payload: ReplacementCreate, db: Session = Depends(get_db)):
    success = ShiftOptimizer.execute_replacement(
        db=db,
        original_nurse_id=payload.original_nurse_id,
        replacement_nurse_id=payload.replacement_nurse_id,
        shift_id=payload.shift_id,
        justification=payload.justification
    )
    if not success:
        raise HTTPException(status_code=400, detail="Replacement failed. Verify resources.")
    return {"status": "success", "message": "Shift successfully optimized and logs committed."}

@app.post(f"{settings.API_V1_STR}/shifts/allot")
async def allot_shift(payload: ShiftAllot, db: Session = Depends(get_db)):
    # 1. Fetch nurse
    nurse = db.query(Nurse).filter(Nurse.id == payload.nurse_id).first()
    if not nurse:
        raise HTTPException(status_code=404, detail="Nurse not found")
        
    # 2. Deactivate any currently active shift for this nurse to avoid double-allocation
    active_shifts = db.query(Shift).filter(
        and_(Shift.nurse_id == nurse.id, Shift.status == "Active")
    ).all()
    for s in active_shifts:
        s.status = "Completed"
        
    # 3. Create a new shift record starting now with specified duration in hours
    start_time = datetime.utcnow()
    end_time = start_time + timedelta(hours=payload.duration_hours)
    
    new_shift = Shift(
        nurse_id=nurse.id,
        start_time=start_time,
        end_time=end_time,
        status="Active",
        current_work_hours=0.0
    )
    db.add(new_shift)
    
    # 4. Update the nurse profile (department, status, last seen)
    nurse.department = payload.department
    nurse.status = "Active"
    nurse.last_seen = start_time
    
    # 5. Log this allotment action in audit logs
    audit = AuditLog(
        user="Supervisor",
        action="SHIFT_ALLOTMENT",
        timestamp=start_time,
        details=f"Allotted nurse {nurse.name} to {payload.department} ward on {payload.shift_type} shift (Duration: {payload.duration_hours}h)."
    )
    db.add(audit)
    
    # Commit changes
    db.commit()
    
    # 6. Update device if associated
    device = db.query(Device).filter(Device.assigned_nurse_id == nurse.id).first()
    if device:
        device.status = "Active"
        device.last_seen = start_time
        db.commit()
        
    websocket_payload = {
        "type": "TELEMETRY_UPDATE",
        "nurse_id": nurse.id,
        "nurse_name": nurse.name,
        "nurse_code": nurse.nurse_id,
        "department": nurse.department,
        "fatigue_score": nurse.current_fatigue,
        "risk_level": "Normal" if nurse.current_fatigue < 40 else ("Moderate" if nurse.current_fatigue < 60 else "High"),
        "is_anomaly": False,
        "shift_hours": 0.0,
        "telemetry": {
            "heart_rate": 72.0,
            "hrv": 60.0,
            "spo2": 98.0,
            "gsr_voltage": 2.2,
            "skin_temp": 33.5
        },
        "predictions": {
            "predicted_2h": nurse.current_fatigue,
            "predicted_4h": nurse.current_fatigue,
            "predicted_end_shift": nurse.current_fatigue
        }
    }
    
    # Broadcast WebSocket update
    await manager.broadcast(websocket_payload)
    
    return {"status": "success", "message": f"Successfully allotted {nurse.name} to {payload.department} for {payload.duration_hours} hours."}

@app.get(settings.API_V1_STR + "/nurses/{nurse_id}/telemetry-history")
def get_telemetry_history(nurse_id: str, db: Session = Depends(get_db)):
    # Fetch nurse
    nurse = db.query(Nurse).filter(Nurse.id == nurse_id).first()
    if not nurse:
        raise HTTPException(status_code=404, detail="Nurse not found")
        
    device = db.query(Device).filter(Device.assigned_nurse_id == nurse.id).first()
    if not device:
        return []

    # Get latest 15 sensor records
    records = db.query(SensorRecord).filter(
        SensorRecord.device_id == device.id
    ).order_by(desc(SensorRecord.timestamp)).limit(15).all()
    
    # Reverse to keep chronologically ascending
    records.reverse()
    
    # Join with fatigue log at each step
    result = []
    for r in records:
        f_log = db.query(FatigueLog).filter(
            and_(
                FatigueLog.nurse_id == nurse.id,
                FatigueLog.timestamp <= r.timestamp
            )
        ).order_by(desc(FatigueLog.timestamp)).first()
        
        result.append({
            "timestamp": r.timestamp.strftime('%H:%M'),
            "heart_rate": r.heart_rate,
            "hrv": r.hrv,
            "spo2": r.spo2,
            "gsr_voltage": r.gsr_voltage,
            "skin_temp": r.skin_temp,
            "fatigue_score": f_log.fatigue_score if f_log else 15.0
        })
        
    return result

@app.get(settings.API_V1_STR + "/nurses/{nurse_id}/shift-history")
def get_nurse_shift_history(nurse_id: str, db: Session = Depends(get_db)):
    # 1. Fetch nurse
    nurse = db.query(Nurse).filter(Nurse.id == nurse_id).first()
    if not nurse:
        raise HTTPException(status_code=404, detail="Nurse not found")
        
    # 2. Get past shifts and upcoming shifts
    now = datetime.utcnow()
    shifts = db.query(Shift).filter(Shift.nurse_id == nurse_id).order_by(desc(Shift.start_time)).all()
    
    past_shifts = []
    upcoming_shifts = []
    
    for s in shifts:
        shift_data = {
            "id": s.id,
            "start_time": s.start_time.isoformat(),
            "end_time": s.end_time.isoformat(),
            "status": s.status,
            "hours_worked": round(s.current_work_hours, 1),
            "department": nurse.department
        }
        if s.start_time > now or s.status == "Scheduled":
            upcoming_shifts.append(shift_data)
        else:
            past_shifts.append(shift_data)
            
    # 3. Dynamic seed: if there are no upcoming shifts in the database for this nurse,
    # let's generate 3 upcoming shifts starting tomorrow, spaced 2 days apart, and save them in the DB
    if not upcoming_shifts:
        new_upcoming_shifts = []
        for i in range(1, 4):
            day_offset = i * 2
            start_date_future = now + timedelta(days=day_offset)
            is_night = (hash(nurse.id) + start_date_future.day) % 4 == 0
            start_hour = 19 if is_night else 7
            future_start = start_date_future.replace(hour=start_hour, minute=0, second=0, microsecond=0)
            future_end = future_start + timedelta(hours=12)
            
            s = Shift(
                nurse_id=nurse.id,
                start_time=future_start,
                end_time=future_end,
                status="Scheduled",
                current_work_hours=0.0
            )
            db.add(s)
            new_upcoming_shifts.append(s)
        db.commit()
        
        # Reload upcoming shifts from db to include their generated IDs
        upcoming_shifts = []
        for s in new_upcoming_shifts:
            upcoming_shifts.append({
                "id": s.id,
                "start_time": s.start_time.isoformat(),
                "end_time": s.end_time.isoformat(),
                "status": s.status,
                "hours_worked": 0.0,
                "department": nurse.department
            })
            
    # 4. Get replacement log history where this nurse was involved
    replacements = db.query(ReplacementLog).filter(
        (ReplacementLog.original_nurse_id == nurse_id) | 
        (ReplacementLog.replacement_nurse_id == nurse_id)
    ).order_by(desc(ReplacementLog.timestamp)).all()
    
    replacement_history = []
    for r in replacements:
        orig = db.query(Nurse).filter(Nurse.id == r.original_nurse_id).first()
        rep = db.query(Nurse).filter(Nurse.id == r.replacement_nurse_id).first()
        
        role = "Replaced" if r.original_nurse_id == nurse_id else "Replacing"
        
        replacement_history.append({
            "id": r.id,
            "timestamp": r.timestamp.isoformat(),
            "original_nurse": orig.name if orig else "Unknown",
            "replacement_nurse": rep.name if rep else "Unknown",
            "department": orig.department if orig else "Unknown",
            "justification": r.justification,
            "status": r.status,
            "role": role
        })
        
    return {
        "nurse": {
            "id": nurse.id,
            "nurse_id": nurse.nurse_id,
            "name": nurse.name,
            "email": nurse.email,
            "department": nurse.department,
            "skill_category": nurse.skill_category,
            "status": nurse.status,
            "current_fatigue": nurse.current_fatigue,
            "last_seen": nurse.last_seen.isoformat()
        },
        "history": past_shifts,
        "upcoming": upcoming_shifts,
        "replacements": replacement_history
    }

@app.get(f"{settings.API_V1_STR}/shifts/active")
def get_active_shifts(db: Session = Depends(get_db)):
    shifts = db.query(Shift).filter(Shift.status == "Active").all()
    result = []
    for s in shifts:
        nurse = db.query(Nurse).filter(Nurse.id == s.nurse_id).first()
        result.append({
            "id": s.id,
            "nurse_name": nurse.name if nurse else "Unknown",
            "nurse_code": nurse.nurse_id if nurse else "N/A",
            "department": nurse.department if nurse else "N/A",
            "fatigue_score": nurse.current_fatigue if nurse else 0.0,
            "start_time": s.start_time.isoformat(),
            "end_time": s.end_time.isoformat(),
            "hours_worked": round(s.current_work_hours, 1)
        })
    return result

@app.get(f"{settings.API_V1_STR}/shifts/history")
def get_shifts_history(db: Session = Depends(get_db)):
    replacements = db.query(ReplacementLog).order_by(desc(ReplacementLog.timestamp)).all()
    result = []
    for r in replacements:
        orig = db.query(Nurse).filter(Nurse.id == r.original_nurse_id).first()
        rep = db.query(Nurse).filter(Nurse.id == r.replacement_nurse_id).first()
        result.append({
            "id": r.id,
            "timestamp": r.timestamp.isoformat(),
            "original_nurse": orig.name if orig else "Unknown",
            "replacement_nurse": rep.name if rep else "Unknown",
            "department": orig.department if orig else "Unknown",
            "justification": r.justification,
            "status": r.status
        })
    return result

@app.get(settings.API_V1_STR + "/shifts/auto-fixture")
def get_auto_fixture(db: Session = Depends(get_db)):
    # 1. Determine "tomorrow"
    now = datetime.utcnow()
    tomorrow_date = now.date() + timedelta(days=1)
    
    # 2. Get all nurses
    nurses = db.query(Nurse).all()
    if not nurses:
        return []
        
    # 3. Calculate historical stats for each nurse
    nurse_stats = []
    for nurse in nurses:
        # Cumulative hours worked in completed shifts
        completed_shifts = db.query(Shift).filter(
            and_(Shift.nurse_id == nurse.id, Shift.status == "Completed")
        ).all()
        total_hours = sum(s.current_work_hours for s in completed_shifts)
        
        # Average fatigue score
        logs = db.query(FatigueLog).filter(FatigueLog.nurse_id == nurse.id).all()
        avg_fatigue = sum(l.fatigue_score for l in logs) / len(logs) if logs else 15.0
        
        # Last shift end time
        latest_shift = db.query(Shift).filter(
            and_(Shift.nurse_id == nurse.id, Shift.status.in_(["Completed", "Replaced"]))
        ).order_by(desc(Shift.end_time)).first()
        
        last_shift_end = latest_shift.end_time if latest_shift else (now - timedelta(days=5)) # default to 5 days ago if never worked
        
        nurse_stats.append({
            "nurse": nurse,
            "total_hours": total_hours,
            "avg_fatigue": avg_fatigue,
            "last_shift_end": last_shift_end
        })
        
    # 4 wards: ICU, Emergency, Cardiology, General Ward
    wards = ["ICU", "Emergency", "Cardiology", "General Ward"]
    
    # 3 rotations: Morning (07:00 - 15:00), Afternoon (15:00 - 23:00), Night (23:00 - 07:00)
    blocks_def = [
        {"name": "Morning", "start_hour": 7, "duration": 8},
        {"name": "Afternoon", "start_hour": 15, "duration": 8},
        {"name": "Night", "start_hour": 23, "duration": 8}
    ]
    
    proposed_allotments = []
    assigned_nurse_ids = set()
    
    for dept in wards:
        b = 0
        while b < len(blocks_def):
            block = blocks_def[b]
            
            # Start and End Datetime calculations
            # Note: Night shift starts at 23:00 and ends the next morning at 07:00
            start_dt = datetime(tomorrow_date.year, tomorrow_date.month, tomorrow_date.day, block["start_hour"], 0, 0)
            end_dt = start_dt + timedelta(hours=block["duration"])
            
            # Filter eligible standby/offline nurses
            eligible = []
            for ns in nurse_stats:
                if ns["nurse"].id in assigned_nurse_ids:
                    continue
                # Rest duration check (minimum 12 hours since last completed shift)
                rest_duration = (start_dt - ns["last_shift_end"]).total_seconds() / 3600.0
                if rest_duration < 12.0:
                    continue
                
                # Check active shifts today
                active_shift = db.query(Shift).filter(
                    and_(Shift.nurse_id == ns["nurse"].id, Shift.status == "Active")
                ).first()
                if active_shift:
                    # If active shift ends after start_dt minus 12 hours, skip
                    if active_shift.end_time > (start_dt - timedelta(hours=12)):
                        continue
                
                # Score the suitability (lower score is better)
                score = ns["total_hours"] + (ns["avg_fatigue"] * 0.1) - (rest_duration * 0.05)
                
                eligible.append({
                    "ns_data": ns,
                    "rest_duration": rest_duration,
                    "score": score
                })
                
            if eligible:
                # Sort by score ascending (lowest score is best)
                eligible.sort(key=lambda x: x["score"])
                selected = eligible[0]
                selected_nurse = selected["ns_data"]["nurse"]
                
                # Check if this nurse qualifies for a Double Shift (16.0 hours duration)
                # Criteria: Not the last block, avg fatigue < 25.0%, and obtained at least 24 hours of rest
                is_double_eligible = (
                    b < len(blocks_def) - 1 and
                    selected["ns_data"]["avg_fatigue"] < 25.0 and
                    selected["rest_duration"] >= 24.0
                )
                
                if is_double_eligible:
                    # Promote to Double Shift
                    next_block = blocks_def[b+1]
                    duration = 16.0
                    shift_type = f"{block['name']} + {next_block['name']}"
                    classification = "Double Shift"
                    end_dt = start_dt + timedelta(hours=16)
                    b += 2 # Skip the next block since this nurse covers both
                else:
                    # Regular Single Shift
                    duration = 8.0
                    shift_type = block["name"]
                    classification = "Single Shift"
                    b += 1
                
                assigned_nurse_ids.add(selected_nurse.id)
                
                proposed_allotments.append({
                    "nurse_id": selected_nurse.id,
                    "nurse_name": selected_nurse.name,
                    "nurse_code": selected_nurse.nurse_id,
                    "department": dept,
                    "shift_type": shift_type,
                    "duration_hours": duration,
                    "start_time": start_dt.isoformat(),
                    "end_time": end_dt.isoformat(),
                    "past_hours_worked": round(selected["ns_data"]["total_hours"], 1),
                    "average_past_fatigue": round(selected["ns_data"]["avg_fatigue"], 1),
                    "hours_rest_obtained": round(selected["rest_duration"], 1),
                    "score": round(selected["score"], 1),
                    "shift_classification": classification
                })
            else:
                # Fallback: if no eligible nurse, just advance to next block to avoid infinite loop
                b += 1
                
    return proposed_allotments

@app.post(f"{settings.API_V1_STR}/shifts/confirm-fixture")
def confirm_proposed_fixture(payload: ProposedFixtureConfirm, db: Session = Depends(get_db)):
    try:
        now = datetime.utcnow()
        allotted_count = 0
        
        for allot in payload.allotments:
            # 1. Fetch nurse
            nurse = db.query(Nurse).filter(Nurse.id == allot.nurse_id).first()
            if not nurse:
                continue
                
            # Parse iso string times
            start_dt = datetime.fromisoformat(allot.start_time)
            end_dt = datetime.fromisoformat(allot.end_time)
            
            # 2. Schedule it as "Scheduled" since it's a next-day shift
            new_shift = Shift(
                nurse_id=nurse.id,
                start_time=start_dt,
                end_time=end_dt,
                status="Scheduled",
                current_work_hours=0.0
            )
            db.add(new_shift)
            
            # Log allotment action in audit logs
            audit = AuditLog(
                user="Supervisor (Auto-Scheduler)",
                action="SHIFT_ALLOTMENT_AUTO",
                timestamp=now,
                details=f"Auto-allotted nurse {nurse.name} to {allot.department} ward on {allot.shift_type} shift (Duration: {allot.duration_hours}h, start: {start_dt})."
            )
            db.add(audit)
            allotted_count += 1
            
        db.commit()
        return {"status": "success", "message": f"Successfully confirmed next-day cyclic fixture. {allotted_count} shifts scheduled."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to confirm fixture: {str(e)}")

@app.post(f"{settings.API_V1_STR}/rag/query", response_model=RAGResponse)
def handle_rag_query(payload: RAGQuery, db: Session = Depends(get_db)):
    response = rag_assistant.query(db, payload.query)
    return RAGResponse(
        answer=response["answer"],
        sources=response["sources"]
    )

@app.get(settings.API_V1_STR + "/ml/feature-importance/{nurse_id}")
def get_shap_values(nurse_id: str, db: Session = Depends(get_db)):
    nurse = db.query(Nurse).filter(Nurse.id == nurse_id).first()
    if not nurse:
        raise HTTPException(status_code=404, detail="Nurse not found")
        
    device = db.query(Device).filter(Device.assigned_nurse_id == nurse.id).first()
    if not device:
        # standard mock contribution
        return ml_pipeline.get_explainability(np.array([[70.0, 2.2, 1.5, 12.0, 0.4]]))
        
    # Get latest reading
    latest = db.query(SensorRecord).filter(
        SensorRecord.device_id == device.id
    ).order_by(desc(SensorRecord.timestamp)).first()
    
    if not latest:
        return ml_pipeline.get_explainability(np.array([[70.0, 2.2, 1.5, 12.0, 0.4]]))
        
    features = ml_pipeline.extract_features(
        hr=latest.heart_rate, hrv=latest.hrv, spo2=latest.spo2,
        gsr=latest.gsr_voltage, temp=latest.skin_temp,
        act_x=latest.activity_x, act_y=latest.activity_y, act_z=latest.activity_z,
        sleep_hours_last_night=6.5
    )
    
    return ml_pipeline.get_explainability(features)

@app.get(f"{settings.API_V1_STR}/ml/metrics")
def get_ml_metrics():
    return ml_pipeline.get_model_metrics()

@app.get(f"{settings.API_V1_STR}/alerts")
def list_alerts(db: Session = Depends(get_db)):
    alerts = db.query(Alert).order_by(desc(Alert.timestamp)).limit(50).all()
    result = []
    for a in alerts:
        n = db.query(Nurse).filter(Nurse.id == a.nurse_id).first()
        result.append({
            "id": a.id,
            "nurse_name": n.name if n else "Unknown",
            "nurse_code": n.nurse_id if n else "N/A",
            "department": n.department if n else "N/A",
            "alert_type": a.alert_type,
            "fatigue_score": a.fatigue_score,
            "timestamp": a.timestamp.isoformat(),
            "status": a.status,
            "resolved": a.resolved,
            "description": a.description
        })
    return result

@app.post(settings.API_V1_STR + "/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    alert.resolved = True
    alert.status = "Resolved"
    db.commit()
    return {"status": "success", "message": "Alert marked resolved."}

# WebSocket route
@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection open and listen for client commands if any
            data = await websocket.receive_text()
            # Handle client feedback or keepalive
    except WebSocketDisconnect:
        manager.disconnect(websocket)
