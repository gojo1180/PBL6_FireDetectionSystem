from fastapi import APIRouter, HTTPException
from typing import List, Optional
import uuid
from datetime import datetime

from core.database import supabase
from schemas.models import SensorLogCreate, SensorLogResponse

router = APIRouter(tags=["Sensors"])

@router.get("/sensors", response_model=List[dict])
def get_sensor_data(limit: int = 50):
    """Fetch the latest sensor logs ordered by time."""
    response = supabase.table("sensor_logs").select("*").order("recorded_at", desc=True).limit(limit).execute()
    return response.data

@router.get("/sensors/latest", response_model=Optional[dict])
def get_latest_sensor_data():
    """Fetch only the single latest sensor log."""
    response = supabase.table("sensor_logs").select("*").order("recorded_at", desc=True).limit(1).execute()
    data = response.data
    if data:
        return data[0]
    return None

@router.post("/sensors")
def add_sensor_data(sensor: SensorLogCreate):
    """Insert new sensor data."""
    # Convert Pydantic model to dictionary
    data = sensor.model_dump()
    data["id"] = str(uuid.uuid4())
    data["device_id"] = str(data["device_id"])
    data["recorded_at"] = datetime.utcnow().isoformat()
    
    response = supabase.table("sensor_logs").insert(data).execute()
    return {"message": "Sensor data inserted successfully", "data": response.data}
