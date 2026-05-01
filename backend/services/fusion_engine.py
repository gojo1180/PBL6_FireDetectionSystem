import os
import io
import cv2
import numpy as np
from collections import deque
from PIL import Image
import joblib
from ultralytics import YOLO
import warnings

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
        
        # Time-series buffer untuk LSTM — menyimpan N data terbaru
        self.sensor_buffer = deque(maxlen=self.SEQUENCE_LENGTH)
        
        # We assume models are located in backend/ml_models/
        models_dir = os.path.join(os.path.dirname(__file__), "..", "ml_models")
        
        # ---------- YOLO (Vision) ----------
        yolo_path = os.path.join(models_dir, "best.pt")
        if os.path.exists(yolo_path):
            self.yolo_model = YOLO(yolo_path)
        else:
            print(f"Warning: YOLO model not found at {yolo_path}")
            self.yolo_model = None

        # ---------- LSTM Autoencoder (Sensor) ----------
        lstm_path = os.path.join(models_dir, "model_finetuned_lokal.h5")
        if os.path.exists(lstm_path):
            self.lstm_model = tf.keras.models.load_model(lstm_path,compile=False)
            # Deteksi SEQUENCE_LENGTH dari input shape model jika tersedia
            try:
                expected_seq = self.lstm_model.input_shape[1]
                if expected_seq is not None and expected_seq != self.SEQUENCE_LENGTH:
                    print(f"⚠️ Model expects sequence length {expected_seq}, updating buffer.")
                    self.SEQUENCE_LENGTH = expected_seq
                    self.sensor_buffer = deque(maxlen=self.SEQUENCE_LENGTH)
            except Exception:
                pass
            print("✅ LSTM Autoencoder model loaded successfully.")
        else:
            print(f"⚠️ Warning: LSTM model not found at {lstm_path}")
            self.lstm_model = None

        scaler_path = os.path.join(models_dir, "scaler_lstm_lokal.pkl")
        if os.path.exists(scaler_path):
            self.scaler = joblib.load(scaler_path)
            print("✅ StandardScaler (scaler_lstm_lokal.pkl) loaded successfully.")
        else:
            print(f"⚠️ Warning: StandardScaler not found at {scaler_path}")
            self.scaler = None

        threshold_path = os.path.join(models_dir, "threshold_lstm_lokal.pkl")
        if os.path.exists(threshold_path):
            self.threshold = joblib.load(threshold_path)
            print(f"✅ Anomaly threshold loaded: {self.threshold}")
        else:
            print(f"⚠️ Warning: Threshold file not found at {threshold_path}. Menggunakan default 0.5")
            self.threshold = 0.5

        # ---------- Konfigurasi Threshold (Statis) ----------
        # Variabel dummy agar API router_sensors.py tidak error
        self.SAMPLING_SECONDS = 0
        self.TOLERANSI_THRESHOLD = 1.0
        self.counter_pesan = 0
        self.history_error_ruangan = []
        
        self.THRESHOLD_DINAMIS = self.threshold # Menggunakan threshold bawaan dari pkl
        self.latest_error = 0.0
        self.FASE_AKTIF = "MONITORING"    # Langsung mulai dari fase monitoring

    def process_sensor_data(self, sensor_data: dict) -> bool:
        """
        Extract fitur sensor, normalisasi, masukkan ke buffer time-series,
        lalu prediksi anomali menggunakan LSTM Autoencoder (reconstruction error).
        Returns True jika anomaly terdeteksi, False jika normal.
        """
        if not self.lstm_model:
            return False
            
        try:
            cng_raw = float(sensor_data.get("cng_level", 0.0))
            co_raw = float(sensor_data.get("co_level", 0.0))
            lpg_raw = float(sensor_data.get("lpg_level", 0.0))
            smoke_raw = float(sensor_data.get("smoke_detected", 0.0))
            flame_raw = float(sensor_data.get("flame_detected", 0.0))

            # URUTAN WAJIB SCALER: ['cng', 'co', 'flame', 'lpg', 'smoke']
            features = np.array([
                cng_raw,
                co_raw,
                flame_raw,
                lpg_raw,
                smoke_raw
            ]).reshape(1, -1)
            
            # Normalisasi menggunakan StandardScaler
            if self.scaler:
                features = self.scaler.transform(features)
            else:
                print("⚠️ Peringatan: StandardScaler tidak diload! Melanjutkan dengan data asli.")

            # Tambahkan ke buffer time-series
            self.sensor_buffer.append(features.flatten())
            
            # Buffer belum penuh → belum bisa prediksi, anggap SAFE
            if len(self.sensor_buffer) < self.SEQUENCE_LENGTH:
                print(f"📊 Buffer: {len(self.sensor_buffer)}/{self.SEQUENCE_LENGTH} — menunggu data cukup...")
                return False
            
            # Bentuk sequence: (1, SEQUENCE_LENGTH, n_features)
            sequence = np.array(list(self.sensor_buffer))
            sequence = sequence.reshape(1, self.SEQUENCE_LENGTH, sequence.shape[1])
            
            # Prediksi (reconstruct) menggunakan LSTM Autoencoder
            reconstructed = self.lstm_model.predict(sequence, verbose=0)
            
            # Hitung reconstruction error (MAE per sample) agar sesuai algoritma kalibrasi
            error_saat_ini = np.mean(np.abs(sequence - reconstructed))
            self.latest_error = float(error_saat_ini)
            
            # Deteksi anomali menggunakan threshold bawaan (statis)
            is_anomaly = bool(error_saat_ini > self.THRESHOLD_DINAMIS)
            
            if is_anomaly:
                print(f"🔥 ANOMALY DETECTED! Error: {error_saat_ini:.6f} > Batas Threshold: {self.THRESHOLD_DINAMIS:.6f}")
            
            return is_anomaly
        except Exception as e:
            print(f"Error processing sensor data: {e}")
            return False

    def update_toleransi(self, new_toleransi: float):
        """
        Mengubah multiplier threshold secara dinamis (mengalikan base threshold bawaan).
        """
        self.TOLERANSI_THRESHOLD = new_toleransi
        self.THRESHOLD_DINAMIS = self.threshold * self.TOLERANSI_THRESHOLD
        print(f"⚙️ Toleransi diubah ke {new_toleransi}x. Batas Threshold baru: {self.THRESHOLD_DINAMIS:.4f}")

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
