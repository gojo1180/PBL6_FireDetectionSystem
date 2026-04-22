import os
import gc
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
latest_annotated_frame = None
frame_lock = threading.Lock()

_last_gc_time = 0

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

        # Decode (retrieve) frame pada ~30 FPS untuk Dashboard & YOLO
        current_time = time.time()
        if current_time - last_retrieve_time > 0.033:
            ret, frame = cap.retrieve()
            if ret:
                with frame_lock:
                    latest_frame = frame
            last_retrieve_time = current_time

    if cap and cap.isOpened():
        cap.release()
    print("🛑 CCTV frame reading loop shut down.")

def cctv_inference_loop():
    global latest_annotated_frame
    last_db_alert_time = 0
    fire_streak = 0
    smoke_streak = 0
    
    while not cctv_stop_event.is_set():
        frame_to_process = None
        current_dev = None
        
        with frame_lock:
            if latest_frame is not None:
                frame_to_process = latest_frame.copy()
            current_dev = current_device_id
                
        if frame_to_process is not None and current_dev is not None:
            # Process frames (fusion_engine handles BGR input directly)
            vision_results = fusion_service.process_vision_data(frame_to_process)
                
            fire_conf = vision_results.get("fire_confidence", 0.0)
            smoke_conf = vision_results.get("smoke_confidence", 0.0)
            
            # Get annotated frame from results[0].plot(), fallback to raw frame
            annotated_img = vision_results.get("annotated_frame")
            if annotated_img is None:
                annotated_img = frame_to_process

            # Streak Counter Logic for False Positive Mitigation
            if fire_conf > 0.6:
                fire_streak += 1
            else:
                fire_streak = 0
            
            if smoke_conf > 0.68:
                smoke_streak += 1
            else:
                smoke_streak = 0
            
            # Update the global annotated frame for the MJPEG live feed
            with frame_lock:
                latest_annotated_frame = annotated_img
            
            current_time = time.time()
            
            # Trigger: Update fusion state
            max_conf = max(fire_conf, smoke_conf)
            # Threshold vision kita set berdasarkan streak 
            is_vision_threat = (fire_streak >= 3 or smoke_streak >= 3)
            
            # Update fusion engine
            alert_level = fusion_service.update_vision(max_conf if is_vision_threat else 0.0)
            
            # TRIGGER: ONLY IF streak >= 3 and cooldown fulfilled
            if is_vision_threat and (current_time - last_db_alert_time > 5.0):
                print(f"🔥 Threat CONFIRMED via CCTV Stability Check! Fire Streak: {fire_streak}, Smoke Streak: {smoke_streak}")
                print(f"Confidence - Fire: {fire_conf:.2f}, Smoke: {smoke_conf:.2f}")
                
                public_image_url = None
                
                # Encode the ANNOTATED frame (with bounding boxes) and upload
                ret, buffer = cv2.imencode('.jpg', annotated_img, [int(cv2.IMWRITE_JPEG_QUALITY), 65])
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
                
                try:
                    supabase.table("vision_logs").insert(log_data).execute()
                    
                    if alert_level in ['CCTV_ALERT', 'FIRE_DANGER']:
                        active_alerts = supabase.table("fusion_alerts").select("id").eq("is_resolved", False).eq("device_id", current_dev).execute()
                        
                        alert_data = {
                            "risk_level": "DANGER" if alert_level == "FIRE_DANGER" else "WARNING",
                            "fusion_score": max(float(fire_conf), float(smoke_conf)),
                            "alert_message": f"System Alert: {alert_level.replace('_', ' ')}",
                        }
                        
                        if active_alerts.data and len(active_alerts.data) > 0:
                            alert_id = active_alerts.data[0]["id"]
                            supabase.table("fusion_alerts").update(alert_data).eq("id", alert_id).execute()
                            print(f"⚠️ Fusion Alert Updated via CCTV: {alert_level}")
                        else:
                            alert_data["id"] = str(uuid.uuid4())
                            alert_data["device_id"] = current_dev
                            alert_data["is_resolved"] = False
                            alert_data["triggered_at"] = datetime.utcnow().isoformat()
                            supabase.table("fusion_alerts").insert(alert_data).execute()
                            print(f"⚠️ Fusion Alert Triggered via CCTV: {alert_level}")
                    
                    # Reset streaks and timer after successful trigger to prevent spam
                    fire_streak = 0
                    smoke_streak = 0
                    last_db_alert_time = current_time 
                except Exception as e:
                    print(f"❌ Error saving CCTV alert to DB: {e}")
            else:
                # SAFE or cooldown not met
                pass
                
            # AUTO-RESET CHECK
            if fusion_service.check_auto_reset():
                print("🔄 Auto-Reset Triggered: 5 minutes without anomalies. Resolving all active alerts.")
                try:
                    supabase.table("fusion_alerts").update({"is_resolved": True}).eq("is_resolved", False).execute()
                except Exception as e:
                    print(f"❌ Error auto-resolving alerts: {e}")
                    
            # Memory Optimization: Explicitly release large OpenCV/numpy objects
            del frame_to_process
            del vision_results
            del annotated_img
            
            # Clean up alert-path temporaries if they were created this iteration
            try:
                del buffer
            except NameError:
                pass
            try:
                del image_bytes
            except NameError:
                pass
            
            # Throttled GC: run at most once every 10 seconds to avoid pausing threads
            global _last_gc_time
            _now = time.time()
            if _now - _last_gc_time > 10.0:
                gc.collect()
                _last_gc_time = _now
            
        cctv_stop_event.wait(0.05) # Jalankan YOLO ~20 kali per detik untuk stream smooth
    print("🛑 CCTV inference loop shut down.")

def get_latest_frame_jpg():
    with frame_lock:
        # Prefer the annotated frame (with YOLO bounding boxes from results[0].plot())
        if latest_annotated_frame is not None:
            frame_to_encode = latest_annotated_frame.copy()
        elif latest_frame is not None:
            frame_to_encode = latest_frame.copy()
        else:
            return None

    ret, buffer = cv2.imencode('.jpg', frame_to_encode, [int(cv2.IMWRITE_JPEG_QUALITY), 65])
    
    # Memory Optimization: immediately clear explicitly copied frame data
    del frame_to_encode
    
    if not ret:
        return None
        
    result_bytes = buffer.tobytes()
    del buffer
    return result_bytes

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