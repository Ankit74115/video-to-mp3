"""Send the "your mp3 is ready" email over SMTP (Gmail app password or any provider)."""

import json
import logging
import os
import smtplib
from email.message import EmailMessage

log = logging.getLogger("notification.email")

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM") or SMTP_USER
SMTP_TIMEOUT_SECONDS = float(os.environ.get("SMTP_TIMEOUT_SECONDS", "20"))
APP_URL = os.environ.get("APP_URL", "").rstrip("/")


def is_configured():
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)


def notification(body):
    """Returns None on success or an error string. Never raises."""
    try:
        message = json.loads(body)
        mp3_fid = message["mp3_fid"]
        receiver = message["username"]
    except (ValueError, KeyError, TypeError) as exc:
        return f"malformed message: {exc}"

    filename = message.get("filename") or "your video"

    if not is_configured():
        log.info("mp3 %s ready for %s (email skipped, SMTP not configured)", mp3_fid, receiver)
        return None

    lines = [
        f"Your MP3 for {filename} is ready.",
        "",
        f"File id: {mp3_fid}",
    ]
    if APP_URL:
        lines += ["", f"Download it from {APP_URL}"]

    msg = EmailMessage()
    msg.set_content("\n".join(lines))
    msg["Subject"] = f"MP3 ready: {filename}"
    msg["From"] = SMTP_FROM
    msg["To"] = receiver

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as session:
            session.starttls()
            session.login(SMTP_USER, SMTP_PASSWORD)
            session.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        return f"smtp error: {exc}"

    log.info("mail sent to %s for mp3 %s", receiver, mp3_fid)
    return None
