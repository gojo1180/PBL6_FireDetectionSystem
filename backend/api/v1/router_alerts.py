from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
import uuid
from datetime import datetime

from core.database import supabase
from core.security import get_current_user
from schemas.models import FusionAlertCreate

router = APIRouter(tags=["Alerts"])

@router.get("/alerts", response_model=List[dict])
def get_fusion_alerts(limit: int = 50, current_user: dict = Depends(get_current_user)):
    """Fetch all history of alerts."""
    response = supabase.table("fusion_alerts").select("*").order("triggered_at", desc=True).limit(limit).execute()
    return response.data

@router.get("/alerts/active", response_model=List[dict])
def get_active_alerts(current_user: dict = Depends(get_current_user)):
    """Fetch only unresolved active alerts."""
    response = supabase.table("fusion_alerts").select("*").eq("is_resolved", False).order("triggered_at", desc=True).execute()
    return response.data

@router.post("/alerts")
def create_fusion_alert(alert: FusionAlertCreate):
    """Create a new fusion alert."""
    data = alert.model_dump()
    data["id"] = str(uuid.uuid4())
    data["device_id"] = str(data["device_id"])
    data["triggered_at"] = datetime.utcnow().isoformat()
    
    response = supabase.table("fusion_alerts").insert(data).execute()
    return {"message": "Alert created successfully", "data": response.data}

@router.put("/alerts/{alert_id}/resolve")
@router.patch("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    # Logika: Mengubah status, bukan menghapus data (sesuai permintaanmu)
    response = (
        supabase.table("fusion_alerts")
        .update({"is_resolved": True})
        .eq("id", alert_id)
        .execute()
    )
    
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Alert ID tidak ditemukan di database"
        )
        
    return {"message": "Alert berhasil diselesaikan", "data": response.data}
