import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
import tensorflow as tf
from keras.layers import Dense

class CustomDense(Dense):
    @classmethod
    def from_config(cls, config):
        config.pop('quantization_config', None)
        return super().from_config(config)

model_path = "ml_models/model_lstm.h5"

try:
    print("Trying normal load...")
    model = tf.keras.models.load_model(model_path, compile=False)
    print("Normal load succeeded!")
except Exception as e:
    print("Normal load failed:", e)
    
try:
    print("Trying custom load...")
    model = tf.keras.models.load_model(model_path, compile=False, custom_objects={'Dense': CustomDense})
    print("Custom load succeeded!")
except Exception as e:
    print("Custom load failed:", e)
