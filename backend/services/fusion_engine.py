import os
import io
import cv2
import numpy as np
from PIL import Image
import joblib
from ultralytics import YOLO
import warnings

# Abaikan warning "X does not have valid feature names" setiap kali inference numpy scaler
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

class LateFusionService:
    def __init__(self):
        # Stateful variables for late fusion
        self.latest_sensor_anomaly = False
        self.last_sensor_time = 0.0
        
        self.latest_vision_conf = 0.0
        self.last_vision_time = 0.0
        
        # Track the last time ANY anomaly was detected for auto-reset (5 mins)
        self.last_anomaly_time = 0.0
        
        # We assume models are located in backend/models/
        models_dir = os.path.join(os.path.dirname(__file__), "..", "ml_models")
        
        yolo_path = os.path.join(models_dir, "best.pt")
        if os.path.exists(yolo_path):
            self.yolo_model = YOLO(yolo_path)
        else:
            print(f"Warning: YOLO model not found at {yolo_path}")
            self.yolo_model = None
            
        if_path = os.path.join(models_dir, "model_isolation_forest.pkl")
        if os.path.exists(if_path):
            self.if_model = joblib.load(if_path)
        else:
            print(f"Warning: Isolation Forest model not found at {if_path}")
            self.if_model = None

        scaler_path = os.path.join(models_dir, "scaler_isolation_forest.pkl")
        if os.path.exists(scaler_path):
            self.scaler = joblib.load(scaler_path)
            print("✅ StandardScaler (scaler_isolation_forest.pkl) loaded successfully.")
        else:
            print(f"⚠️ Warning: StandardScaler not found at {scaler_path}. Harap masukkan file 'scaler_isolation_forest.pkl' kesini!")
            self.scaler = None

    def process_sensor_data(self, sensor_data: dict) -> bool:
        """
        Extract [cng_level, co_level, lpg_level], reshape, and predict using the Isolation Forest.
        Isolation Forest usually outputs -1 for anomaly, 1 for normal.
        Returns True if anomaly detected, False otherwise.
        """
        if not self.if_model:
            return False
            
        try:
            cng_raw = float(sensor_data.get("cng_level", 0.0))
            co_raw = float(sensor_data.get("co_level", 0.0))
            lpg_raw = float(sensor_data.get("lpg_level", 0.0))
            smoke_raw = float(sensor_data.get("smoke_detected", 0.0))
            flame_raw = float(sensor_data.get("flame_detected", 0.0))

            # URUTAN WAJIB SCALER: ['cng', 'co', 'flame', 'lpg', 'smoke']
            features = [
                cng_raw,
                co_raw,
                flame_raw,
                lpg_raw,
                smoke_raw
            ]
            X = np.array(features).reshape(1, -1)
            
            # Normalisasi menggunakan StandardScaler sebelum inference
            if self.scaler:
                X = self.scaler.transform(X)
            else:
                print("⚠️ Peringatan: StandardScaler tidak diload! Melanjutkan inference dengan data asli (belum dinormalisasi).")

            prediction = self.if_model.predict(X)
            
            is_anomaly = True if prediction[0] == -1 else False
            return is_anomaly
        except Exception as e:
            print(f"Error processing sensor data: {e}")
            return False

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
