import cv2
import threading
import uuid
from datetime import datetime

from core.config import settings
from core.database import supabase
from services.fusion_engine import fusion_service

# To control the background thread gracefully
cctv_stop_event = threading.Event()
cctv_thread = None

# We use a default Device ID for the CCTV device
CCTV_DEVICE_ID = "00000000-0000-0000-0000-000000000000"

def _reconnect_camera():
    while not cctv_stop_event.is_set():
        url = settings.CCTV_RTSP_URL
        if not url:
            print("CCTV_RTSP_URL is not set. CCTV loop will exit.")
            break
            
        print(f"📷 Attempting to connect to RTSP: {url}")
        cap = cv2.VideoCapture(url)
        if cap.isOpened():
            print("✅ Successfully connected to CCTV RTSP stream.")
            return cap
            
        print("❌ Failed to connect to RTSP stream. Retrying in 5 seconds...")
        cctv_stop_event.wait(5.0)

    return None

def cctv_loop():
    url = settings.CCTV_RTSP_URL
    if not url:
        print("CCTV processing skipped because CCTV_RTSP_URL is not configured.")
        return

    cap = _reconnect_camera()

    while not cctv_stop_event.is_set():
        # Check connection status
        if cap is None or not cap.isOpened():
            if cap is not None:
                cap.release()
            cap = _reconnect_camera()
            if cap is None or cctv_stop_event.is_set():
                break

        ret, frame = cap.read()
        if not ret:
            print("⚠️ Failed to grab frame from CCTV. Reconnecting...")
            cap.release()
            continue

        # Convert frame from BGR to RGB (CRITICAL FIX for YOLOv8)
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Process frames through late fusion model directly using the RGB numpy array
        vision_results = fusion_service.process_vision_data(frame_rgb)
            
        fire_conf = vision_results.get("fire_confidence", 0.0)
        smoke_conf = vision_results.get("smoke_confidence", 0.0)
        
        if fire_conf > 0.0 or smoke_conf > 0.0:
            print(f"🔥 Threat detected via CCTV! Fire: {fire_conf:.2f}, Smoke: {smoke_conf:.2f}")
            
            # Insert into vision_logs
            log_data = {
                "id": str(uuid.uuid4()),
                "device_id": CCTV_DEVICE_ID,
                "fire_confidence": float(fire_conf),
                "smoke_confidence": float(smoke_conf),
                "image_url": None, 
                "recorded_at": datetime.utcnow().isoformat()
            }
            
            risk_level = "DANGER" if fire_conf > 0.5 else "WARNING"
            # Create Alert
            alert_data = {
                "id": str(uuid.uuid4()),
                "device_id": CCTV_DEVICE_ID,
                "risk_level": risk_level,
                "fusion_score": max(float(fire_conf), float(smoke_conf)),
                "alert_message": "Fire/Smoke detected by CCTV camera via RTSP stream.",
                "is_resolved": False,
                "triggered_at": datetime.utcnow().isoformat()
            }
            
            try:
                supabase.table("vision_logs").insert(log_data).execute()
                supabase.table("fusion_alerts").insert(alert_data).execute()
                print("✅ Saved CCTV threat detection to Supabase (vision_logs & fusion_alerts).")
            except Exception as e:
                print(f"❌ Error saving CCTV alert to DB: {e}")
                
        cctv_stop_event.wait(1.5)

    if cap and cap.isOpened():
        cap.release()
    print("🛑 CCTV background thread gracefully shut down.")

def start_cctv_service():
    global cctv_thread
    if not settings.CCTV_RTSP_URL:
        print("⚠️ CCTV_RTSP_URL not present in config, skipping CCTV background service.")
        return
        
    print("🚀 Starting CCTV Background Service...")
    cctv_stop_event.clear()
    cctv_thread = threading.Thread(target=cctv_loop, daemon=True)
    cctv_thread.start()

def stop_cctv_service():
    print("🛑 Stopping CCTV Background Service...")
    cctv_stop_event.set()
    if cctv_thread and cctv_thread.is_alive():
        cctv_thread.join(timeout=3.0)
