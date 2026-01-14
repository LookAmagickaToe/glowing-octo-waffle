"""
Token management utilities for Gmail OAuth.
Handles token storage, retrieval, and refresh using Firestore.
"""

import os
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from google.cloud import firestore

PROJECT_ID = os.environ.get("PROJECT_ID", "waffle-mm")
TOKENS_COLLECTION = "gmail_tokens"


def get_firestore_client() -> firestore.Client:
    """Get Firestore client."""
    return firestore.Client(project=PROJECT_ID)


def get_client_credentials() -> tuple[str, str]:
    """Get OAuth client credentials from environment variables."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise ValueError("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set")

    return client_id, client_secret


def generate_uid() -> str:
    """Generate a new unique user ID."""
    return str(uuid.uuid4())


def store_tokens(
    uid: str,
    email: str,
    refresh_token: str,
    access_token: str,
    expires_in: int,
    scopes: list[str],
    name: Optional[str] = None,
    picture: Optional[str] = None,
) -> None:
    """Store OAuth tokens in Firestore."""
    db = get_firestore_client()
    expiry_time = datetime.utcnow() + timedelta(seconds=expires_in)

    db.collection(TOKENS_COLLECTION).document(uid).set({
        "uid": uid,
        "email": email,
        "name": name,
        "picture": picture,
        "refresh_token": refresh_token,
        "access_token": access_token,
        "access_token_expiry": expiry_time,
        "scopes": scopes,
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }, merge=True)


def get_tokens(uid: str) -> Optional[Dict[str, Any]]:
    """Retrieve tokens from Firestore."""
    db = get_firestore_client()
    doc = db.collection(TOKENS_COLLECTION).document(uid).get()

    if not doc.exists:
        return None

    return doc.to_dict()


def update_access_token(uid: str, access_token: str, expires_in: int) -> None:
    """Update access token after refresh."""
    db = get_firestore_client()
    expiry_time = datetime.utcnow() + timedelta(seconds=expires_in)

    db.collection(TOKENS_COLLECTION).document(uid).update({
        "access_token": access_token,
        "access_token_expiry": expiry_time,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })


def delete_tokens(uid: str) -> None:
    """Delete tokens (for logout/revoke)."""
    db = get_firestore_client()
    db.collection(TOKENS_COLLECTION).document(uid).delete()


def get_valid_access_token(uid: str) -> Optional[str]:
    """
    Get a valid access token, refreshing if necessary.
    Returns None if user not authenticated or refresh fails.
    """
    import requests

    tokens = get_tokens(uid)
    if not tokens:
        return None

    expiry = tokens.get("access_token_expiry")

    # Check if token is still valid (with 5 minute buffer)
    if expiry:
        # Handle Firestore timestamp
        if hasattr(expiry, 'timestamp'):
            expiry_dt = datetime.fromtimestamp(expiry.timestamp())
        else:
            expiry_dt = expiry

        if expiry_dt > datetime.utcnow() + timedelta(minutes=5):
            return tokens.get("access_token")

    # Token expired, refresh it
    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        return None

    try:
        client_id, client_secret = get_client_credentials()

        response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            timeout=30,
        )

        if not response.ok:
            return None

        new_tokens = response.json()
        new_access_token = new_tokens.get("access_token")
        expires_in = new_tokens.get("expires_in", 3600)

        # Update stored tokens
        update_access_token(uid, new_access_token, expires_in)

        return new_access_token

    except Exception:
        return None


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Find user by email address."""
    db = get_firestore_client()
    docs = db.collection(TOKENS_COLLECTION).where("email", "==", email).limit(1).stream()

    for doc in docs:
        return doc.to_dict()

    return None
