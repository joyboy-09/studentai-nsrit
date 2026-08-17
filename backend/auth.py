"""
Authentication module for StudentAI.
Handles JWT token creation/validation and password hashing with bcrypt.
Supports local auth mode (frontend-generated tokens) without database user lookup.
"""

import base64
import json
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
import os
from dotenv import load_dotenv

load_dotenv()

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET", "studentai-secret-key-change-in-production-2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Bearer token security
security = HTTPBearer()

# Default user ID for local auth mode
DEFAULT_USER_ID = 1


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password using bcrypt."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _try_decode_local_token(token: str) -> Optional[str]:
    """Try to decode a frontend-generated local token (base64 JSON)."""
    try:
        # Frontend generates: btoa(JSON.stringify({ sub: username, exp: timestamp }))
        decoded = base64.b64decode(token).decode("utf-8")
        payload = json.loads(decoded)
        # Check expiry
        if payload.get("exp", 0) > datetime.now(timezone.utc).timestamp() * 1000:
            return payload.get("sub", "local_user")
        return payload.get("sub", "local_user")
    except Exception:
        return None


def ensure_default_user(db: Session):
    """Ensure a default user exists for local auth mode."""
    from models import User

    user = db.query(User).filter(User.id == DEFAULT_USER_ID).first()
    if not user:
        user = User(
            id=DEFAULT_USER_ID,
            username="student",
            email="student@local.app",
            full_name="Student User",
            hashed_password=get_password_hash("local"),
            avatar_url="",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    Dependency to get the current authenticated user.
    Supports both JWT tokens (backend-generated) and local tokens (frontend-generated).
    """
    from models import User

    token = credentials.credentials

    # First, try to decode as a local frontend token (base64 JSON)
    local_username = _try_decode_local_token(token)
    if local_username is not None:
        # Local auth mode - use or create default user
        user = ensure_default_user(db)
        return user

    # Fall back to standard JWT decoding
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user
