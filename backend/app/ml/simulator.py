import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.models import Base, User, Nurse, Device, SensorRecord, FatigueLog, Shift, Alert, ReplacementLog
from app.core.security import get_password_hash
from app.ml.pipeline import ml_pipeline

DEPARTMENTS = ["ICU", "Emergency", "Cardiology", "General Ward"]
SKILL_CATEGORIES = {
    "ICU": "Critical Care",
    "Emergency": "ER Specialist",
    "Cardiology": "Cardiac Specialist",
    "General Ward": "General Practice"
}

NURSE_NAMES = [
    "Sarah Jenkins", "Emily Rodriguez", "Michael Chang", "Jessica Taylor", "David Smith",
    "Ashley Johnson", "James Wilson", "Amanda Martinez", "Robert Anderson", "Megan Thomas",
    "William Jackson", "Jennifer White", "David Harris", "Lisa Martin", "Joseph Thompson",
    "Karen Garcia", "Thomas Martinez", "Nancy Robinson", "Charles Clark", "Sandra Rodriguez",
    "Daniel Lewis", "Donna Lee", "Matthew Walker", "Ruth Hall", "Donald Allen",
    "Michelle Young", "Paul King", "Laura Wright", "Steven Scott", "Kimberly Green",
    "Andrew Baker", "Elizabeth Adams", "Joshua Nelson", "Linda Hill", "Kevin Ramirez",
    "Patricia Campbell", "Brian Mitchell", "Susan Carter", "Edward Roberts", "Jessica Gomez",
    "Ronald Phillips", "Sarah Evans", "Timothy Turner", "Karen Diaz", "Jason Parker",
    "Helen Edwards", "Jeffrey Collins", "Deborah Stewart", "Gary Morris", "Maria Rogers",
    "Ashley Smith", "Christopher Miller", "Amanda Davis", "Matthew Garcia", "Daniel Rodriguez",
    "David Wilson", "James Martinez", "Jennifer Anderson", "John Taylor", "Joseph Thomas",
    "Joshua Moore", "Jessica Jackson", "Justin Martin", "Karen Lee", "Kimberly Perez",
    "Linda Thompson", "Lisa White", "Mary Harris", "Michael Sanchez", "Nancy Clark",
    "Patricia Ramirez", "Paul Lewis", "Richard Robinson", "Robert Walker", "Ronald Young",
    "Sandra Allen", "Sarah King", "Steven Wright", "Susan Scott", "Thomas Green",
    "Timothy Baker", "William Adams", "Barbara Nelson", "Charles Hill", "Daniel Campbell",
    "Dorothy Mitchell", "Elizabeth Carter", "Emily Roberts", "Helen Gomez", "James Phillips",
    "John Evans", "Joseph Turner", "Margaret Diaz", "Maria Parker", "Patricia Edwards",
    "Richard Collins", "Robert Stewart", "Susan Morris", "Thomas Rogers", "William Reed"
]

def seed_db(db: Session):
    """Seeds the database with 100 nurses, devices, shifts, alerts, and 200,000+ sensor records."""
    print("Initializing Database Seeding...")
    
    # Create tables
    Base.metadata.create_all(bind=db.get_bind())

    # Check if already seeded
    if db.query(User).count() > 0:
        print("Database already seeded. Skipping.")
        return

    # 1. Create Default Admin Users
    admin1 = User(
        username="admin1",
        hashed_password=get_password_hash("123"),
        role="admin",
        name="Admin One",
        email="admin1@hospital.org"
    )
    admin2 = User(
        username="admin2",
        hashed_password=get_password_hash("321"),
        role="admin",
        name="Admin Two",
        email="admin2@hospital.org"
    )
    db.add(admin1)
    db.add(admin2)
    db.commit()
    print("Add 100 dummy data (nurses) in mysql database")
    print("Users seeded (admin1/123, admin2/321)")

    # 2. Create 100 Nurses and Devices
    nurses = []
    devices = []
    for i, name in enumerate(NURSE_NAMES):
        dept = DEPARTMENTS[i % len(DEPARTMENTS)]
        skill = SKILL_CATEGORIES[dept]
        
        # Nurse ID format: NS-001 to NS-100
        nurse_num = f"{i+1:03d}"
        nurse_id_str = f"NS-{nurse_num}"
        email = f"{name.lower().replace(' ', '.')}@hospital.org"
        
        # Determine status distribution
        status = "Offline"
        if i < 80: # 80 active/break, 20 offline
            status = "Active" if random.random() > 0.15 else "Break"

        nurse = Nurse(
            nurse_id=nurse_id_str,
            name=name,
            email=email,
            department=dept,
            skill_category=skill,
            status=status,
            max_shift_hours=12.0,
            current_fatigue=0.0,
            last_seen=datetime.utcnow() - timedelta(minutes=random.randint(1, 60))
        )
        db.add(nurse)
        nurses.append(nurse)
        
        # Create Device for each nurse
        mac = f"00:1A:2B:3C:{i:02X}:{random.randint(10, 99):02d}"
        device = Device(
            mac_address=mac,
            status="Active" if status != "Offline" else "Inactive",
            assigned_nurse=nurse,
            last_seen=nurse.last_seen
        )
        db.add(device)
        devices.append(device)
        
    db.commit()
    print("100 Nurses and Wearable Devices seeded.")

    # 3. Create shifts and historical records over last 30 days
    print("Generating 100,000+ sensor records over 30 days...")
    
    start_date = datetime.utcnow() - timedelta(days=30)
    record_count = 0
    records_to_add = []
    fatigue_logs_to_add = []
    shifts_to_add = []
    
    # To generate 100,000 records efficiently, let's create shifts for nurses
    # Each nurse does roughly 15 shifts in 30 days (every other day).
    # Each shift is 12 hours. We can sample sensors every 10 minutes (72 readings per shift)
    # 50 nurses * 15 shifts * 72 readings = 54,000 readings.
    # To hit 100,000+, we will sample every 5 minutes (144 readings per shift)
    # 50 nurses * 15 shifts * 144 readings = 108,000 sensor records!
    # This matches the target size perfectly and fits a realistic temporal spacing.
    
    for i, nurse in enumerate(nurses):
        device = devices[i]
        
        # Schedule shifts every 2 days
        current_day = start_date
        while current_day < datetime.utcnow() + timedelta(days=7):
            # Nurse works on day if random holds, or every other day
            if (hash(nurse.id) + current_day.day) % 2 == 0:
                # 12-hour shift starting at 07:00 or 19:00
                is_night = (hash(nurse.id) + current_day.day) % 4 == 0
                start_hour = 19 if is_night else 7
                
                shift_start = current_day.replace(hour=start_hour, minute=0, second=0, microsecond=0)
                shift_end = shift_start + timedelta(hours=12)
                
                if shift_start > datetime.utcnow():
                    status = "Scheduled"
                    current_work_hours = 0.0
                elif shift_end < datetime.utcnow():
                    status = "Completed"
                    current_work_hours = 12.0
                else:
                    status = "Active"
                    current_work_hours = max(0.0, (datetime.utcnow() - shift_start).total_seconds() / 3600.0)

                shift = Shift(
                    nurse_id=nurse.id,
                    start_time=shift_start,
                    end_time=shift_end,
                    status=status,
                    current_work_hours=current_work_hours
                )
                shifts_to_add.append(shift)
                
                # Generate sensor readings during this shift
                # Sample interval: 5 minutes
                num_samples = 144
                
                # Baseline characteristics for the nurse (some naturally more stressed/fatigued)
                base_hr = random.uniform(65, 80)
                base_hrv = random.uniform(50, 90) # Higher is better
                base_gsr = random.uniform(2.0, 2.8) # 2.0-2.8V is relaxed, lower is sweating/stress
                base_temp = random.uniform(33.2, 33.8) # skin temp
                sleep_debt = random.uniform(0.5, 4.0) # sleep debt of nurse
                
                # Accumulate fatigue over the shift
                for step in range(num_samples):
                    sample_time = shift_start + timedelta(minutes=5 * step)
                    if sample_time > datetime.utcnow():
                        break
                        
                    fraction = step / float(num_samples) # 0 to 1
                    
                    # Heart rate increases slightly with fatigue and physical stress
                    hr = base_hr + (fraction * random.uniform(5, 15)) + random.uniform(-3, 3)
                    # HRV drops over shift as fatigue sets in
                    hrv = max(10.0, base_hrv - (fraction * random.uniform(20, 40)) + random.uniform(-5, 5))
                    # SpO2 remains normal generally (95-99%), random slight drops
                    spo2 = random.choice([98.0, 99.0, 97.0]) if random.random() > 0.05 else random.uniform(95.0, 96.5)
                    # GSR voltage drops over shift (sweating/stress increases)
                    gsr = max(0.3, base_gsr - (fraction * random.uniform(0.8, 1.5)) + random.uniform(-0.15, 0.15))
                    # Skin temperature drops slightly with exhaustion, or fluctuates
                    temp = base_temp + random.uniform(-0.4, 0.4)
                    
                    # Movement (MPU6050)
                    act_x = random.uniform(-0.5, 0.5) if fraction < 0.8 else random.uniform(-0.2, 0.2)
                    act_y = random.uniform(-0.5, 0.5) if fraction < 0.8 else random.uniform(-0.2, 0.2)
                    act_z = random.uniform(-0.8, 0.2) if fraction < 0.8 else random.uniform(-0.4, 0.1)
                    
                    record = SensorRecord(
                        device_id=device.id,
                        timestamp=sample_time,
                        heart_rate=round(hr, 1),
                        hrv=round(hrv, 1),
                        spo2=round(spo2, 1),
                        gsr_voltage=round(gsr, 2),
                        skin_temp=round(temp, 2),
                        activity_x=round(act_x, 3),
                        activity_y=round(act_y, 3),
                        activity_z=round(act_z, 3)
                    )
                    records_to_add.append(record)
                    record_count += 1
                    
                    # Compute fatigue and log it every 30 minutes (28 logs per shift)
                    if step % 6 == 0:
                        # Fast mathematical approximation of fatigue for seeding to avoid slow ML model calls
                        fatigue_score = round(min(100.0, max(0.0, 15.0 + (fraction * 45.0) + (sleep_debt * 3.5) + random.uniform(-5, 5))), 1)
                        
                        if fatigue_score <= 30:
                            risk_level = "Normal"
                        elif fatigue_score <= 60:
                            risk_level = "Moderate"
                        elif fatigue_score <= 80:
                            risk_level = "High"
                        else:
                            risk_level = "Critical"
                            
                        # Add temporal escalation of fatigue
                        hours_remaining = max(0.5, 12.0 - fraction * 12.0)
                        increase_rate_per_hour = 1.8 + (fatigue_score * 0.05)
                        
                        pred_2h = round(min(100.0, fatigue_score + (increase_rate_per_hour * 2)), 1)
                        pred_4h = round(min(100.0, fatigue_score + (increase_rate_per_hour * 4)), 1)
                        pred_end = round(min(100.0, fatigue_score + (increase_rate_per_hour * hours_remaining)), 1)
                        
                        f_log = FatigueLog(
                            nurse_id=nurse.id,
                            timestamp=sample_time,
                            fatigue_score=fatigue_score,
                            risk_level=risk_level,
                            predicted_2h=pred_2h,
                            predicted_4h=pred_4h,
                            predicted_end_shift=pred_end
                        )
                        fatigue_logs_to_add.append(f_log)
                        
                        # Update current nurse fatigue if this is the newest reading
                        if sample_time > nurse.last_seen:
                            nurse.current_fatigue = fatigue_score
                            nurse.last_seen = sample_time
                            
            current_day += timedelta(days=1)
            
    # Bulk save to SQLite to run fast
    db.add_all(shifts_to_add)
    db.commit()
    print(f"Shift history seeded: {len(shifts_to_add)} shifts")
    
    # Save sensor records in chunks to prevent memory blowup in sqlite
    chunk_size = 5000
    for j in range(0, len(records_to_add), chunk_size):
        db.bulk_save_objects(records_to_add[j:j+chunk_size])
        db.commit()
    print(f"Sensor records seeded: {len(records_to_add)} records")
    
    for j in range(0, len(fatigue_logs_to_add), chunk_size):
        db.bulk_save_objects(fatigue_logs_to_add[j:j+chunk_size])
        db.commit()
    print(f"Fatigue logs seeded: {len(fatigue_logs_to_add)} logs")

    # 4. Generate historical Alerts for high fatigue instances
    print("Generating fatigue alerts history...")
    alerts_to_add = []
    # Query database for logs with fatigue_score > 75
    critical_logs = [log for log in fatigue_logs_to_add if log.fatigue_score > 75]
    
    # Sample up to 100 historical alerts
    sampled_logs = random.sample(critical_logs, min(len(critical_logs), 100))
    for log in sampled_logs:
        alert_type = "Critical" if log.fatigue_score > 90 else "High"
        alert = Alert(
            nurse_id=log.nurse_id,
            alert_type=alert_type,
            fatigue_score=log.fatigue_score,
            timestamp=log.timestamp,
            status="Resolved",
            resolved=True,
            description=f"Automated notification dispatched. Nurse fatigued during shift. Roster optimization recommended."
        )
        alerts_to_add.append(alert)
        
    db.add_all(alerts_to_add)
    db.commit()
    print(f"Alert logs seeded: {len(alerts_to_add)} alerts")

    # 5. Ensure each nurse has a different, unique current_fatigue score
    print("Assigning unique fatigue scores to all nurses...")
    all_nurses = db.query(Nurse).all()
    # Force 5 active nurses to have very low fatigue scores around 9.0 (9.1 to 9.5)
    low_fatigue_scores = [9.1, 9.2, 9.3, 9.4, 9.5]
    # Generate the remaining unique fatigue scores starting from 15.0
    unique_scores = [round(15.0 + i * 0.75, 1) for i in range(len(all_nurses) - 5)]
    random.shuffle(unique_scores)
    # Combine scores
    final_scores = low_fatigue_scores + unique_scores
    for idx, nurse in enumerate(all_nurses):
        nurse.current_fatigue = final_scores[idx]
    db.commit()
    print("All nurses successfully assigned distinct fatigue scores (including 5 low fatigue scores around 9.0).")
    print("Database seeding completed successfully.")

def generate_live_reading(nurse_name: str, shift_hours_worked: float) -> dict:
    """Generates a dynamic live physiological reading based on nurse identity and shift duration."""
    random.seed(datetime.utcnow().timestamp())
    
    # Base characteristics determined by string hashing for consistency per nurse
    h = hash(nurse_name)
    base_hr = 62.0 + (abs(h) % 15) # 62 - 77 bpm
    base_hrv = 45.0 + (abs(h) % 50) # 45 - 95 ms
    base_gsr = 1.8 + ((abs(h) % 10) / 10.0) # 1.8 - 2.8V
    base_temp = 33.1 + ((abs(h) % 8) / 10.0) # 33.1 - 33.9C
    sleep_debt = 0.5 + ((abs(h) % 35) / 10.0) # 0.5 - 4.0 hours
    
    fraction = min(1.0, shift_hours_worked / 12.0)
    
    # Live sensor drift mimicking physical exertion
    hr = base_hr + (fraction * random.uniform(8, 22)) + random.uniform(-2, 2)
    hrv = max(12.0, base_hrv - (fraction * random.uniform(25, 45)) + random.uniform(-4, 4))
    spo2 = random.choice([98.0, 99.0, 97.0]) if random.random() > 0.05 else random.uniform(94.5, 96.5)
    gsr = max(0.2, base_gsr - (fraction * random.uniform(0.9, 1.7)) + random.uniform(-0.1, 0.1))
    temp = base_temp + random.uniform(-0.3, 0.3)
    
    # Accelerometer readings
    act_x = random.uniform(-0.4, 0.4) if fraction < 0.85 else random.uniform(-0.15, 0.15)
    act_y = random.uniform(-0.4, 0.4) if fraction < 0.85 else random.uniform(-0.15, 0.15)
    act_z = random.uniform(-0.6, 0.1) if fraction < 0.85 else random.uniform(-0.3, 0.0)
    
    return {
        "heart_rate": round(hr, 1),
        "hrv": round(hrv, 1),
        "spo2": round(spo2, 1),
        "gsr_voltage": round(gsr, 2),
        "skin_temp": round(temp, 2),
        "activity_x": round(act_x, 3),
        "activity_y": round(act_y, 3),
        "activity_z": round(act_z, 3),
        "sleep_hours": round(8.0 - sleep_debt, 1)
    }
