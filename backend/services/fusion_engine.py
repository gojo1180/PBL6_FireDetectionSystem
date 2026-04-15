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
            # Model StandardScaler rupanya mengharapkan 5 kolom spesifik bawaan fiturnya: (cng, co, lpg, flame, smoke)
            cng_raw = float(sensor_data.get("cng_level", 0.0))
            co_raw = float(sensor_data.get("co_level", 0.0))
            lpg_raw = float(sensor_data.get("lpg_level", 0.0))
            smoke_raw = float(sensor_data.get("smoke_detected", 0.0))
            flame_raw = float(sensor_data.get("flame_detected", 0.0))

            cng_scaled = cng_raw / 32.0 if cng_raw > 0 else 0.0
            co_scaled = co_raw / 28.0 if co_raw > 0 else 0.0
            lpg_scaled = lpg_raw / 36.0 if lpg_raw > 0 else 0.0

            features = [
                cng_scaled,
                co_scaled,
                lpg_scaled,
                1.0 if flame_raw > 0.5 else 0.0,
                1.0 if smoke_raw > 35.0 else 0.0 
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
                        
            return result_scores
        except Exception as e:
            print(f"Error processing vision data: {e}")
            return result_scores

    def evaluate_late_fusion(self, sensor_anomaly: bool, vision_fire_conf: float) -> str:
        """
        If vision > 0.6 AND sensor anomaly == True -> Risk: 'DANGER'
        If vision > 0.6 OR sensor anomaly == True -> Risk: 'WARNING'
        Else -> Risk: 'SAFE'
        """
        if vision_fire_conf > 0.6 and sensor_anomaly == True:
            return 'DANGER'
        elif vision_fire_conf > 0.6 or sensor_anomaly == True:
            return 'WARNING'
        else:
            return 'SAFE'

# Instantiate a global service instance so models are only loaded once on server worker start
fusion_service = LateFusionService()
