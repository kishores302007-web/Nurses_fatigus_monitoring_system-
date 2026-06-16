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
from app.schemas.schemas import UserLogin, Token, RAGQuery, RAGResponse, ReplacementCreate, UserCreate, ShiftAllot
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
