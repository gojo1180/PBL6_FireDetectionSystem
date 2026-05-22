from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    HIVEMQ_BROKER: str
    HIVEMQ_PORT: int = 8883
    HIVEMQ_USERNAME: str
    HIVEMQ_PASSWORD: str
    CCTV_RTSP_URL: Optional[str] = None
    NEWSDATA_API_KEY: Optional[str] = None
    HF_SUMMARY_MODEL_URL: Optional[str] = None
    HF_EXTRACTIVE_MODEL_URL: Optional[str] = None
    HF_API_KEY: Optional[str] = None
    
    # MLOps GitHub Actions Config
    GITHUB_PAT: Optional[str] = None
    GITHUB_OWNER: str = "gojo1180"
    GITHUB_REPO: str = "PBL6_FireDetectionSystem"

    # Web Push Notification (VAPID)
    VAPID_PRIVATE_KEY: Optional[str] = None
    VAPID_SUBJECT: Optional[str] = None

    class Config:
        env_file = ".env"

settings = Settings()
