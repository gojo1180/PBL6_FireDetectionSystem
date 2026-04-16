"""
Shared JWT authentication dependency.
Used by all protected API routers via: current_user = Depends(get_current_user)
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

# Must match the constants in router_auth.py
SECRET_KEY = "fastapi-secret-key-for-jwt-dev"
ALGORITHM = "HS256"

security_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> dict:
    """
    Decode and validate the JWT token from the Authorization header.
    Returns the decoded payload dict containing 'sub' (email) and 'user_id'.
    """
    token = credentials.credentials
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
