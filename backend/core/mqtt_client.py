import paho.mqtt.client as mqtt
import json
import ssl
import uuid
from datetime import datetime
from .config import settings

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
    from core.database import supabase
    
    try:
        # Parse the incoming JSON payload
        payload = msg.payload.decode()
        sensor_data = json.loads(payload)
        
        # Pass the data to the fusion_engine to get the is_anomaly result
        is_anomaly = fusion_service.process_sensor_data(sensor_data)
        
        # Update stateful fusion engine and get current alert level
        alert_level = fusion_service.update_sensor(is_anomaly)
        
        raw_device_id = sensor_data.get("device_id", "00000000-0000-0000-0000-000000000000")
        try:
            # First, check if it is already a valid UUID
            uuid.UUID(str(raw_device_id))
            device_id = str(raw_device_id)
        except ValueError:
            # If not a valid UUID (e.g. "esp32-node-1"), create a deterministic UUID
            device_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, str(raw_device_id)))
        
        def parse_bool_to_float(val):
            if isinstance(val, str):
                val_lower = val.lower().strip()
                if val_lower == "true":
                    return 1.0
                if val_lower == "false":
                    return 0.0
            if isinstance(val, bool):
                return 1.0 if val else 0.0
            try:
                return float(val)
            except (TypeError, ValueError):
                return 0.0

        flame_val = sensor_data.get("flame_detected", sensor_data.get("flame", False))
        smoke_val = sensor_data.get("smoke_detected", sensor_data.get("smoke", False))

        log_data = {
            "id": str(uuid.uuid4()),
            "device_id": device_id,
            "cng_level": float(sensor_data.get("cng_level", 0.0)),
            "co_level": float(sensor_data.get("co_level", 0.0)),
            "lpg_level": float(sensor_data.get("lpg_level", 0.0)),
            "flame_detected": parse_bool_to_float(flame_val),
            "smoke_detected": parse_bool_to_float(smoke_val),
            "recorded_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        print(f"❌ MESSAGE PARSING ERROR: {e}")
        return

    # Wrap the database inserts in a try...except block
    try:
        # Attempt to insert the raw sensor data into the sensor_logs table
        supabase.table("sensor_logs").insert(log_data).execute()
        
        # Insert or update alert if risk is elevated
        if alert_level in ['SENSOR_ALERT', 'FIRE_DANGER']:
            # Cek apakah sudah ada alert aktif untuk device ini
            active_alerts = supabase.table("fusion_alerts").select("id").eq("is_resolved", False).eq("device_id", device_id).execute()
            
            alert_data = {
                "risk_level": "DANGER" if alert_level == "FIRE_DANGER" else "WARNING",
                "fusion_score": 1.0, # Dummy score for sensor
                "alert_message": f"System Alert: {alert_level.replace('_', ' ')}",
            }
            
            if active_alerts.data and len(active_alerts.data) > 0:
                # Update existing alert
                alert_id = active_alerts.data[0]["id"]
                supabase.table("fusion_alerts").update(alert_data).eq("id", alert_id).execute()
                print(f"⚠️ Fusion Alert Updated: {alert_level}")
            else:
                # Insert new alert
                alert_data["id"] = str(uuid.uuid4())
                alert_data["device_id"] = device_id
                alert_data["is_resolved"] = False
                alert_data["triggered_at"] = datetime.utcnow().isoformat()
                supabase.table("fusion_alerts").insert(alert_data).execute()
                print(f"⚠️ Fusion Alert Triggered: {alert_level}")
        elif alert_level == 'SAFE':
            # Jika SAFE dan tidak ada deteksi api dari vision, tidak perlu buat alert baru
            pass
            
    except Exception as e:
        print(f"❌ SUPABASE INSERT ERROR: {e}")

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