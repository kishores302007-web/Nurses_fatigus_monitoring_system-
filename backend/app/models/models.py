import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Boolean, Integer, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    role = Column(String(50), default="supervisor")  # admin, supervisor
    is_active = Column(Boolean, default=True)
    name = Column(String(100), nullable=True)
    email = Column(String(100), nullable=True)
    phone_number = Column(String(20), nullable=True)

class Nurse(Base):
    __tablename__ = "nurses"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nurse_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. NS-001
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    department = Column(String(50), nullable=False) # ICU, Emergency, Cardiology, General Ward
    skill_category = Column(String(50), nullable=False) # Critical Care, ER Specialist, General
    status = Column(String(30), default="Offline") # Active, Break, Offline
    current_fatigue = Column(Float, default=0.0)
    max_shift_hours = Column(Float, default=12.0)
    last_seen = Column(DateTime, default=datetime.utcnow)

    device = relationship("Device", back_populates="assigned_nurse", uselist=False)
    fatigue_logs = relationship("FatigueLog", back_populates="nurse")
    shifts = relationship("Shift", back_populates="nurse")
    alerts = relationship("Alert", back_populates="nurse")

class Device(Base):
    __tablename__ = "devices"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    mac_address = Column(String(50), unique=True, index=True, nullable=False)
    status = Column(String(30), default="Inactive") # Active, Inactive, Disconnected
    assigned_nurse_id = Column(String(36), ForeignKey("nurses.id"), nullable=True)
    last_seen = Column(DateTime, default=datetime.utcnow)

    assigned_nurse = relationship("Nurse", back_populates="device")
    sensor_records = relationship("SensorRecord", back_populates="device")

class SensorRecord(Base):
    __tablename__ = "sensor_records"
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String(36), ForeignKey("devices.id"), nullable=False)
    timestamp = Column(DateTime, index=True, default=datetime.utcnow)
    
    # MAX30102
    heart_rate = Column(Float, nullable=False)
    hrv = Column(Float, nullable=False)
    spo2 = Column(Float, nullable=False)
    
    # GSR
    gsr_voltage = Column(Float, nullable=False) # raw stress reading
    
    # MLX90614
    skin_temp = Column(Float, nullable=False)
    
    # MPU6050
    activity_x = Column(Float, nullable=False)
    activity_y = Column(Float, nullable=False)
    activity_z = Column(Float, nullable=False)

    device = relationship("Device", back_populates="sensor_records")

class FatigueLog(Base):
    __tablename__ = "fatigue_logs"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nurse_id = Column(String(36), ForeignKey("nurses.id"), nullable=False)
    timestamp = Column(DateTime, index=True, default=datetime.utcnow)
    fatigue_score = Column(Float, nullable=False)
    risk_level = Column(String(30), nullable=False) # Normal, Moderate, High, Critical
    
    # Projections
    predicted_2h = Column(Float, nullable=False)
    predicted_4h = Column(Float, nullable=False)
    predicted_end_shift = Column(Float, nullable=False)

    nurse = relationship("Nurse", back_populates="fatigue_logs")

class Shift(Base):
    __tablename__ = "shifts"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nurse_id = Column(String(36), ForeignKey("nurses.id"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(String(30), default="Scheduled") # Scheduled, Active, Completed, Replaced
    current_work_hours = Column(Float, default=0.0)

    nurse = relationship("Nurse", back_populates="shifts")
    replacements = relationship("ReplacementLog", back_populates="shift")

class ReplacementLog(Base):
    __tablename__ = "replacement_logs"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    original_nurse_id = Column(String(36), ForeignKey("nurses.id"), nullable=False)
    replacement_nurse_id = Column(String(36), ForeignKey("nurses.id"), nullable=False)
    shift_id = Column(String(36), ForeignKey("shifts.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String(30), default="Pending") # Pending, Accepted, Declined
    justification = Column(Text, nullable=True)

    shift = relationship("Shift", back_populates="replacements")
    original_nurse = relationship("Nurse", foreign_keys=[original_nurse_id])
    replacement_nurse = relationship("Nurse", foreign_keys=[replacement_nurse_id])

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nurse_id = Column(String(36), ForeignKey("nurses.id"), nullable=False)
    alert_type = Column(String(20), nullable=False) # Low, High, Critical
    fatigue_score = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    status = Column(String(30), default="Active") # Active, Dispatched, Resolved
    resolved = Column(Boolean, default=False)
    description = Column(String(200), nullable=True)

    nurse = relationship("Nurse", back_populates="alerts")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    details = Column(Text, nullable=True)
