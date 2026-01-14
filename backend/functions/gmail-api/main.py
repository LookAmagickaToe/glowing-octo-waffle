"""
Gmail API Cloud Functions.
Proxy for Gmail API operations: list, read, send, drafts, labels.
"""

import json
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import functions_framework
import requests
from flask import Request

from token_manager import get_valid_access_token

GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"


def cors_headers(request: Request) -> dict:
    """Generate CORS headers."""
    origin = request.headers.get("Origin", "*")
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "3600",
    }


def handle_cors(request: Request):
    """Handle CORS preflight."""
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))
    return None


def get_auth_token(request: Request) -> tuple[str, dict] | tuple[None, tuple]:
    """Extract and validate auth token from request."""
    headers = {**cors_headers(request), "Content-Type": "application/json"}

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, (json.dumps({"error": "Unauthorized"}), 401, headers)

    uid = auth_header.replace("Bearer ", "")
    access_token = get_valid_access_token(uid)

    if not access_token:
        return None, (json.dumps({"error": "Session expired"}), 401, headers)

    return access_token, headers


@functions_framework.http
def gmail_messages(request: Request):
    """List Gmail messages."""
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    result = get_auth_token(request)
    if result[0] is None:
        return result[1]

    access_token, headers = result

    # Get query parameters
    label_ids = request.args.get("labelIds", "INBOX")
    max_results = request.args.get("maxResults", "20")
    page_token = request.args.get("pageToken", "")
    q = request.args.get("q", "")

    params = {
        "labelIds": label_ids,
        "maxResults": max_results,
    }
    if page_token:
        params["pageToken"] = page_token
    if q:
        params["q"] = q

    try:
        response = requests.get(
            f"{GMAIL_API_BASE}/messages",
            headers={"Authorization": f"Bearer {access_token}"},
            params=params,
            timeout=30,
        )

        if not response.ok:
            return (
                json.dumps({"error": "Gmail API error", "details": response.json()}),
                response.status_code,
                headers,
            )

        return (json.dumps(response.json()), 200, headers)

    except Exception as e:
        return (json.dumps({"error": str(e)}), 500, headers)


@functions_framework.http
def gmail_message(request: Request):
    """Get a single Gmail message with full content."""
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    result = get_auth_token(request)
    if result[0] is None:
        return result[1]

    access_token, headers = result

    message_id = request.args.get("id")
    if not message_id:
        return (json.dumps({"error": "Message ID required"}), 400, headers)

    format_type = request.args.get("format", "full")

    try:
        response = requests.get(
            f"{GMAIL_API_BASE}/messages/{message_id}",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"format": format_type},
            timeout=30,
        )

        if not response.ok:
            return (
                json.dumps({"error": "Gmail API error", "details": response.json()}),
                response.status_code,
                headers,
            )

        return (json.dumps(response.json()), 200, headers)

    except Exception as e:
        return (json.dumps({"error": str(e)}), 500, headers)


@functions_framework.http
def gmail_send(request: Request):
    """Send an email."""
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    result = get_auth_token(request)
    if result[0] is None:
        return result[1]

    access_token, headers = result

    request_json = request.get_json(silent=True)
    if not request_json:
        return (json.dumps({"error": "Request body required"}), 400, headers)

    to = request_json.get("to")
    subject = request_json.get("subject", "")
    body = request_json.get("body", "")
    cc = request_json.get("cc", "")
    bcc = request_json.get("bcc", "")
    thread_id = request_json.get("threadId")
    html_body = request_json.get("htmlBody")

    if not to:
        return (json.dumps({"error": "Recipient (to) required"}), 400, headers)

    try:
        # Build email message
        if html_body:
            message = MIMEMultipart("alternative")
            message.attach(MIMEText(body, "plain"))
            message.attach(MIMEText(html_body, "html"))
        else:
            message = MIMEText(body, "plain")

        message["to"] = to
        message["subject"] = subject
        if cc:
            message["cc"] = cc
        if bcc:
            message["bcc"] = bcc

        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")

        send_body = {"raw": raw_message}
        if thread_id:
            send_body["threadId"] = thread_id

        response = requests.post(
            f"{GMAIL_API_BASE}/messages/send",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json=send_body,
            timeout=30,
        )

        if not response.ok:
            return (
                json.dumps({"error": "Failed to send email", "details": response.json()}),
                response.status_code,
                headers,
            )

        return (json.dumps(response.json()), 200, headers)

    except Exception as e:
        return (json.dumps({"error": str(e)}), 500, headers)


@functions_framework.http
def gmail_labels(request: Request):
    """List Gmail labels."""
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    result = get_auth_token(request)
    if result[0] is None:
        return result[1]

    access_token, headers = result

    try:
        response = requests.get(
            f"{GMAIL_API_BASE}/labels",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30,
        )

        if not response.ok:
            return (
                json.dumps({"error": "Gmail API error", "details": response.json()}),
                response.status_code,
                headers,
            )

        return (json.dumps(response.json()), 200, headers)

    except Exception as e:
        return (json.dumps({"error": str(e)}), 500, headers)


@functions_framework.http
def gmail_drafts(request: Request):
    """List or create drafts."""
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    result = get_auth_token(request)
    if result[0] is None:
        return result[1]

    access_token, headers = result

    try:
        if request.method == "GET":
            # List drafts
            response = requests.get(
                f"{GMAIL_API_BASE}/drafts",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=30,
            )
        elif request.method == "POST":
            # Create draft
            request_json = request.get_json(silent=True)
            if not request_json:
                return (json.dumps({"error": "Request body required"}), 400, headers)

            to = request_json.get("to", "")
            subject = request_json.get("subject", "")
            body = request_json.get("body", "")

            message = MIMEText(body, "plain")
            message["to"] = to
            message["subject"] = subject

            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")

            response = requests.post(
                f"{GMAIL_API_BASE}/drafts",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={"message": {"raw": raw_message}},
                timeout=30,
            )
        else:
            return (json.dumps({"error": "Method not allowed"}), 405, headers)

        if not response.ok:
            return (
                json.dumps({"error": "Gmail API error", "details": response.json()}),
                response.status_code,
                headers,
            )

        return (json.dumps(response.json()), 200, headers)

    except Exception as e:
        return (json.dumps({"error": str(e)}), 500, headers)


@functions_framework.http
def gmail_draft(request: Request):
    """Get, update, or delete a specific draft."""
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    result = get_auth_token(request)
    if result[0] is None:
        return result[1]

    access_token, headers = result

    draft_id = request.args.get("id")
    if not draft_id:
        return (json.dumps({"error": "Draft ID required"}), 400, headers)

    try:
        if request.method == "GET":
            response = requests.get(
                f"{GMAIL_API_BASE}/drafts/{draft_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=30,
            )
        elif request.method == "DELETE":
            response = requests.delete(
                f"{GMAIL_API_BASE}/drafts/{draft_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=30,
            )
            if response.status_code == 204:
                return (json.dumps({"success": True}), 200, headers)
        elif request.method == "PUT":
            request_json = request.get_json(silent=True)
            if not request_json:
                return (json.dumps({"error": "Request body required"}), 400, headers)

            to = request_json.get("to", "")
            subject = request_json.get("subject", "")
            body = request_json.get("body", "")

            message = MIMEText(body, "plain")
            message["to"] = to
            message["subject"] = subject

            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")

            response = requests.put(
                f"{GMAIL_API_BASE}/drafts/{draft_id}",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={"message": {"raw": raw_message}},
                timeout=30,
            )
        else:
            return (json.dumps({"error": "Method not allowed"}), 405, headers)

        if not response.ok:
            return (
                json.dumps({"error": "Gmail API error", "details": response.json()}),
                response.status_code,
                headers,
            )

        return (json.dumps(response.json()), 200, headers)

    except Exception as e:
        return (json.dumps({"error": str(e)}), 500, headers)


@functions_framework.http
def gmail_modify(request: Request):
    """Modify message labels (mark read/unread, archive, etc.)."""
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    result = get_auth_token(request)
    if result[0] is None:
        return result[1]

    access_token, headers = result

    message_id = request.args.get("id")
    if not message_id:
        return (json.dumps({"error": "Message ID required"}), 400, headers)

    request_json = request.get_json(silent=True)
    if not request_json:
        return (json.dumps({"error": "Request body required"}), 400, headers)

    add_labels = request_json.get("addLabelIds", [])
    remove_labels = request_json.get("removeLabelIds", [])

    try:
        response = requests.post(
            f"{GMAIL_API_BASE}/messages/{message_id}/modify",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json={
                "addLabelIds": add_labels,
                "removeLabelIds": remove_labels,
            },
            timeout=30,
        )

        if not response.ok:
            return (
                json.dumps({"error": "Gmail API error", "details": response.json()}),
                response.status_code,
                headers,
            )

        return (json.dumps(response.json()), 200, headers)

    except Exception as e:
        return (json.dumps({"error": str(e)}), 500, headers)
