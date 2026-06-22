from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
import asyncio
from core.buzzer_mode import set_buzzer_mode
import core.buzzer_mode

router = APIRouter(prefix="/settings", tags=["Settings"])

class BuzzerModeUpdate(BaseModel):
    mode: str

@router.post("/buzzer")
def update_buzzer_mode(payload: BuzzerModeUpdate):
    valid_modes = ["ANY", "FUSION_ONLY", "MUTE", "CCTV_ONLY", "SENSOR_ONLY"]
    if payload.mode not in valid_modes:
        return {"error": "Invalid mode"}
    
    set_buzzer_mode(payload.mode)
    return {"message": "Buzzer mode updated", "current_mode": core.buzzer_mode.BUZZER_MODE}

@router.get("/buzzer")
def get_buzzer_mode():
    return {"current_mode": core.buzzer_mode.BUZZER_MODE}

async def trigger_test_buzzer():
    from core.mqtt_client import client as mqtt_client
    # Kirim perintah BAHAYA untuk test
    mqtt_client.publish("iot/sensor/command", "BAHAYA")
    # Tunggu 3 detik
    await asyncio.sleep(3)
    # Kembalikan state seperti semula berdasarkan evaluasi mode saat ini
    from core.buzzer_mode import trigger_mqtt_buzzer_evaluation
    trigger_mqtt_buzzer_evaluation()

@router.post("/buzzer/test")
def test_buzzer(background_tasks: BackgroundTasks):
    background_tasks.add_task(trigger_test_buzzer)
    return {"message": "Buzzer test initiated for 3 seconds"}
