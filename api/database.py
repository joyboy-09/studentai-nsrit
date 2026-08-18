"""
Database configuration for StudentAI.
Uses Firebase Realtime Database as the backend.
"""

import os
import json
import firebase_admin
from firebase_admin import credentials, db as firebase_db
from dotenv import load_dotenv

load_dotenv()

_initialized = False


def _init_firebase():
    """Initialize Firebase Admin SDK."""
    global _initialized
    if _initialized:
        return

    database_url = os.getenv("FIREBASE_DATABASE_URL", "")
    service_account_path = os.getenv(
        "FIREBASE_SERVICE_ACCOUNT_KEY",
        os.path.join(os.path.dirname(__file__), "serviceAccountKey.json"),
    )

    if not database_url:
        raise RuntimeError(
            "FIREBASE_DATABASE_URL is not set. "
            "Add it to your .env file, e.g.: "
            "FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com"
        )

    cred = None
    if os.path.exists(service_account_path):
        cred = credentials.Certificate(service_account_path)
    else:
        # Try loading from environment variable as JSON string
        sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if sa_json:
            cred = credentials.Certificate(json.loads(sa_json))
        else:
            raise RuntimeError(
                f"Firebase service account key not found at '{service_account_path}' "
                "and FIREBASE_SERVICE_ACCOUNT_JSON env var is not set."
            )

    firebase_admin.initialize_app(cred, {"databaseURL": database_url})
    _initialized = True
    print("✅ Firebase Realtime Database connected!")


def get_db_ref(path: str = "/"):
    """Get a Firebase Realtime Database reference for the given path."""
    _init_firebase()
    return firebase_db.reference(path)


def get_next_id(collection: str) -> int:
    """
    Generate an auto-incrementing integer ID for a collection.
    Uses a /counters/{collection} node in Firebase.
    """
    _init_firebase()
    counter_ref = firebase_db.reference(f"/counters/{collection}")
    current = counter_ref.get() or 0
    next_id = current + 1
    counter_ref.set(next_id)
    return next_id


def init_db():
    """Initialize Firebase connection and ensure default data exists."""
    _init_firebase()
    print("✅ Firebase database initialized!")
