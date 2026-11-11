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
