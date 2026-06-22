from typing import Literal

# Global state for Buzzer Mode
# Default is "FUSION_ONLY" as requested
# TODO: Connect this to Supabase `system_settings` table for persistence
BUZZER_MODE = "FUSION_ONLY"

def set_buzzer_mode(mode: str):
    global BUZZER_MODE
    BUZZER_MODE = mode
    print(f"🔊 Buzzer Mode updated to: {mode}")
    # Trigger re-evaluation immediately after changing mode
    trigger_mqtt_buzzer_evaluation()

def evaluate_buzzer_trigger(vision_alert: bool, sensor_alert: bool) -> bool:
    """
    Evaluate whether the buzzer should ring based on the current mode and alert states.
    """
    global BUZZER_MODE
    if BUZZER_MODE == "MUTE":
        return False
    elif BUZZER_MODE == "CCTV_ONLY":
        return vision_alert
    elif BUZZER_MODE == "SENSOR_ONLY":
        return sensor_alert
    elif BUZZER_MODE == "ANY":
        return vision_alert or sensor_alert
    elif BUZZER_MODE == "FUSION_ONLY":
        return vision_alert and sensor_alert
    return False

def trigger_mqtt_buzzer_evaluation():
    """
    Triggers the MQTT client to send either BAHAYA or AMAN command
    to the ESP32 based on the evaluated buzzer trigger.
    """
    # Import locally to avoid circular dependencies at startup
    from core.mqtt_client import client as mqtt_client
    from services.fusion_engine import fusion_service
    
    # Check vision and sensor states
    vision_alert = fusion_service.latest_vision_conf > 0.45
    sensor_alert = fusion_service.latest_sensor_anomaly
    
    should_buzz = evaluate_buzzer_trigger(vision_alert, sensor_alert)
    
    if should_buzz:
        # Perintah menyalakan buzzer
        mqtt_client.publish("iot/sensor/command", "BAHAYA")
    else:
        # Perintah mematikan buzzer
        mqtt_client.publish("iot/sensor/command", "AMAN")
