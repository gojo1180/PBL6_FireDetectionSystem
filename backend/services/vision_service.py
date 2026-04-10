import cv2
import threading
import uuid
import time
from datetime import datetime

from core.config import settings
from core.database import supabase
from services.fusion_engine import fusion_service

# To control the background thread gracefully
cctv_stop_event = threading.Event()
frame_reader_thread = None
inference_thread = None

# We use a default Device ID for the CCTV device
CCTV_DEVICE_ID = "c00c732b-ef0b-4eac-b06c-663417b87ad2"

latest_frame = None
frame_lock = threading.Lock()

def _reconnect_camera():
    while not cctv_stop_event.is_set():
        url = settings.CCTV_RTSP_URL
        if not url:
            print("CCTV_RTSP_URL is not set. CCTV loop will exit.")
            break
            
        print(f"📷 Attempting to connect to RTSP: {url}")
        
        # FIX: Gunakan UDP untuk mencegah penumpukan antrian TCP yang membuat delay berlipat ganda
        import os
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;udp|fflags;nobuffer|flags;low_delay"
        
        cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
        if cap.isOpened():
            # Optimize buffer for real-time RTSP
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            print("✅ Successfully connected to CCTV RTSP stream.")
            return cap
            
        print("❌ Failed to connect to RTSP stream. Retrying in 5 seconds...")
        cctv_stop_event.wait(5.0)

    return None

def frame_reading_loop():
    global latest_frame
    url = settings.CCTV_RTSP_URL
    if not url:
        return

    cap = _reconnect_camera()

    while not cctv_stop_event.is_set():
        if cap is None or not cap.isOpened():
            if cap is not None: cap.release()
            cap = _reconnect_camera()
            if cap is None or cctv_stop_event.is_set():
                break

        ret, frame = cap.read()
        if not ret:
            print("⚠️ Failed to grab frame from CCTV. Reconnecting...")
            cap.release()
            cap = None
            time.sleep(1)
            continue

        with frame_lock:
            latest_frame = frame  # Removed .copy() untuk optimasi kecepatan maksimum

    if cap and cap.isOpened():
        cap.release()
    print("🛑 CCTV frame reading loop shut down.")

latest_boxes = []

def cctv_inference_loop():
    global latest_boxes
    while not cctv_stop_event.is_set():
        frame_to_process = None
        
        with frame_lock:
            if latest_frame is not None:
                frame_to_process = latest_frame.copy()
                
        if frame_to_process is not None:
            # Convert frame from BGR to RGB (CRITICAL FIX for YOLOv8)
            frame_rgb = cv2.cvtColor(frame_to_process, cv2.COLOR_BGR2RGB)
            
            # Process frames through late fusion model directly using the RGB numpy array
            vision_results = fusion_service.process_vision_data(frame_rgb)
                
            fire_conf = vision_results.get("fire_confidence", 0.0)
            smoke_conf = vision_results.get("smoke_confidence", 0.0)
            
            with frame_lock:
                latest_boxes = vision_results.get("bounding_boxes", [])
            
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
    print("🛑 CCTV inference loop shut down.")

def get_latest_frame_jpg():
    with frame_lock:
        if latest_frame is None:
            return None
        frame_to_encode = latest_frame.copy()
        current_boxes = list(latest_boxes)
        
    for box in current_boxes:
        x1, y1, x2, y2 = map(int, box["xyxy"])
        label = f"{box['class']} {box['conf']:.2f}"
        color = (0, 0, 255) if "fire" in box["class"].lower() else (128, 128, 128)
        
        cv2.rectangle(frame_to_encode, (x1, y1), (x2, y2), color, 2)
        cv2.putText(frame_to_encode, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

    ret, buffer = cv2.imencode('.jpg', frame_to_encode)
    if not ret:
        return None
    return buffer.tobytes()

def start_cctv_service():
    global frame_reader_thread, inference_thread
    if not settings.CCTV_RTSP_URL:
        print("⚠️ CCTV_RTSP_URL not present in config, skipping CCTV background service.")
        return
        
    print("🚀 Starting CCTV Background Services...")
    cctv_stop_event.clear()
    
    frame_reader_thread = threading.Thread(target=frame_reading_loop, daemon=True)
    frame_reader_thread.start()
    
    inference_thread = threading.Thread(target=cctv_inference_loop, daemon=True)
    inference_thread.start()

def stop_cctv_service():
    print("🛑 Stopping CCTV Background Services...")
    cctv_stop_event.set()
    if frame_reader_thread and frame_reader_thread.is_alive():
        frame_reader_thread.join(timeout=3.0)
    if inference_thread and inference_thread.is_alive():
        inference_thread.join(timeout=3.0)

