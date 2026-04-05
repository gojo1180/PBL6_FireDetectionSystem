import paho.mqtt.client as mqtt
import json
import ssl
from .config import settings

# Import the fusion engine instance we created earlier
from services.fusion_engine import fusion_service

MQTT_TOPIC = "iot/sensor/data" 

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Connected to HiveMQ!")
        # Explicitly subscribe to the corresponding ESP32 topic
        client.subscribe(MQTT_TOPIC) 
        print(f"📡 Mendengarkan topik: {MQTT_TOPIC}")
    else:
        print(f"❌ Failed to connect, return code {rc}")

def on_message(client, userdata, msg):
    try:
        # Proses di background secara silent tanpa log terminal
        payload = msg.payload.decode()
        sensor_data = json.loads(payload)
        
        # Masukkan ke Model Isolation Forest
        is_anomaly = fusion_service.process_sensor_data(sensor_data)
        
        # 1. Save sensor data to Supabase
        from core.database import supabase
        import uuid
        from datetime import datetime
        
        device_id = sensor_data.get("device_id", "00000000-0000-0000-0000-000000000000")
        
        log_data = {
            "id": str(uuid.uuid4()),
            "device_id": device_id,
            "cng_level": float(sensor_data.get("cng_level", 0.0)),
            "co_level": float(sensor_data.get("co_level", 0.0)),
            "lpg_level": float(sensor_data.get("lpg_level", 0.0)),
            "flame_detected": bool(sensor_data.get("flame_detected", sensor_data.get("flame", False))),
            "smoke_detected": bool(sensor_data.get("smoke_detected", sensor_data.get("smoke", False))),
            "recorded_at": datetime.utcnow().isoformat()
        }
        supabase.table("sensor_logs").insert(log_data).execute()
        
        # 2. Evaluate late fusion and generate alert if needed
        # Fetch the latest vision log to check recent fire confidence
        vision_res = supabase.table("vision_logs").select("fire_confidence").order("recorded_at", desc=True).limit(1).execute()
        fire_conf = 0.0
        if vision_res.data:
            fire_conf = vision_res.data[0].get("fire_confidence", 0.0)
            
        risk_level = fusion_service.evaluate_late_fusion(is_anomaly, fire_conf)
        
        if risk_level != 'SAFE':
            alert_data = {
                "id": str(uuid.uuid4()),
                "device_id": device_id,
                "risk_level": risk_level,
                "fusion_score": float(fire_conf) if fire_conf > 0 else (1.0 if is_anomaly else 0.0),
                "alert_message": f"System Alert: {risk_level} detected. Sensor Anomaly: {is_anomaly}. Vision Confidence: {fire_conf}",
                "is_resolved": False,
                "triggered_at": datetime.utcnow().isoformat()
            }
            supabase.table("fusion_alerts").insert(alert_data).execute()
            print(f"⚠️ Fusion Alert Triggered: {risk_level}")
            
    except Exception as e:
        # Abaikan error parsing sesaat, namun bisa di-print jika mode debug
        pass

client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

# Set username and password
client.username_pw_set(settings.HIVEMQ_USERNAME, settings.HIVEMQ_PASSWORD)

# FORCE TLS connection - HiveMQ cloud strictly requires this
client.tls_set(tls_version=ssl.PROTOCOL_TLS)

def start_mqtt():
    """Starts the MQTT client background thread"""
    print("Mencoba menghubungi HiveMQ...")
    client.connect(settings.HIVEMQ_BROKER, settings.HIVEMQ_PORT, 60)
    client.loop_start()

def stop_mqtt():
    """Stops the MQTT client background thread"""
    client.loop_stop()
    client.disconnect()