from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    HIVEMQ_BROKER: str
    HIVEMQ_PORT: int = 8883
    HIVEMQ_USERNAME: str
    HIVEMQ_PASSWORD: str

    class Config:
        env_file = ".env"

settings = Settings()
