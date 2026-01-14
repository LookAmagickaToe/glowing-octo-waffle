"""
Gmail OAuth Cloud Functions.
Handles OAuth flow initiation and token exchange.
"""

import json
import secrets
import hashlib
import base64
from urllib.parse import urlencode

import functions_framework
import requests
from flask import Request

from token_manager import (
    get_client_credentials,
    generate_uid,
    store_tokens,
    get_user_by_email,
    delete_tokens,
    get_tokens,
)

PROJECT_ID = "waffle-mm"

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.modify",
    "openid",
    "email",
    "profile",
]


def cors_headers(request: Request) -> dict:
    """Generate CORS headers."""
    origin = request.headers.get("Origin", "*")
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "3600",
    }


def handle_cors(request: Request):
    """Handle CORS preflight."""
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))
    return None


def generate_pkce_pair() -> tuple[str, str]:
    """Generate PKCE code verifier and challenge."""
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode()).digest()
    ).rstrip(b"=").decode("ascii")
    return code_verifier, code_challenge


@functions_framework.http
def gmail_auth_init(request: Request):
    """
    Initialize OAuth flow.
    Returns authorization URL with PKCE parameters.
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    try:
        request_json = request.get_json(silent=True) or {}
        redirect_uri = request_json.get("redirect_uri", "http://localhost:8080/auth/callback")

        # Generate PKCE pair
        code_verifier, code_challenge = generate_pkce_pair()

        # Generate state for CSRF protection
        state = secrets.token_urlsafe(32)

        client_id, _ = get_client_credentials()

        auth_params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }

        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(auth_params)}"

        return (
            json.dumps({
                "auth_url": auth_url,
                "state": state,
                "code_verifier": code_verifier,
            }),
            200,
            headers,
        )

    except Exception as e:
        return (
            json.dumps({"error": str(e)}),
            500,
            headers,
        )


@functions_framework.http
def gmail_auth_callback(request: Request):
    """
    Exchange authorization code for tokens.
    Stores tokens in Firestore and returns session info.
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            return (json.dumps({"error": "Request body required"}), 400, headers)

        code = request_json.get("code")
        code_verifier = request_json.get("code_verifier")
        redirect_uri = request_json.get("redirect_uri")

        if not all([code, code_verifier, redirect_uri]):
            return (json.dumps({"error": "Missing required parameters"}), 400, headers)

        client_id, client_secret = get_client_credentials()

        # Exchange code for tokens
        token_response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": code_verifier,
            },
            timeout=30,
        )

        if not token_response.ok:
            return (
                json.dumps({
                    "error": "Token exchange failed",
                    "details": token_response.json(),
                }),
                400,
                headers,
            )

        tokens = token_response.json()

        # Get user info
        userinfo_response = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
            timeout=30,
        )

        if not userinfo_response.ok:
            return (json.dumps({"error": "Failed to get user info"}), 400, headers)

        user_info = userinfo_response.json()
        user_email = user_info.get("email")
        user_name = user_info.get("name")
        user_picture = user_info.get("picture")

        # Check if user already exists
        existing_user = get_user_by_email(user_email)
        uid = existing_user.get("uid") if existing_user else generate_uid()

        # Store tokens
        store_tokens(
            uid=uid,
            email=user_email,
            refresh_token=tokens.get("refresh_token"),
            access_token=tokens.get("access_token"),
            expires_in=tokens.get("expires_in", 3600),
            scopes=tokens.get("scope", "").split(),
            name=user_name,
            picture=user_picture,
        )

        return (
            json.dumps({
                "success": True,
                "user": {
                    "uid": uid,
                    "email": user_email,
                    "name": user_name,
                    "picture": user_picture,
                },
                "session_token": uid,
                "expires_in": tokens.get("expires_in"),
            }),
            200,
            headers,
        )

    except Exception as e:
        return (json.dumps({"error": str(e)}), 500, headers)


@functions_framework.http
def gmail_auth_status(request: Request):
    """Check authentication status for a user."""
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return (json.dumps({"authenticated": False}), 200, headers)

    uid = auth_header.replace("Bearer ", "")
    tokens = get_tokens(uid)

    if not tokens:
        return (json.dumps({"authenticated": False}), 200, headers)

    return (
        json.dumps({
            "authenticated": True,
            "user": {
                "uid": tokens.get("uid"),
                "email": tokens.get("email"),
                "name": tokens.get("name"),
                "picture": tokens.get("picture"),
            },
        }),
        200,
        headers,
    )


@functions_framework.http
def gmail_auth_revoke(request: Request):
    """Revoke tokens and logout."""
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return (json.dumps({"error": "Unauthorized"}), 401, headers)

    uid = auth_header.replace("Bearer ", "")

    try:
        tokens = get_tokens(uid)
        if tokens and tokens.get("access_token"):
            # Revoke token with Google
            requests.post(
                "https://oauth2.googleapis.com/revoke",
                params={"token": tokens["access_token"]},
                timeout=30,
            )

        # Delete from Firestore
        delete_tokens(uid)

        return (json.dumps({"success": True}), 200, headers)

    except Exception as e:
        return (json.dumps({"error": str(e)}), 500, headers)
