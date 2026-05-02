import os
import io
import cv2
import numpy as np
from collections import deque
from PIL import Image
import joblib
from ultralytics import YOLO
import warnings
from core.database import supabase

# Suppress TensorFlow info/warning logs (harus sebelum import tf)
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
import tensorflow as tf

# Abaikan warning sklearn scaler
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

class LateFusionService:
    # Panjang sequence yang dibutuhkan LSTM Autoencoder
    SEQUENCE_LENGTH = 10

    def __init__(self):
        # Stateful variables for late fusion
        self.latest_sensor_anomaly = False
        self.last_sensor_time = 0.0
        
        self.latest_vision_conf = 0.0
        self.last_vision_time = 0.0
        
        # Track the last time ANY anomaly was detected for auto-reset (5 mins)
        self.last_anomaly_time = 0.0
        
        # Multi-Tenant In-Memory Cache
        self.active_models = {}
        
        # We assume models are located in backend/ml_models/
        self.models_dir = os.path.join(os.path.dirname(__file__), "..", "ml_models")
        self.base_lstm_path = os.path.join(self.models_dir, "model_lstm.h5")
        self.base_scaler_path = os.path.join(self.models_dir, "scaler_lstm.pkl")
        self.base_threshold_path = os.path.join(self.models_dir, "threshold_lstm.pkl")
        
        # Dummy variables for backward compatibility with router_sensors.py API
        self.latest_error = 0.0
        self.FASE_AKTIF = "MONITORING"
        self.SAMPLING_SECONDS = 0
        self.TOLERANSI_THRESHOLD = 1.0
        self.counter_pesan = 0
        self.history_error_ruangan = []
        self.THRESHOLD_DINAMIS = 0.5 
        
        # ---------- YOLO (Vision) ----------
        yolo_path = os.path.join(self.models_dir, "best.pt")
        if os.path.exists(yolo_path):
            self.yolo_model = YOLO(yolo_path)
        else:
            print(f"Warning: YOLO model not found at {yolo_path}")
            self.yolo_model = None

    def get_device_artifacts(self, device_id: str):
        if device_id in self.active_models:
            return self.active_models[device_id]
            
        print(f"🔄 Loading artifacts for device {device_id}...")
        
        # Path for downloaded files
        device_dir = f"/tmp/ml_models/{device_id}"
        os.makedirs(device_dir, exist_ok=True)
        paths = {
            "model": f"{device_dir}/model.h5",
            "scaler": f"{device_dir}/scaler.pkl",
            "threshold": f"{device_dir}/threshold.pkl"
        }
        
        bucket = "ml_models"
        try:
            # Attempt to download from Supabase Storage
            with open(paths["model"], "wb") as f:
                f.write(supabase.storage.from_(bucket).download(f"{device_id}/model.h5"))
            with open(paths["scaler"], "wb") as f:
                f.write(supabase.storage.from_(bucket).download(f"{device_id}/scaler.pkl"))
            with open(paths["threshold"], "wb") as f:
                f.write(supabase.storage.from_(bucket).download(f"{device_id}/threshold.pkl"))
            
            # Load the device-specific models
            model = tf.keras.models.load_model(paths["model"], compile=False)
            scaler = joblib.load(paths["scaler"])
            threshold = joblib.load(paths["threshold"])
            print(f"✅ Loaded custom artifacts for {device_id} from Supabase")
        except Exception as e:
            print(f"⚠️ Custom artifacts for {device_id} not found ({e}). Falling back to base models.")
            # Load global base models
            model = tf.keras.models.load_model(self.base_lstm_path, compile=False) if os.path.exists(self.base_lstm_path) else None
            scaler = joblib.load(self.base_scaler_path) if os.path.exists(self.base_scaler_path) else None
            threshold = joblib.load(self.base_threshold_path) if os.path.exists(self.base_threshold_path) else 0.5
            
        # Detect sequence length
        seq_length = self.SEQUENCE_LENGTH
        if model:
            try:
                expected_seq = model.input_shape[1]
                if expected_seq is not None:
                    seq_length = expected_seq
            except:
                pass

        self.active_models[device_id] = {
            "model": model,
            "scaler": scaler,
            "threshold": threshold,
            "buffer": deque(maxlen=seq_length)
        }
        
        return self.active_models[device_id]

    def process_sensor_data(self, sensor_data: dict) -> bool:
        """
        Extract fitur sensor, normalisasi, masukkan ke buffer time-series,
        lalu prediksi anomali menggunakan LSTM Autoencoder spesifik per-device.
        """
        device_id = str(sensor_data.get("device_id", "default"))
        artifacts = self.get_device_artifacts(device_id)
        
        model = artifacts["model"]
        scaler = artifacts["scaler"]
        threshold = artifacts["threshold"]
        buffer = artifacts["buffer"]
        
        if not model:
            return False
            
        try:
            cng_raw = float(sensor_data.get("cng_level", 0.0))
            co_raw = float(sensor_data.get("co_level", 0.0))
            lpg_raw = float(sensor_data.get("lpg_level", 0.0))
            smoke_raw = float(sensor_data.get("smoke_detected", 0.0))
            flame_raw = float(sensor_data.get("flame_detected", 0.0))

            features = np.array([
                cng_raw, co_raw, flame_raw, lpg_raw, smoke_raw
            ]).reshape(1, -1)
            
            if scaler:
                features = scaler.transform(features)

            buffer.append(features.flatten())
            
            if len(buffer) < buffer.maxlen:
                return False
            
            sequence = np.array(list(buffer))
            sequence = sequence.reshape(1, buffer.maxlen, sequence.shape[1])
            
            reconstructed = model.predict(sequence, verbose=0)
            
            # Menghitung Error PER FITUR (menghasilkan array 5 nilai)
            error_per_fitur = np.mean(np.abs(sequence - reconstructed), axis=1)[0]
            
            # Terapkan toleransi pada threshold (threshold_dinamis_array berisi 5 nilai)
            threshold_dinamis_array = threshold * self.TOLERANSI_THRESHOLD
            
            # Deteksi anomali: jika salah satu sensor melebihi threshold
            is_anomaly = bool(np.any(error_per_fitur > threshold_dinamis_array))
            
            # Update global variables for backward compatibility with frontend API
            # Karena frontend masih mengharapkan 1 angka (scalar), kita gunakan rata-ratanya
            self.latest_error = float(np.mean(error_per_fitur))
            self.THRESHOLD_DINAMIS = float(np.mean(threshold_dinamis_array))
            
            if is_anomaly:
                print(f"🔥 ANOMALY DETECTED [{device_id}]!")
                print(f"   [Error] : {[round(e, 4) for e in error_per_fitur]}")
                print(f"   [Batas] : {[round(t, 4) for t in threshold_dinamis_array]}")
            
            return is_anomaly
        except Exception as e:
            print(f"Error processing sensor data for {device_id}: {e}")
            return False

    def update_toleransi(self, new_toleransi: float):
        """
        Mengubah multiplier threshold secara dinamis.
        Catatan: Karena sekarang multi-tenant, ini hanya mengubah multiplier global.
        """
        self.TOLERANSI_THRESHOLD = new_toleransi
        print(f"⚙️ Toleransi global diubah ke {new_toleransi}x.")

    def process_vision_data(self, image_input) -> dict:
        """
        Read the image bytes using PIL or accept numpy array directly, 
        pass to YOLOv8, and extract the maximum confidence score for 'fire' and 'smoke'.
        Returns annotated_frame via results[0].plot() for direct use.
        """
        result_scores = {"fire_confidence": 0.0, "smoke_confidence": 0.0, "annotated_frame": None}
        
        if not self.yolo_model:
            return result_scores
            
        try:
            if isinstance(image_input, bytes):
                # Dari API /vision/upload-frame/
                image = Image.open(io.BytesIO(image_input))
            else:
                # Dari CCTV Background Service (Numpy Array)
                # Keep raw BGR array
                image = image_input
                
                # FIX RESOLUSI: Paksa resize agar stabil seperti di test_webcam.py
                image = cv2.resize(image, (640, 480))
            
            # FIX SENSITIVITAS & FUNGSI: Gunakan .predict() dan conf=0.55
            results = self.yolo_model.predict(source=image, conf=0.55, imgsz=640, verbose=False)
            
            # Use results[0].plot() to generate annotated frame with bounding boxes
            # This matches the exact output of the local test_webcam.py script
            annotated_frame = results[0].plot()
            result_scores["annotated_frame"] = annotated_frame
            
            detected_items = []
            
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    class_name = self.yolo_model.names[cls_id].lower()
                    
                    detected_items.append(f"{class_name}: {conf:.3f}")
                    
                    # Simpan score tertinggi
                    if "fire" in class_name and conf > result_scores["fire_confidence"]:
                        result_scores["fire_confidence"] = conf
                    elif "smoke" in class_name and conf > result_scores["smoke_confidence"]:
                        result_scores["smoke_confidence"] = conf
                        
            if detected_items:
                print(f"YOLOv8 Detected: {detected_items}")
                        
            # Memory Optimization: Explicitly clear inference images and large arrays
            del image
            del results
            
            return result_scores
        except Exception as e:
            print(f"Error processing vision data: {e}")
            return result_scores

    def update_sensor(self, is_anomaly: bool) -> str:
        import time
        self.last_sensor_time = time.time()
        self.latest_sensor_anomaly = is_anomaly
        if is_anomaly:
            self.last_anomaly_time = self.last_sensor_time
        return self.evaluate_late_fusion()
        
    def update_vision(self, fire_conf: float) -> str:
        import time
        self.last_vision_time = time.time()
        self.latest_vision_conf = fire_conf
        if fire_conf > 0.6:
            self.last_anomaly_time = self.last_vision_time
        return self.evaluate_late_fusion()

    def evaluate_late_fusion(self) -> str:
        """
        Returns one of: 'FIRE_DANGER', 'CCTV_ALERT', 'SENSOR_ALERT', 'SAFE'
        berdasarkan status terakhir. Kita asumsikan status "kadaluarsa" jika 
        lebih dari 5 menit tidak ada update yang anomali, tapi itu 
        di-handle oleh auto-reset secara keseluruhan.
        """
        sensor_anomaly = self.latest_sensor_anomaly
        vision_fire = self.latest_vision_conf > 0.6
        
        if sensor_anomaly and vision_fire:
            return 'FIRE_DANGER'
        elif vision_fire:
            return 'CCTV_ALERT'
        elif sensor_anomaly:
            return 'SENSOR_ALERT'
        else:
            return 'SAFE'

    def check_auto_reset(self) -> bool:
        """
        Return True if 5 minutes have passed since the last anomaly.
        This signals that all alerts should be resolved.
        """
        import time
        if self.last_anomaly_time == 0.0:
            return False # Nothing to reset
            
        current_time = time.time()
        if current_time - self.last_anomaly_time > 300: # 5 minutes
            # Reset the timer so we don't spam reset
            self.last_anomaly_time = 0.0
            self.latest_sensor_anomaly = False
            self.latest_vision_conf = 0.0
            return True
        return False

# Instantiate a global service instance so models are only loaded once on server worker start
fusion_service = LateFusionService()
