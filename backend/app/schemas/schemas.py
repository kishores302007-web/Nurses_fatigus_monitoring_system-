from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    email: EmailStr
    phone_number: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True

class DeviceResponse(BaseModel):
    id: str
    mac_address: str
    status: str
    assigned_nurse_id: Optional[str] = None
    last_seen: datetime

    class Config:
        from_attributes = True

class NurseResponse(BaseModel):
    id: str
    nurse_id: str
    name: str
    email: EmailStr
    department: str
    skill_category: str
    status: str
    current_fatigue: float
    max_shift_hours: float
    last_seen: datetime
    device: Optional[DeviceResponse] = None

    class Config:
        from_attributes = True

class NurseCreate(BaseModel):
    nurse_id: str
    name: str
    email: EmailStr
    department: str
    skill_category: str
    max_shift_hours: float = 12.0

class SensorRecordCreate(BaseModel):
    mac_address: str
    heart_rate: float
    hrv: float
    spo2: float
    gsr_voltage: float
    skin_temp: float
    activity_x: float
    activity_y: float
    activity_z: float

class SensorRecordResponse(BaseModel):
    id: int
    device_id: str
    timestamp: datetime
    heart_rate: float
    hrv: float
    spo2: float
    gsr_voltage: float
    skin_temp: float
    activity_x: float
    activity_y: float
    activity_z: float

    class Config:
        from_attributes = True

class FatigueLogResponse(BaseModel):
    id: str
    nurse_id: str
    timestamp: datetime
    fatigue_score: float
    risk_level: str
    predicted_2h: float
    predicted_4h: float
    predicted_end_shift: float

    class Config:
        from_attributes = True

class ShiftResponse(BaseModel):
    id: str
    nurse_id: str
    start_time: datetime
    end_time: datetime
    status: str
    current_work_hours: float
    nurse: Optional[NurseResponse] = None

    class Config:
        from_attributes = True

class ReplacementResponse(BaseModel):
    id: str
    original_nurse_id: str
    replacement_nurse_id: str
    shift_id: str
    timestamp: datetime
    status: str
    justification: Optional[str] = None
    original_nurse: Optional[NurseResponse] = None
    replacement_nurse: Optional[NurseResponse] = None

    class Config:
        from_attributes = True

class ReplacementCreate(BaseModel):
    original_nurse_id: str
    replacement_nurse_id: str
    shift_id: str
    justification: str

class AlertResponse(BaseModel):
    id: str
    nurse_id: str
    alert_type: str
    fatigue_score: float
    timestamp: datetime
    status: str
    resolved: bool
    description: Optional[str] = None
    nurse: Optional[NurseResponse] = None

    class Config:
        from_attributes = True

class AlertUpdate(BaseModel):
    resolved: bool
    status: str

class RAGQuery(BaseModel):
    query: str

class RAGResponse(BaseModel):
    answer: str
    sources: List[str]

class ShiftAllot(BaseModel):
    nurse_id: str
    department: str
    shift_type: str
    duration_hours: float

