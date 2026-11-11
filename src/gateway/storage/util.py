"""Upload helper: store the video in GridFS, record a job, publish to RabbitMQ."""

import json
import logging
import os

import pika

from storage import rabbit

log = logging.getLogger("gateway.storage")

VIDEO_QUEUE = os.environ.get("VIDEO_QUEUE", "video")
MP3_QUEUE = os.environ.get("MP3_QUEUE", "mp3")


def ensure_queues():
    """Declare the durable queues so consumers and publishers agree on them."""

    def declare(ch):
        ch.queue_declare(queue=VIDEO_QUEUE, durable=True)
        ch.queue_declare(queue=MP3_QUEUE, durable=True)

    rabbit.with_channel(declare)
    log.info("Declared queues %s and %s", VIDEO_QUEUE, MP3_QUEUE)


SNIFF_BYTES = 512


def _looks_like_text(head):
    return bool(head) and all(32 <= b < 127 or b in (9, 10, 13) for b in head)


# Container / codec signatures ffmpeg can read, written as hex so they stay readable.
MKV_WEBM = bytes.fromhex("1a45dfa3")
FLV = b"FLV" + bytes.fromhex("01")
ASF_WMV = bytes.fromhex("3026b275")
MPEG_PS = (bytes.fromhex("000001ba"), bytes.fromhex("000001b3"))
MP3_FRAME = (bytes.fromhex("fffb"), bytes.fromhex("fff3"), bytes.fromhex("fff2"))


def _is_known_media(head):
    """True when the first bytes carry a container signature ffmpeg can read."""
    if len(head) < 12:
        return False
    return (
        head[4:8] == b"ftyp"  # mp4, mov, m4v, 3gp
        or head[:4] == MKV_WEBM
        or (head[:4] == b"RIFF" and head[8:12] in (b"AVI ", b"WAVE"))
        or head[:4] == FLV
        or head[:4] == b"OggS"
        or head[:4] == ASF_WMV
        or head[:4] in MPEG_PS
        or (head[0] == 0x47 and len(head) > 188 and head[188] == 0x47)  # mpeg-ts
        or head[:3] == b"ID3"
        or head[:2] in MP3_FRAME
        or head[:4] == b"fLaC"
    )


def check_media(f):
    """Reject empty files and things that are obviously not media. Returns None or (error_text, status)."""
    head = f.stream.read(SNIFF_BYTES)
    f.stream.seek(0)
    if not head:
        return "the file is empty", 400
    if _is_known_media(head):
        return None
    lowered = head.lstrip().lower()
    if lowered.startswith((b"<!doctype", b"<html", b"<?xml", b"<head", b"<body")):
        return (
            "that file is a web page, not a video; download the actual video "
            "file and try again"
        ), 415
    if _looks_like_text(head):
        return "that file is plain text, not a video", 415
    # Unknown signature but binary: let ffmpeg decide.
    return None


def upload(f, fs, jobs, username):
    """Returns (result_dict, None) or (None, (error_text, status))."""
    try:
        fid = fs.put(f, filename=f.filename, content_type=f.mimetype, owner=username)
    except Exception as exc:  # noqa: BLE001
        log.error("GridFS put failed: %s", exc)
        return None, ("internal server error", 500)

    try:
        job_id = jobs.create(username=username, video_fid=str(fid), filename=f.filename)
    except Exception as exc:  # noqa: BLE001
        log.error("job insert failed: %s", exc)
        fs.delete(fid)
        return None, ("internal server error", 500)

    message = {
        "job_id": job_id,
        "video_fid": str(fid),
        "mp3_fid": None,
        "username": username,
        "filename": f.filename,
    }

    def publish(ch):
        ch.basic_publish(
            exchange="",
            routing_key=VIDEO_QUEUE,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE,
                content_type="application/json",
            ),
        )

    try:
        rabbit.with_channel(publish, retries=3)
    except Exception as exc:  # noqa: BLE001
        log.error("publish failed: %s", exc)
        fs.delete(fid)
        jobs.delete(job_id)
        return None, ("internal server error", 500)

    log.info("queued job %s for %s (%s)", job_id, username, f.filename)
    return {
        "job_id": job_id,
        "video_fid": str(fid),
        "filename": f.filename,
        "status": "queued",
    }, None
