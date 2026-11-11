"""Extract the audio track from a stored video with ffmpeg and store it as mp3."""

import datetime
import json
import logging
import os
import shutil
import subprocess
import tempfile

import pika
from bson.errors import InvalidId
from bson.objectid import ObjectId

log = logging.getLogger("converter.to_mp3")

FFMPEG_BIN = os.environ.get("FFMPEG_BIN", "ffmpeg")
FFMPEG_TIMEOUT_SECONDS = int(os.environ.get("FFMPEG_TIMEOUT_SECONDS", "900"))
MP3_BITRATE = os.environ.get("MP3_BITRATE", "192k")
DELETE_SOURCE_VIDEO = os.environ.get("DELETE_SOURCE_VIDEO", "false").lower() == "true"


def _now():
    return datetime.datetime.now(tz=datetime.timezone.utc)


def _set_status(jobs, job_id, status, **extra):
    if not job_id:
        return
    try:
        jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": status, "updated_at": _now(), **extra}},
        )
    except (InvalidId, TypeError) as exc:
        log.warning("bad job id %r: %s", job_id, exc)


def start(message, fs_videos, fs_mp3s, jobs, channel, mp3_queue):
    """Returns None on success or an error string on failure."""
    try:
        message = json.loads(message)
        video_fid = ObjectId(message["video_fid"])
    except (ValueError, KeyError, InvalidId, TypeError) as exc:
        return f"malformed message: {exc}"

    job_id = message.get("job_id")
    _set_status(jobs, job_id, "processing")

    workdir = tempfile.mkdtemp(prefix="convert-")
    video_path = os.path.join(workdir, "input")
    mp3_path = os.path.join(workdir, "output.mp3")

    try:
        # Stream the video to disk instead of reading it all into memory.
        try:
            with fs_videos.get(video_fid) as src, open(video_path, "wb") as dst:
                shutil.copyfileobj(src, dst, length=1024 * 1024)
        except Exception as exc:  # noqa: BLE001
            _set_status(jobs, job_id, "failed", error="video not found in storage")
            return f"could not read video {video_fid}: {exc}"

        cmd = [
            FFMPEG_BIN,
            "-hide_banner",
            "-loglevel", "error",
            "-nostdin",
            "-y",
            "-i", video_path,
            "-vn",
            "-acodec", "libmp3lame",
            "-b:a", MP3_BITRATE,
            mp3_path,
        ]
        log.info("job %s: running ffmpeg on %s", job_id, video_fid)
        try:
            proc = subprocess.run(
                cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT_SECONDS
            )
        except subprocess.TimeoutExpired:
            _set_status(jobs, job_id, "failed", error="conversion timed out")
            return "ffmpeg timed out"

        if proc.returncode != 0 or not os.path.exists(mp3_path):
            detail = (proc.stderr or "").strip().splitlines()
            reason = detail[-1] if detail else "ffmpeg failed"
            _set_status(jobs, job_id, "failed", error=f"conversion failed: {reason[:200]}")
            return f"ffmpeg exited {proc.returncode}: {reason}"

        try:
            base = os.path.splitext(message.get("filename") or str(video_fid))[0]
            with open(mp3_path, "rb") as f:
                mp3_fid = fs_mp3s.put(
                    f,
                    filename=f"{base}.mp3",
                    content_type="audio/mpeg",
                    owner=message.get("username"),
                    video_fid=str(video_fid),
                )
        except Exception as exc:  # noqa: BLE001
            _set_status(jobs, job_id, "failed", error="could not store mp3")
            return f"GridFS put failed: {exc}"
    finally:
        shutil.rmtree(workdir, ignore_errors=True)

    message["mp3_fid"] = str(mp3_fid)

    try:
        channel.basic_publish(
            exchange="",
            routing_key=mp3_queue,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE,
                content_type="application/json",
            ),
        )
    except Exception as exc:  # noqa: BLE001
        fs_mp3s.delete(mp3_fid)
        _set_status(jobs, job_id, "failed", error="could not queue notification")
        return f"failed to publish mp3 message: {exc}"

    _set_status(jobs, job_id, "done", mp3_fid=str(mp3_fid), error=None)

    if DELETE_SOURCE_VIDEO:
        try:
            fs_videos.delete(video_fid)
        except Exception as exc:  # noqa: BLE001
            log.warning("could not delete source video %s: %s", video_fid, exc)

    log.info("job %s: done, mp3 %s", job_id, mp3_fid)
    return None
