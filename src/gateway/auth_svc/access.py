"""Forward login and registration to the auth service."""

import logging
import os

import requests

log = logging.getLogger("gateway.auth_svc")

AUTH_SVC_ADDRESS = os.environ.get("AUTH_SVC_ADDRESS", "auth:5000")
AUTH_TIMEOUT_SECONDS = float(os.environ.get("AUTH_TIMEOUT_SECONDS", "5"))


def login(request):
    """Returns (token, None) or (None, (error_text, status))."""
    auth = request.authorization
    if not auth or not auth.username or not auth.password:
        return None, ("missing credentials", 401)

    try:
        response = requests.post(
            f"http://{AUTH_SVC_ADDRESS}/login",
            auth=(auth.username, auth.password),
            timeout=AUTH_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        log.error("auth service unreachable: %s", exc)
        return None, ("auth service unavailable", 503)

    if response.status_code != 200:
        try:
            msg = response.json().get("error", response.text)
        except ValueError:
            msg = response.text or "invalid credentials"
        return None, (msg, response.status_code)

    try:
        return response.json()["token"], None
    except (ValueError, KeyError):
        return None, ("invalid response from auth service", 502)


def register(request):
    """Returns (token, None) or (None, (error_text, status))."""
    body = request.get_json(silent=True) or {}
    email = str(body.get("email", "")).strip()
    password = str(body.get("password", ""))
    if not email or not password:
        return None, ("email and password are required", 400)

    try:
        response = requests.post(
            f"http://{AUTH_SVC_ADDRESS}/register",
            json={"email": email, "password": password},
            timeout=AUTH_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        log.error("auth service unreachable: %s", exc)
        return None, ("auth service unavailable", 503)

    if response.status_code != 201:
        try:
            msg = response.json().get("error", response.text)
        except ValueError:
            msg = response.text or "could not create account"
        return None, (msg, response.status_code)

    try:
        return response.json()["token"], None
    except (ValueError, KeyError):
        return None, ("invalid response from auth service", 502)
