"""API gateway: login, video upload, job status, mp3 download."""

import logging
import os
import sys
import time

import gridfs
from bson.errors import InvalidId
from bson.objectid import ObjectId
from flask import Flask, jsonify, request, send_file
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from werkzeug.exceptions import RequestEntityTooLarge

from auth import validate
from auth_svc import access
from storage import jobs as jobs_store
from storage import util

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("gateway")

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongodb:27017")
MONGO_DB = os.environ.get("MONGO_DB", "mp3converter")
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "100"))
STARTUP_RETRIES = int(os.environ.get("STARTUP_RETRIES", "30"))
STARTUP_RETRY_SECONDS = float(os.environ.get("STARTUP_RETRY_SECONDS", "2"))
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "")

server = Flask(__name__)
server.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024

if CORS_ORIGINS:
    from flask_cors import CORS

    CORS(server, origins=[o.strip() for o in CORS_ORIGINS.split(",") if o.strip()])


def connect_mongo():
    for attempt in range(1, STARTUP_RETRIES + 1):
        try:
            client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            client.admin.command("ping")
            log.info("MongoDB is reachable")
            return client
        except PyMongoError as exc:
            log.warning(
                "MongoDB not ready (attempt %s/%s): %s", attempt, STARTUP_RETRIES, exc
            )
            time.sleep(STARTUP_RETRY_SECONDS)
    log.error("Giving up waiting for MongoDB")
    sys.exit(1)


mongo = connect_mongo()
db = mongo[MONGO_DB]
fs_videos = gridfs.GridFS(db, collection="videos")
fs_mp3s = gridfs.GridFS(db, collection="mp3s")
jobs = jobs_store.JobStore(db)
util.ensure_queues()


def authenticate():
    """Return (claims, None) or (None, (json_response, status))."""
    claims, err = validate.token(request)
    if err:
        body, status = err
        return None, (jsonify({"error": body}), status)
    if not claims.get("admin"):
        return None, (jsonify({"error": "not authorized"}), 401)
    return claims, None


@server.errorhandler(RequestEntityTooLarge)
def too_large(_):
    return jsonify({"error": f"file exceeds {MAX_UPLOAD_MB} MB limit"}), 413


@server.errorhandler(404)
def not_found(_):
    return jsonify({"error": "not found"}), 404


@server.errorhandler(405)
def method_not_allowed(_):
    return jsonify({"error": "method not allowed"}), 405


@server.route("/", methods=["GET"])
def index():
    return jsonify(
        {
            "service": "trackbay gateway",
            "endpoints": {
                "GET /health": "liveness and MongoDB check",
                "POST /login": "Basic auth, returns a JWT",
                "POST /register": "JSON email and password, creates an account and returns a JWT",
                "POST /upload": "multipart field 'file', Bearer token",
                "GET /jobs": "list your conversion jobs",
                "GET /jobs/<job_id>": "one job with status",
                "GET /download?fid=": "download a finished mp3",
            },
        }
    )


@server.route("/health", methods=["GET"])
def health():
    try:
        mongo.admin.command("ping")
    except PyMongoError:
        return jsonify({"status": "degraded", "mongodb": "unreachable"}), 503
    return jsonify({"status": "ok"}), 200


@server.route("/login", methods=["POST"])
def login():
    token, err = access.login(request)
    if err:
        body, status = err
        return jsonify({"error": body}), status
    return jsonify({"token": token}), 200


@server.route("/register", methods=["POST"])
def register():
    token, err = access.register(request)
    if err:
        body, status = err
        return jsonify({"error": body}), status
    return jsonify({"token": token}), 201


@server.route("/upload", methods=["POST"])
def upload():
    claims, err = authenticate()
    if err:
        return err

    if len(request.files) != 1 or "file" not in request.files:
        return jsonify({"error": "exactly one file field named file is required"}), 400

    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "file has no name"}), 400

    result, err = util.upload(f, fs_videos, jobs, claims["username"])
    if err:
        body, status = err
        return jsonify({"error": body}), status
    return jsonify(result), 200


@server.route("/jobs", methods=["GET"])
def list_jobs():
    claims, err = authenticate()
    if err:
        return err
    return jsonify({"jobs": jobs.list_for_user(claims["username"])}), 200


@server.route("/jobs/<job_id>", methods=["GET"])
def get_job(job_id):
    claims, err = authenticate()
    if err:
        return err
    job = jobs.get_for_user(job_id, claims["username"])
    if job is None:
        return jsonify({"error": "job not found"}), 404
    return jsonify(job), 200


@server.route("/download", methods=["GET"])
def download():
    claims, err = authenticate()
    if err:
        return err

    fid_string = request.args.get("fid")
    if not fid_string:
        return jsonify({"error": "fid is required"}), 400

    try:
        fid = ObjectId(fid_string)
    except (InvalidId, TypeError):
        return jsonify({"error": "invalid fid"}), 400

    job = jobs.get_by_mp3_fid(fid_string, claims["username"])
    if job is None:
        return jsonify({"error": "mp3 not found"}), 404

    try:
        out = fs_mp3s.get(fid)
    except gridfs.errors.NoFile:
        return jsonify({"error": "mp3 not found"}), 404
    except PyMongoError as exc:
        log.error("download failed: %s", exc)
        return jsonify({"error": "internal server error"}), 500

    base = os.path.splitext(job.get("filename") or fid_string)[0]
    return send_file(
        out,
        mimetype="audio/mpeg",
        as_attachment=True,
        download_name=f"{base}.mp3",
    )


if __name__ == "__main__":
    server.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
