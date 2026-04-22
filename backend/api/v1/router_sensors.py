from fastapi import APIRouter, Depends
from typing import List, Optional
import uuid
from datetime import datetime

from core.database import supabase
from core.security import get_current_user
from schemas.models import SensorLogCreate
from services.fusion_engine import fusion_service

router = APIRouter(tags=["Sensors"])

@router.get("/sensors", response_model=List[dict])
def get_sensor_data(limit: int = 50, device_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Fetch the latest sensor logs ordered by time. Optionally filter by device_id."""
    query = supabase.table("sensor_logs").select("*")
    if device_id:
        query = query.eq("device_id", device_id)
    response = query.order("recorded_at", desc=True).limit(limit).execute()
    return response.data

@router.get("/sensors/latest", response_model=Optional[dict])
def get_latest_sensor_data(current_user: dict = Depends(get_current_user)):
    """Fetch only the single latest sensor log."""
    response = supabase.table("sensor_logs").select("*").order("recorded_at", desc=True).limit(1).execute()
    data = response.data
    if data:
        return data[0]
    return None

@router.get("/sensors/latest/{device_id}", response_model=Optional[dict])
def get_latest_sensor_by_device(device_id: str, current_user: dict = Depends(get_current_user)):
    """Fetch only the single most recent sensor log for a specific device."""
    response = (
        supabase.table("sensor_logs")
        .select("*")
        .eq("device_id", device_id)
        .order("recorded_at", desc=True)
        .limit(1)
        .execute()
    )
    data = response.data
    if data:
        return data[0]
    return None

@router.post("/sensors")
def add_sensor_data(sensor: SensorLogCreate):
    """Insert new sensor data and check late fusion alert."""
    # Convert Pydantic model to dictionary
    data = sensor.model_dump()
    device_id = str(data["device_id"])
    data["id"] = str(uuid.uuid4())
    data["device_id"] = device_id
    data["recorded_at"] = datetime.utcnow().isoformat()
    
    # Process with Isolation Forest and update state
    is_anomaly = fusion_service.process_sensor_data(data)
    alert_level = fusion_service.update_sensor(is_anomaly)
    
    # Insert sensor log
    response = supabase.table("sensor_logs").insert(data).execute()
    
    # Insert or update alert if risk is elevated
    if alert_level in ['SENSOR_ALERT', 'FIRE_DANGER']:
        active_alerts = supabase.table("fusion_alerts").select("id").eq("is_resolved", False).eq("device_id", device_id).execute()
        
        alert_data = {
            "risk_level": "DANGER" if alert_level == "FIRE_DANGER" else "WARNING",
            "fusion_score": 1.0, # Dummy score for sensor
            "alert_message": f"System Alert: {alert_level.replace('_', ' ')}",
        }
        
        if active_alerts.data and len(active_alerts.data) > 0:
            alert_id = active_alerts.data[0]["id"]
            supabase.table("fusion_alerts").update(alert_data).eq("id", alert_id).execute()
            print(f"⚠️ Fusion Alert Updated via HTTP: {alert_level}")
        else:
            alert_data["id"] = str(uuid.uuid4())
            alert_data["device_id"] = device_id
            alert_data["is_resolved"] = False
            alert_data["triggered_at"] = datetime.utcnow().isoformat()
            supabase.table("fusion_alerts").insert(alert_data).execute()
            print(f"⚠️ Fusion Alert Triggered via HTTP: {alert_level}")
            
    return {"message": "Sensor data processed successfully", "data": response.data}
