import os
import argparse
import numpy as np
import pandas as pd
import joblib
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Suppress TensorFlow logging
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.callbacks import EarlyStopping
from sklearn.preprocessing import MinMaxScaler
from supabase import create_client, Client

# Load environment variables (useful for local testing)
load_dotenv()

# Constants
SEQUENCE_LENGTH = 10
FEATURES = ['cng_level', 'co_level', 'flame_detected', 'lpg_level', 'smoke_detected']
BUCKET_NAME = "ml_models"

def get_supabase_client() -> Client:
    """Initialize and return the Supabase client."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY environment variables must be set.")
    return create_client(url, key)

def download_from_storage(supabase: Client, device_id: str, filename: str, local_path: str):
    """Download a file from Supabase Storage for a specific device."""
    storage_path = f"{device_id}/{filename}"
    try:
        response = supabase.storage.from_(BUCKET_NAME).download(storage_path)
        with open(local_path, "wb") as f:
            f.write(response)
        print(f"✅ Downloaded {filename} from {storage_path}")
        return True
    except Exception as e:
        print(f"⚠️ Could not download {filename} from {storage_path}. It might not exist yet. Error: {e}")
        return False

def upload_to_storage(supabase: Client, device_id: str, filename: str, local_path: str):
    """Upload a file to Supabase Storage, overwriting if it exists."""
    storage_path = f"{device_id}/{filename}"
    try:
        with open(local_path, "rb") as f:
            # Note: supabase-py doesn't have a direct overwrite flag in upload, 
            # so we try to remove it first or use update
            try:
                supabase.storage.from_(BUCKET_NAME).remove([storage_path])
            except:
                pass
            supabase.storage.from_(BUCKET_NAME).upload(file=f, path=storage_path, file_options={"content-type": "application/octet-stream"})
        print(f"✅ Uploaded updated {filename} to {storage_path}")
    except Exception as e:
        print(f"❌ Failed to upload {filename} to {storage_path}: {e}")

def create_sequences(data, seq_length):
    """Create time-series sequences for LSTM."""
    xs = []
    for i in range(len(data) - seq_length):
        xs.append(data[i:(i + seq_length)])
    return np.array(xs)

def main():
    parser = argparse.ArgumentParser(description="Continuous Training Pipeline for Fire Detection")
    parser.add_argument("--device_id", type=str, help="Target device ID to retrain", required=False)
    args = parser.parse_args()

    # Fallback to environment variable if not provided via argparse
    device_id = args.device_id or os.environ.get("DEVICE_ID")
    if not device_id:
        raise ValueError("device_id must be provided via --device_id argument or DEVICE_ID environment variable.")

    print(f"🚀 Starting Retraining Pipeline for Device: {device_id}")
    supabase = get_supabase_client()

    # 1. Fetch False Positives
    print("🔍 Querying False Positive alerts...")
    alerts_response = supabase.table("fusion_alerts") \
        .select("triggered_at") \
        .eq("device_id", device_id) \
        .eq("is_false_positive", True) \
        .execute()
    
    false_positives = alerts_response.data
    if not false_positives:
        print("✅ No false positive feedback found. Skipping retraining.")
        return

    print(f"Found {len(false_positives)} false positive events.")

    # 2. Fetch Sensor Data Context Windows & Baseline
    print("📥 Fetching contextual sensor data and baseline...")
    dataset_frames = []

    # Fetch context window for each false positive (e.g., 10 minutes before and after)
    # Since we can't easily query "5000 rows before/after" efficiently via simple REST without complex RPC,
    # we'll fetch based on time windows.
    for fp in false_positives:
        fp_time = pd.to_datetime(fp["triggered_at"])
        start_time = fp_time - pd.Timedelta(minutes=10)
        end_time = fp_time + pd.Timedelta(minutes=10)
        
        window_res = supabase.table("sensor_logs") \
            .select(",".join(FEATURES)) \
            .eq("device_id", device_id) \
            .gte("recorded_at", start_time.isoformat()) \
            .lte("recorded_at", end_time.isoformat()) \
            .order("recorded_at") \
            .execute()
        
        if window_res.data:
            dataset_frames.append(pd.DataFrame(window_res.data))

    # Fetch Baseline (Purely normal data, e.g., last 5000 rows where no alerts happened recently)
    # For simplicity, we just fetch the oldest 5000 rows of the device as a baseline.
    # In a real scenario, you might want to specifically query periods without alerts.
    baseline_res = supabase.table("sensor_logs") \
        .select(",".join(FEATURES)) \
        .eq("device_id", device_id) \
        .order("recorded_at", desc=False) \
        .limit(5000) \
        .execute()
    
    if baseline_res.data:
        dataset_frames.append(pd.DataFrame(baseline_res.data))

    if not dataset_frames:
        print("❌ No sensor data found for retraining.")
        return

    # Combine all data
    df = pd.concat(dataset_frames).reset_index(drop=True)
    # Ensure columns are in the exact order required by the model
    df = df[FEATURES]
    print(f"📊 Total records assembled for retraining: {len(df)}")

    # 3. Download Existing Artifacts
    # In a real environment, you might download from the device's specific folder.
    # If not found, you might download a 'base' model to start from.
    os.makedirs("tmp_artifacts", exist_ok=True)
    local_model_path = "tmp_artifacts/model.h5"
    local_scaler_path = "tmp_artifacts/scaler.pkl"
    
    model_exists = download_from_storage(supabase, device_id, "model.h5", local_model_path)
    scaler_exists = download_from_storage(supabase, device_id, "scaler.pkl", local_scaler_path)

    if not model_exists:
        # Fallback to a global base model if device-specific model doesn't exist
        print("⚠️ Device-specific model not found. Attempting to download global base model...")
        # Path relatif dari root repositori karena GitHub Actions run 'python mlops/retrain.py' dari root
        base_model_path = "backend/ml_models/model_lstm.h5"
        if os.path.exists(base_model_path):
            local_model_path = base_model_path
        else:
            raise FileNotFoundError(f"Could not find any base model to fine-tune at {base_model_path}")

    # 4. Preprocessing
    print("⚙️ Preprocessing data...")
    # The prompt explicitly requested using MinMaxScaler.
    # If a scaler already exists for this device, we could load it.
    # However, since we are combining baseline + new false positives, refitting a MinMaxScaler
    # on the comprehensive dataset ensures all values fall within [0, 1].
    scaler = MinMaxScaler()
    scaled_data = scaler.fit_transform(df)

    # Create Sequences
    X_train = create_sequences(scaled_data, SEQUENCE_LENGTH)
    print(f"🧩 Created {len(X_train)} sequences for training. Shape: {X_train.shape}")

    # 5. Load and Train Model
    print("🧠 Loading model...")
    model = load_model(local_model_path, compile=False)
    
    # Recompile since it was loaded with compile=False
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.0005), loss='mae')

    print("🚀 Fine-tuning model (Continuous Training)...")
    early_stopping = EarlyStopping(
        monitor='loss', 
        patience=5, 
        restore_best_weights=True,
        verbose=1
    )

    # Train the Autoencoder (Input = Output)
    history = model.fit(
        X_train, X_train,
        epochs=30,
        batch_size=64,
        validation_split=0.1,
        callbacks=[early_stopping],
        verbose=1
    )

    # 6. Recalculate Threshold
    print("📐 Recalculating Anomaly Threshold...")
    reconstructions = model.predict(X_train)
    
    # Menghitung MAE loss per timestep (axis=1), menyisakan dimensi sampel dan fitur
    train_mae_loss_per_fitur = np.mean(np.abs(reconstructions - X_train), axis=1)
    
    # Ambil nilai error tertinggi untuk MASING-MASING sensor (Shape: 5 threshold berbeda)
    # Mengikuti logic notebook kamu: np.max(..., axis=0)
    new_threshold = np.max(train_mae_loss_per_fitur, axis=0)
    print(f"🎯 New Threshold per Sensor Calculated: {new_threshold}")

    # 7. Save and Upload Artifacts
    print("💾 Saving updated artifacts locally...")
    new_model_path = "tmp_artifacts/updated_model.h5"
    new_scaler_path = "tmp_artifacts/updated_scaler.pkl"
    new_threshold_path = "tmp_artifacts/updated_threshold.pkl"

    model.save(new_model_path)
    joblib.dump(scaler, new_scaler_path)
    joblib.dump(new_threshold, new_threshold_path)

    print("☁️ Uploading to Supabase Storage...")
    upload_to_storage(supabase, device_id, "model.h5", new_model_path)
    upload_to_storage(supabase, device_id, "scaler.pkl", new_scaler_path)
    upload_to_storage(supabase, device_id, "threshold.pkl", new_threshold_path)

    print("🎉 Pipeline completed successfully!")

if __name__ == "__main__":
    main()
