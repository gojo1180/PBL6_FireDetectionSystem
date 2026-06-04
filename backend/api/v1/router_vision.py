from fastapi import APIRouter, File, UploadFile, Form, Depends
from fastapi.responses import StreamingResponse
from typing import List, Optional
import uuid
import asyncio
from datetime import datetime
from pydantic import BaseModel
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
import av

from services.fusion_engine import fusion_service
from services.vision_service import get_latest_frame_jpg, get_latest_frame_bgr
from core.database import supabase
from core.security import get_current_user
from schemas.models import VisionLogCreate

router = APIRouter(tags=["Vision"])

async def mjpeg_generator():
    while True:
        frame_bytes = get_latest_frame_jpg()
        if frame_bytes:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            
            # Memory Optimization: explicitly destroy JPEG byte chunk from RAM
            del frame_bytes
            
        # Rate limit to ~30 FPS to match camera framerate
        await asyncio.sleep(0.033)

@router.get("/vision/stream")
async def stream_cctv():
    """Stream the latest CCTV frame as MJPEG."""
    return StreamingResponse(mjpeg_generator(), media_type="multipart/x-mixed-replace; boundary=frame")


@router.get("/vision", response_model=List[dict])
def get_vision_logs(limit: int = 50, current_user: dict = Depends(get_current_user)):
    """Fetch the latest vision logs from Supabase belonging to the current user's devices."""
    devices_res = supabase.table("devices").select("id").eq("user_id", current_user["user_id"]).execute()
    device_ids = [d["id"] for d in devices_res.data]
    if not device_ids:
        return []
    response = (
        supabase.table("vision_logs")
        .select("*")
        .in_("device_id", device_ids)
        .order("recorded_at", desc=True)
        .limit(limit)
        .execute()
    )
    return response.data

@router.get("/vision/latest", response_model=Optional[dict])
def get_latest_vision_log(current_user: dict = Depends(get_current_user)):
    """Fetch the single most recent vision log belonging to the current user's devices."""
    devices_res = supabase.table("devices").select("id").eq("user_id", current_user["user_id"]).execute()
    device_ids = [d["id"] for d in devices_res.data]
    if not device_ids:
        return None
    response = (
        supabase.table("vision_logs")
        .select("*")
        .in_("device_id", device_ids)
        .order("recorded_at", desc=True)
        .limit(1)
        .execute()
    )
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
    
    # Memory Optimization: explicitly clear raw uploaded bytes to free HTTP payload
    del image_bytes
    
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


# ==========================================
# WebRTC Signaling & Streaming
# ==========================================

class WebRTCOffer(BaseModel):
    sdp: str
    type: str
    device_id: Optional[str] = None

class OpenCVStreamTrack(VideoStreamTrack):
    """
    Sebuah video stream track aiortc yang mengambil frame dari OpenCV.
    Berfungsi mengubah NumPy BGR array menjadi `av.VideoFrame` secara real-time.
    """
    def __init__(self):
        super().__init__()  # Penting untuk inisialisasi VideoStreamTrack!

    async def recv(self):
        # next_timestamp akan mengatur sinkronisasi waktu FPS WebRTC
        pts, time_base = await self.next_timestamp()
        
        # Mengambil frame BGR (NumPy array) dari vision_service
        frame_bgr = get_latest_frame_bgr()
        
        if frame_bgr is None:
            # Jika belum ada frame (kamera offline / baru nyala), delay sedikit & beri blank frame
            await asyncio.sleep(0.05)
            import numpy as np
            frame_bgr = np.zeros((480, 640, 3), dtype=np.uint8)
            
        # Konversi BGR OpenCV ke format yang dimengerti oleh av
        new_frame = av.VideoFrame.from_ndarray(frame_bgr, format="bgr24")
        new_frame.pts = pts
        new_frame.time_base = time_base
        
        # Hapus reference numpy array untuk mengoptimalkan memori / GC
        del frame_bgr
        
        return new_frame

# Global set untuk melacak peer connections yang sedang aktif
pcs = set()

@router.post("/vision/webrtc/offer")
async def webrtc_offer(offer: WebRTCOffer):
    """
    Endpoint untuk WebRTC signaling.
    Menerima SDP offer dari frontend, memasang OpenCVStreamTrack, dan membalas dengan SDP answer.
    """
    # Switch the background vision service to monitor this specific user's device
    if offer.device_id:
        from services.vision_service import set_active_cctv
        set_active_cctv(offer.device_id)

    pc = RTCPeerConnection()
    pcs.add(pc)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        print(f"📡 WebRTC Connection State: {pc.connectionState}")
        if pc.connectionState in ["failed", "closed"]:
            pcs.discard(pc)

    # Memasukkan custom track ke dalam peer connection
    pc.addTrack(OpenCVStreamTrack())

    # Konfigurasi remote description (dari request frontend)
    offer_obj = RTCSessionDescription(sdp=offer.sdp, type=offer.type)
    await pc.setRemoteDescription(offer_obj)

    # Membuat local description (Answer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    # Mengembalikan response ke frontend dalam bentuk JSON
    return {
        "sdp": pc.localDescription.sdp,
        "type": pc.localDescription.type
    }

class RetryRequest(BaseModel):
    device_id: Optional[str] = None

@router.post("/vision/rtsp/retry")
def retry_rtsp_connection(req: RetryRequest):
    """
    Endpoint untuk me-restart koneksi RTSP secara manual dari frontend.
    """
    if req.device_id:
        from services.vision_service import set_active_cctv
        set_active_cctv(req.device_id)
    else:
        from services.vision_service import force_reconnect
        force_reconnect()
        
    return {"message": "Manual RTSP reconnect triggered."}
