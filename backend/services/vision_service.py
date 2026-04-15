import cv2
import threading
import uuid
import time
from datetime import datetime

from core.database import supabase
from services.fusion_engine import fusion_service

# To control the background thread gracefully
cctv_stop_event = threading.Event()
frame_reader_thread = None
inference_thread = None
config_poll_thread = None

# Dynamic config from DB
current_rtsp_url = None
current_device_id = None
cap_reconnect_flag = False

latest_frame = None
frame_lock = threading.Lock()
latest_boxes = []

def config_polling_loop():
    global current_rtsp_url, current_device_id, cap_reconnect_flag
    while not cctv_stop_event.is_set():
        try:
            res = supabase.table("devices").select("id, rtsp_url").eq("device_type", "CCTV").execute()
            if res.data and len(res.data) > 0:
                db_url = res.data[0].get("rtsp_url")
                db_id = res.data[0].get("id")
                
                with frame_lock:
                    if db_url != current_rtsp_url:
                        print(f"🔄 RTSP URL changed to {db_url}. Reconnecting stream...")
                        current_rtsp_url = db_url
                        current_device_id = db_id
                        cap_reconnect_flag = True
        except Exception as e:
            print(f"❌ Error polling CCTV config from DB: {e}")
            
        for _ in range(20): # 10 seconds total, check stop event frequently
            if cctv_stop_event.is_set(): break
            time.sleep(0.5)

def frame_reading_loop():
    global latest_frame, cap_reconnect_flag
    
    cap = None
    last_retrieve_time = 0

    while not cctv_stop_event.is_set():
        with frame_lock:
            need_reconnect = cap_reconnect_flag
            url_to_use = current_rtsp_url

        if need_reconnect or (cap is None and url_to_use):
            if cap: 
                cap.release()
                cap = None
            
            if not url_to_use:
                time.sleep(1)
                continue
                
            import os
            # TCP lebih aman untuk gambar agar tidak pecah/glitch.
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
            print(f"📷 Attempting to connect to RTSP: {url_to_use}")
            
            cap = cv2.VideoCapture(url_to_use, cv2.CAP_FFMPEG)
            if cap.isOpened():
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                print("✅ Successfully connected to CCTV RTSP stream.")
                with frame_lock:
                    if url_to_use == current_rtsp_url:
                        cap_reconnect_flag = False
            else:
                print("❌ Failed to connect to RTSP stream. Retrying in 5s...")
                cap = None
                for _ in range(10):
                    if cctv_stop_event.is_set() or cap_reconnect_flag: break
                    time.sleep(0.5)
                continue

        if not cap or not cap.isOpened():
            time.sleep(1)
            continue
            
        # SOLUSI ANTI-LAG: grab() membuang antrean frame dengan kecepatan super tinggi tanpa beban CPU
        ret = cap.grab()
        if not ret:
            print("⚠️ Failed to grab frame from CCTV. Reconnecting...")
            if cap: cap.release()
            cap = None
            time.sleep(1)
            continue

        # Hanya decode (retrieve) frame maksimal 10 FPS untuk Dashboard & YOLO
        current_time = time.time()
        if current_time - last_retrieve_time > 0.1:
            ret, frame = cap.retrieve()
            if ret:
                with frame_lock:
                    latest_frame = frame
            last_retrieve_time = current_time

    if cap and cap.isOpened():
        cap.release()
    print("🛑 CCTV frame reading loop shut down.")

def cctv_inference_loop():
    global latest_boxes
    last_db_alert_time = 0
    
    while not cctv_stop_event.is_set():
        frame_to_process = None
        current_dev = None
        
        with frame_lock:
            if latest_frame is not None:
                frame_to_process = latest_frame.copy()
            current_dev = current_device_id
                
        if frame_to_process is not None and current_dev is not None:
            # Convert frame from BGR to RGB (Wajib untuk YOLOv8)
            frame_rgb = cv2.cvtColor(frame_to_process, cv2.COLOR_BGR2RGB)
            
            # Process frames
            vision_results = fusion_service.process_vision_data(frame_rgb)
                
            fire_conf = vision_results.get("fire_confidence", 0.0)
            smoke_conf = vision_results.get("smoke_confidence", 0.0)
            
            with frame_lock:
                latest_boxes = vision_results.get("bounding_boxes", [])
            
            current_time = time.time()
            
            # Tambahkan COOLDOWN 5 DETIK agar database tidak terspam dan CPU tidak hang!
            if (fire_conf > 0.0 or smoke_conf > 0.0) and (current_time - last_db_alert_time > 5.0):
                print(f"🔥 Threat detected via CCTV! Fire: {fire_conf:.2f}, Smoke: {smoke_conf:.2f}")
                
                public_image_url = None
                
                # Encode frame and upload to Supabase Storage
                ret, buffer = cv2.imencode('.jpg', frame_to_process)
                if ret:
                    image_bytes = buffer.tobytes()
                    file_name = f"alert_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.jpg"
                    
                    try:
                        supabase.storage.from_("vision-logs-bucket").upload(
                            file_name, 
                            image_bytes, 
                            {"content-type": "image/jpeg"}
                        )
                        public_image_url = supabase.storage.from_("vision-logs-bucket").get_public_url(file_name)
                    except Exception as e:
                        print(f"❌ Error uploading alert image to Supabase Storage: {e}")
                
                log_data = {
                    "id": str(uuid.uuid4()),
                    "device_id": current_dev,
                    "fire_confidence": float(fire_conf),
                    "smoke_confidence": float(smoke_conf),
                    "image_url": public_image_url, 
                    "recorded_at": datetime.utcnow().isoformat()
                }
                
                risk_level = "DANGER" if fire_conf > 0.5 else "WARNING"
                alert_data = {
                    "id": str(uuid.uuid4()),
                    "device_id": current_dev,
                    "risk_level": risk_level,
                    "fusion_score": max(float(fire_conf), float(smoke_conf)),
                    "alert_message": "Fire/Smoke detected by CCTV camera via RTSP stream.",
                    "is_resolved": False,
                    "triggered_at": datetime.utcnow().isoformat()
                }
                
                try:
                    supabase.table("vision_logs").insert(log_data).execute()
                    supabase.table("fusion_alerts").insert(alert_data).execute()
                    print("✅ Saved CCTV threat detection to Supabase.")
                    last_db_alert_time = current_time # Reset timer
                except Exception as e:
                    print(f"❌ Error saving CCTV alert to DB: {e}")
                    
        cctv_stop_event.wait(0.5) # Jalankan YOLO 2 kali per detik
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
    global frame_reader_thread, inference_thread, config_poll_thread
    print("🚀 Starting CCTV Background Services...")
    cctv_stop_event.clear()
    
    config_poll_thread = threading.Thread(target=config_polling_loop, daemon=True)
    config_poll_thread.start()
    
    frame_reader_thread = threading.Thread(target=frame_reading_loop, daemon=True)
    frame_reader_thread.start()
    
    inference_thread = threading.Thread(target=cctv_inference_loop, daemon=True)
    inference_thread.start()

def stop_cctv_service():
    print("🛑 Stopping CCTV Background Services...")
    cctv_stop_event.set()
    if config_poll_thread and config_poll_thread.is_alive():
        config_poll_thread.join(timeout=3.0)
    if frame_reader_thread and frame_reader_thread.is_alive():
        frame_reader_thread.join(timeout=3.0)
    if inference_thread and inference_thread.is_alive():
        inference_thread.join(timeout=3.0)