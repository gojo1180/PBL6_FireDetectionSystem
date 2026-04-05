from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Import API Routers
from api.v1 import router_sensors, router_vision, router_alerts

# Import MQTT client initialization controls
from core.mqtt_client import start_mqtt, stop_mqtt

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    print("🚀 SYSTEM: Memulai Koneksi MQTT...")
    start_mqtt()
    yield
    # --- Shutdown ---
    stop_mqtt()

# Strict initialization with the async lifespan context manager
app = FastAPI(lifespan=lifespan)

# Allow CORS so Next.js frontend can interact later seamlessly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all our existing API v1 routers
app.include_router(router_sensors.router, prefix="/api/v1")
app.include_router(router_vision.router, prefix="/api/v1")
app.include_router(router_alerts.router, prefix="/api/v1")

# The root endpoint mapping you requested
@app.get("/")
def health_check():
    return {"status": "FastAPI & MQTT Active"}

