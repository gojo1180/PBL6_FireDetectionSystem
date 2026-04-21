"""
Server-Sent Events (SSE) streaming endpoint for real-time dashboard updates.
Replaces frontend polling with a persistent HTTP connection that pushes
new sensor_logs and fusion_alerts to the client every 3 seconds.
"""

import asyncio
import json
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from jose import jwt, JWTError

from core.database import supabase

# Must match the constants in router_auth.py / core/security.py
SECRET_KEY = "fastapi-secret-key-for-jwt-dev"
ALGORITHM = "HS256"

router = APIRouter(prefix="/stream", tags=["Streaming"])


# ---------------------------------------------------------------------------
# JWT dependency for SSE (query-param based)
# Browser EventSource cannot attach Authorization headers, so we accept
# the token as a query parameter instead.
# ---------------------------------------------------------------------------
def get_current_user_from_token(token: str = Query(..., description="JWT access token")) -> dict:
    """Validate a JWT passed as a query parameter and return the user payload."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str | None = payload.get("sub")
        user_id: str | None = payload.get("user_id")
        if email is None or user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )
        return {"email": email, "user_id": user_id}
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or expired",
        )


# ---------------------------------------------------------------------------
# SSE endpoint
# ---------------------------------------------------------------------------
@router.get("/dashboard")
async def stream_dashboard(
    token: str = Query(..., description="JWT access token"),
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
):
    """
    SSE endpoint that streams the latest 20 sensor logs and all active
    (unresolved) fusion alerts.  Optionally filtered by `device_id`.

    Usage from the browser:
        const es = new EventSource("/api/v1/stream/dashboard?token=<jwt>&device_id=<optional>");
        es.onmessage = (e) => { const data = JSON.parse(e.data); ... };
    """
    # Validate the JWT *before* opening the stream so the client gets a
    # clear 401 instead of a broken SSE connection.
    get_current_user_from_token(token)

    async def event_generator():
        """Async generator that yields SSE-formatted JSON payloads."""
        while True:
            try:
                # --- Fetch latest sensor logs ---
                sensor_query = supabase.table("sensor_logs").select("*")
                if device_id:
                    sensor_query = sensor_query.eq("device_id", device_id)
                sensor_response = (
                    sensor_query
                    .order("recorded_at", desc=True)
                    .limit(20)
                    .execute()
                )

                # --- Fetch active (unresolved) fusion alerts ---
                alert_query = supabase.table("fusion_alerts").select("*").eq("is_resolved", False)
                if device_id:
                    alert_query = alert_query.eq("device_id", device_id)
                alert_response = (
                    alert_query
                    .order("triggered_at", desc=True)
                    .execute()
                )

                # --- Build SSE payload ---
                payload = {
                    "sensor_logs": sensor_response.data,
                    "fusion_alerts": alert_response.data,
                }
                json_data = json.dumps(payload, default=str)
                yield f"data: {json_data}\n\n"

            except Exception as e:
                # Push the error to the client so it can handle / log it
                error_payload = json.dumps({"error": str(e)})
                yield f"data: {error_payload}\n\n"

            # Throttle: wait 3 seconds before the next DB poll
            await asyncio.sleep(3)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Prevents Nginx from buffering the stream
        },
    )
