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
        
        # Threshold default jika gagal memuat file
        self.static_threshold = 0.995954
        

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
            self.lstm_model = tf.keras.models.load_model(lstm_path, compile=False)
            # Deteksi SEQUENCE_LENGTH dari input shape model jika tersedia
            try:
                expected_seq = self.lstm_model.input_shape[1]
                if expected_seq is not None and expected_seq != self.SEQUENCE_LENGTH:
                    print(f"[WARNING] Model expects sequence length {expected_seq}, updating buffer.")
                    self.SEQUENCE_LENGTH = expected_seq
                    self.sensor_buffer = deque(maxlen=self.SEQUENCE_LENGTH)
            except Exception:
                pass
            print("[OK] LSTM Autoencoder model loaded successfully.")
        else:
            print(f"[WARNING] LSTM model not found at {lstm_path}")
            self.lstm_model = None

        scaler_path = os.path.join(models_dir, "scaler_lstm_lokal.pkl")
        if not os.path.exists(scaler_path):
            # Fallback ke nama file dengan copy jika ada
            scaler_path_copy = os.path.join(models_dir, "scaler_lstm_lokal copy.pkl")
            if os.path.exists(scaler_path_copy):
                scaler_path = scaler_path_copy
                
        if os.path.exists(scaler_path):
            self.scaler = joblib.load(scaler_path)
            print(f"[OK] StandardScaler ({os.path.basename(scaler_path)}) loaded successfully.")
        else:
            print(f"[WARNING] StandardScaler not found at {scaler_path}")
            self.scaler = None

        # ---------- Load Static Threshold ----------
        threshold_path = os.path.join(models_dir, "threshold_lstm_lokal.pkl")
        if os.path.exists(threshold_path):
            try:
                loaded_threshold = joblib.load(threshold_path)
                if isinstance(loaded_threshold, np.ndarray):
                    loaded_threshold = loaded_threshold.item()
                self.static_threshold = float(loaded_threshold)
                print(f"[OK] Static LSTM Threshold loaded successfully: {self.static_threshold:.6f}")
            except Exception as e:
                print(f"[WARNING] Gagal memuat Static Threshold: {e}. Menggunakan fallback {self.static_threshold:.6f}")
        else:
            print(f"[WARNING] Static Threshold tidak ditemukan di {threshold_path}. Menggunakan fallback {self.static_threshold:.6f}")

        # ---------- Auto-Kalibrasi (Dynamic Threshold) ----------
        self.SAMPLING_SECONDS = 120     # Waktu pengambilan baseline (dalam iterasi/detik)
        self.TOLERANSI_THRESHOLD = 1.15  # Pengali error tertinggi
        self.counter_pesan = 0
        self.history_error_ruangan = []
        self.THRESHOLD_DINAMIS = self.static_threshold # Default gunakan threshold statis dulu
        self.latest_error = 0.0         # Tambahkan state terbaru untuk diakses API
        self.FASE_AKTIF = "SAMPLING"    # Langsung mulai dari fase kalibrasi

    def process_sensor_data(self, sensor_data: dict) -> bool:
        """
        Extract fitur sensor, normalisasi, masukkan ke buffer time-series,
        lalu prediksi anomali menggunakan LSTM Autoencoder (reconstruction error / MAE).
        
        Fase 1 - Kalibrasi: Mengumpulkan MAE selama 60 siklus untuk menentukan threshold dinamis.
        Fase 2 - Monitoring: Membandingkan MAE real-time dengan threshold yang sudah dikalibrasi.
        
        Returns True jika anomaly terdeteksi, False jika normal atau sedang kalibrasi.
        """
        if not self.lstm_model:
            return False
            
        try:
            cng_raw = float(sensor_data.get("cng_level", 0.0))
            co_raw = float(sensor_data.get("co_level", 0.0))
            lpg_raw = float(sensor_data.get("lpg_level", 0.0))
            smoke_raw = float(sensor_data.get("smoke_detected", 0.0))

            # Flame di-hardcode ke 0.6 sesuai format dataset
            flame_fixed = 0.6

            # URUTAN WAJIB SCALER: ['cng', 'co', 'flame', 'lpg', 'smoke']
            features = np.array([
                cng_raw,
                co_raw,
                flame_fixed,
                lpg_raw,
                smoke_raw
            ]).reshape(1, -1)
            
            # Normalisasi menggunakan StandardScaler
            if self.scaler:
                features = self.scaler.transform(features)
            else:
                print("[WARNING] Peringatan: StandardScaler tidak diload! Melanjutkan dengan data asli.")

            # Tambahkan ke buffer time-series
            self.sensor_buffer.append(features.flatten())
            
            # Buffer belum penuh -> belum bisa prediksi, memori AI sedang disiapkan
            if len(self.sensor_buffer) < self.SEQUENCE_LENGTH:
                print(f"[MEMORI AI] Menyiapkan buffer... {len(self.sensor_buffer)}/{self.SEQUENCE_LENGTH}")
                return False
            
            # Bentuk sequence: (1, SEQUENCE_LENGTH, n_features)
            sequence = np.array(list(self.sensor_buffer))
            sequence = sequence.reshape(1, self.SEQUENCE_LENGTH, sequence.shape[1])
            
            # Prediksi (reconstruct) menggunakan LSTM Autoencoder
            reconstructed = self.lstm_model.predict(sequence, verbose=0)
            
            # Hitung reconstruction error (MAE - Mean Absolute Error)
            mae = float(np.mean(np.abs(sequence - reconstructed)))
            self.latest_error = mae # Update latest_error untuk API
            
            # ============================================================
            # PEMANTAUAN AKTIF — Deteksi anomali real-time
            # ============================================================
            is_anomaly = bool(mae > self.static_threshold)
            
            if is_anomaly:
                print(f"[MONITOR] BAHAYA | MAE: {mae:.6f} (Batas: {self.static_threshold:.6f})")
            else:
                # Debugging print occasionally to avoid spam
                # print(f"[MONITOR] AMAN   | MAE: {mae:.6f} (Batas: {self.static_threshold:.6f})")
                pass
            
            return is_anomaly
        except Exception as e:
            print(f"Error processing sensor data: {e}")
            return False

    def update_toleransi(self, new_toleransi: float):
        """
        Secara dinamis mengubah pengali threshold (TOLERANSI_THRESHOLD) 
        tanpa harus restart program. Jika sedang MONITORING, threshold langsung disesuaikan.
        """
        self.TOLERANSI_THRESHOLD = new_toleransi
        if hasattr(self, 'FASE_AKTIF') and self.FASE_AKTIF == "MONITORING" and self.history_error_ruangan:
            self.THRESHOLD_DINAMIS = max(self.history_error_ruangan) * self.TOLERANSI_THRESHOLD
            print(f"⚙️ Toleransi diubah ke {new_toleransi}x. Threshold Dinamis baru: {self.THRESHOLD_DINAMIS:.4f}")
        else:
            print(f"⚙️ Toleransi diubah ke {new_toleransi}x. Akan diterapkan setelah kalibrasi selesai.")

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
