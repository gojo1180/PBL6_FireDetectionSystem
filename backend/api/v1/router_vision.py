from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from typing import List, Optional
import uuid
from datetime import datetime

from services.fusion_engine import fusion_service
from core.database import supabase
from schemas.models import VisionLogCreate

router = APIRouter(tags=["Vision"])

@router.get("/vision", response_model=List[dict])
def get_vision_logs(limit: int = 50):
    """Fetch the latest vision logs from Supabase."""
    response = supabase.table("vision_logs").select("*").order("recorded_at", desc=True).limit(limit).execute()
    return response.data

@router.get("/vision/latest", response_model=Optional[dict])
def get_latest_vision_log():
    """Fetch the single most recent vision log."""
    response = supabase.table("vision_logs").select("*").order("recorded_at", desc=True).limit(1).execute()
    data = response.data
    if data:
        return data[0]
    return None

@router.post("/vision")
def add_vision_log(vision_log: VisionLogCreate):
    """Insert new vision log data."""
    data = vision_log.model_dump()
    data["id"] = str(uuid.uuid4())
    data["device_id"] = str(data["device_id"])
    data["recorded_at"] = datetime.utcnow().isoformat()
    
    response = supabase.table("vision_logs").insert(data).execute()
    return {"message": "Vision log inserted successfully", "data": response.data}


@router.post("/vision/upload-frame/")
async def upload_frame(
    file: UploadFile = File(...),
    device_id: str = Form(default="00000000-0000-0000-0000-000000000000") # Required for DB relation
):
    # Read the file bytes directly
    image_bytes = await file.read()
    
    # Pass it to our late fusion engine to process the computer vision side
    vision_results = fusion_service.process_vision_data(image_bytes)
    
    # Print the result to the console for testing purposes
    print(f"Vision Processing Result: {vision_results}")
    
    # ONLY save to database if FIRE is detected (confidence > 0)
    # Allows saving storage instead of saving every single clean frame
    fire_conf = vision_results.get("fire_confidence", 0.0)
    smoke_conf = vision_results.get("smoke_confidence", 0.0)
    
    saved_to_db = False
    if fire_conf > 0.0:
        log_data = {
            "id": str(uuid.uuid4()),
            "device_id": device_id,
            "fire_confidence": fire_conf,
            "smoke_confidence": smoke_conf,
            # We skip image_url upload here for now unless implemented
            "image_url": None, 
            "recorded_at": datetime.utcnow().isoformat()
        }
        supabase.table("vision_logs").insert(log_data).execute()
        saved_to_db = True
        print("🔥 Fire detected! Saving vision log to database.")
    
    # Return the confidence scores
    return {"filename": file.filename, "scores": vision_results, "saved_to_db": saved_to_db}
