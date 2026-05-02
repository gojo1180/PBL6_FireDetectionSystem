from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

# ==========================================
# USERS SCHEMA
# SQL: users (id UUID PRIMARY KEY, email VARCHAR, full_name VARCHAR, role VARCHAR, created_at TIMESTAMP)
# ==========================================
class UserBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    role: str = Field(default="user")

class UserCreate(UserBase):
    pass

class UserResponse(UserBase):
    id: UUID
    created_at: datetime
    
    model_config = {"from_attributes": True}

# ==========================================
# DEVICES SCHEMA
# SQL: devices (id UUID PRIMARY KEY, name VARCHAR, location TEXT, status VARCHAR, created_at TIMESTAMP)
# ==========================================
class DeviceBase(BaseModel):
    name: str
    location: Optional[str] = None
    status: str = Field(default="active")

class DeviceCreate(DeviceBase):
    pass

class DeviceResponse(DeviceBase):
    id: UUID
    created_at: datetime
    
    model_config = {"from_attributes": True}

# ==========================================
# SENSOR LOGS SCHEMA
# SQL: sensor_logs (id UUID, device_id UUID, cng_level FLOAT, co_level FLOAT, lpg_level FLOAT, flame_detected BOOLEAN, smoke_detected BOOLEAN, recorded_at TIMESTAMP)
# ==========================================
class SensorLogBase(BaseModel):
    device_id: UUID
    cng_level: float
    co_level: float
    lpg_level: float
    smoke_detected: float 
    flame_detected: float  

class SensorLogCreate(SensorLogBase):
    pass

class SensorLogResponse(SensorLogBase):
    id: UUID
    recorded_at: datetime
    
    model_config = {"from_attributes": True}

# ==========================================
# VISION LOGS SCHEMA
# SQL: vision_logs (id UUID, device_id UUID, fire_confidence FLOAT, smoke_confidence FLOAT, image_url TEXT, recorded_at TIMESTAMP)
# ==========================================
class VisionLogBase(BaseModel):
    device_id: UUID
    fire_confidence: float
    smoke_confidence: float
    image_url: Optional[str] = None

class VisionLogCreate(VisionLogBase):
    pass

class VisionLogResponse(VisionLogBase):
    id: UUID
    recorded_at: datetime
    
    model_config = {"from_attributes": True}

# ==========================================
# FUSION ALERTS SCHEMA
# SQL: fusion_alerts (id UUID, device_id UUID, risk_level VARCHAR, fusion_score FLOAT, alert_message TEXT, is_resolved BOOLEAN, triggered_at TIMESTAMP)
# ==========================================
class FusionAlertBase(BaseModel):
    device_id: UUID
    risk_level: str
    fusion_score: float
    alert_message: str
    is_resolved: bool = Field(default=False)
    is_false_positive: Optional[bool] = Field(default=None)

class FusionAlertCreate(FusionAlertBase):
    pass

class FusionAlertResponse(FusionAlertBase):
    id: UUID
    triggered_at: datetime
    
    model_config = {"from_attributes": True}

# ==========================================
# NEWS SUMMARIES SCHEMA
# SQL: news_summaries (id UUID, source_url TEXT, title VARCHAR, original_text TEXT, summary_text TEXT, processed_at TIMESTAMP)
# ==========================================
class NewsSummaryBase(BaseModel):
    source_url: str
    title: str
    original_text: str
    summary_text: str

class NewsSummaryCreate(NewsSummaryBase):
    pass

class NewsSummaryResponse(NewsSummaryBase):
    id: UUID
    processed_at: datetime
    
    model_config = {"from_attributes": True}
