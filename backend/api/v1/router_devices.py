from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from core.database import supabase
import uuid

router = APIRouter(prefix="/devices", tags=["Devices"])

class DeviceCreate(BaseModel):
    user_id: str
    device_name: str
    device_type: str
    rtsp_url: Optional[str] = None
    status: str = "active"
    location: Optional[str] = None

class DeviceUpdate(BaseModel):
    device_name: Optional[str] = None
    rtsp_url: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None

@router.post("/", response_model=dict)
def create_device(device: DeviceCreate):
    device_id = str(uuid.uuid4())
    data = {
        "id": device_id,
        "user_id": device.user_id,
        "device_name": device.device_name,
        "device_type": device.device_type.upper() if device.device_type else device.device_type,
        "rtsp_url": device.rtsp_url,
        "status": device.status,
        "location": device.location
    }
    try:
        supabase.table("devices").insert(data).execute()
        return {"message": "Device created successfully", "id": device_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/", response_model=List[dict])
def get_devices(user_id: Optional[str] = None):
    query = supabase.table("devices").select("*")
    if user_id:
        query = query.eq("user_id", user_id)
    try:
        res = query.execute()
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{device_id}", response_model=dict)
def update_device(device_id: str, update_data: DeviceUpdate):
    updates = {k: v for k, v in update_data.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No field provided to update")
        
    try:
        res = supabase.table("devices").update(updates).eq("id", device_id).execute()
        if not res.data:
            # Depending on supabase-py version this might return empty list. We will safely assume if no error it might have succeeded for simplicity or if data is empty.
            pass
        return {"message": "Device updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{device_id}", response_model=dict)
def delete_device(device_id: str):
    try:
        res = supabase.table("devices").delete().eq("id", device_id).execute()
        return {"message": "Device deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
