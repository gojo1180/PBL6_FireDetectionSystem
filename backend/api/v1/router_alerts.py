from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import List
import uuid
import os
import requests
from datetime import datetime

from core.database import supabase
from core.security import get_current_user
from core.config import settings
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

class FeedbackUpdate(BaseModel):
    is_false_positive: bool

@router.patch("/alerts/{alert_id}/feedback")
async def provide_feedback(alert_id: str, feedback: FeedbackUpdate):
    """Provide feedback on whether an alert is a false positive."""
    response = (
        supabase.table("fusion_alerts")
        .update({"is_false_positive": feedback.is_false_positive})
        .eq("id", alert_id)
        .execute()
    )
    
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Alert ID tidak ditemukan di database"
        )
        
    # MLOps Trigger Logic
    if feedback.is_false_positive:
        device_id = response.data[0].get("device_id")
        
        if device_id:
            # Hitung jumlah total false positive untuk device ini
            count_res = supabase.table("fusion_alerts").select("id").eq("device_id", device_id).eq("is_false_positive", True).execute()
            jumlah_fp = len(count_res.data)
            
            print(f"🔄 Device {device_id} memiliki {jumlah_fp} False Positive terdaftar.")
            
            # Jika kelipatan 3, trigger GitHub Actions
            if jumlah_fp > 0 and jumlah_fp % 3 == 0:
                print("🚀 Memicu GitHub Actions untuk Continuous Training...")
                
                github_token = settings.GITHUB_PAT
                owner = settings.GITHUB_OWNER
                repo = settings.GITHUB_REPO
                
                if github_token:
                    url = f"https://api.github.com/repos/{owner}/{repo}/actions/workflows/retrain.yml/dispatches"
                    headers = {
                        "Accept": "application/vnd.github.v3+json",
                        "Authorization": f"token {github_token}"
                    }
                    payload = {
                        "ref": "eksperimental",
                        "inputs": {"device_id": str(device_id)}
                    }
                    
                    try:
                        gh_response = requests.post(url, headers=headers, json=payload)
                        if gh_response.status_code == 204:
                            print("✅ Berhasil men-trigger MLOps pipeline di GitHub Actions!")
                        else:
                            print(f"❌ Gagal trigger GitHub Actions: {gh_response.text}")
                    except Exception as e:
                        print(f"❌ Error saat memanggil GitHub API: {e}")
                else:
                    print("⚠️ GITHUB_PAT belum di-set di environment variables, MLOps tidak di-trigger.")

    return {"message": "Feedback recorded", "data": response.data}
