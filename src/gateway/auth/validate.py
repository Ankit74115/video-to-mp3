"""Validate the caller's bearer token against the auth service."""

import logging
import os

import requests

log = logging.getLogger("gateway.auth")

AUTH_SVC_ADDRESS = os.environ.get("AUTH_SVC_ADDRESS", "auth:5000")
AUTH_TIMEOUT_SECONDS = float(os.environ.get("AUTH_TIMEOUT_SECONDS", "5"))


def token(request):
    """Returns (claims_dict, None) or (None, (error_text, status))."""
    header = request.headers.get("Authorization", "")
    if not header:
        return None, ("missing credentials", 401)

    try:
        response = requests.post(
            f"http://{AUTH_SVC_ADDRESS}/validate",
            headers={"Authorization": header},
            timeout=AUTH_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        log.error("auth service unreachable: %s", exc)
        return None, ("auth service unavailable", 503)

    if response.status_code != 200:
        return None, (_error_text(response), response.status_code)

    try:
        return response.json(), None
    except ValueError:
        return None, ("invalid response from auth service", 502)


def _error_text(response):
    try:
        return response.json().get("error", response.text)
    except ValueError:
        return response.text or "not authorized"
