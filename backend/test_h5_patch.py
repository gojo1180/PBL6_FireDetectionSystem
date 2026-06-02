import h5py
import json

def patch_h5_file(filepath):
    try:
        with h5py.File(filepath, 'r+') as f:
            if 'model_config' in f.attrs:
                config_str = f.attrs['model_config']
                if isinstance(config_str, bytes):
                    config_str = config_str.decode('utf-8')
                
                # Check if quantization_config is in it
                if 'quantization_config' in config_str:
                    config_dict = json.loads(config_str)
                    
                    def remove_qc(d):
                        if isinstance(d, dict):
                            d.pop('quantization_config', None)
                            for k, v in d.items():
                                remove_qc(v)
                        elif isinstance(d, list):
                            for item in d:
                                remove_qc(item)
                                
                    remove_qc(config_dict)
                    
                    new_config_str = json.dumps(config_dict)
                    f.attrs['model_config'] = new_config_str.encode('utf-8')
                    print(f"Patched {filepath}")
                else:
                    print(f"No quantization_config found in {filepath}")
    except Exception as e:
        print(f"Failed to patch {filepath}: {e}")

import shutil
shutil.copy("ml_models/model_lstm.h5", "ml_models/model_lstm_patched.h5")
patch_h5_file("ml_models/model_lstm_patched.h5")

import tensorflow as tf
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

try:
    print("Loading patched model...")
    model = tf.keras.models.load_model("ml_models/model_lstm_patched.h5", compile=False)
    print("Patched load succeeded!")
except Exception as e:
    print("Patched load failed:", e)
