#!/usr/bin/env python3
"""End-to-end smoke test: login, upload a video, wait for conversion, download the mp3.

Usage:
    python scripts/smoke_test.py path/to/video.mp4 [--api http://localhost:8080]
                                 [--email demo@example.com] [--password ...]

Credentials default to DEMO_USER_EMAIL / DEMO_USER_PASSWORD from the environment
(or from a .env file in the repo root). Standard library only.
"""

import argparse
import base64
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request
import uuid


def load_dotenv(path):
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def request(method, url, headers=None, data=None):
    req = urllib.request.Request(url, method=method, data=data, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            return resp.status, resp.headers, resp.read()
    except urllib.error.HTTPError as err:
        return err.code, err.headers, err.read()


def fail(msg):
    print(f"FAIL: {msg}")
    sys.exit(1)


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(root, ".env"))

    parser = argparse.ArgumentParser()
    parser.add_argument("video")
    parser.add_argument("--api", default=os.environ.get("API_URL", "http://localhost:8080"))
    parser.add_argument("--email", default=os.environ.get("DEMO_USER_EMAIL"))
    parser.add_argument("--password", default=os.environ.get("DEMO_USER_PASSWORD"))
    parser.add_argument("--timeout", type=int, default=300, help="seconds to wait for conversion")
    parser.add_argument("--out", default=None, help="where to save the mp3")
    args = parser.parse_args()

    if not args.email or not args.password:
        fail("no credentials: pass --email/--password or set DEMO_USER_EMAIL/DEMO_USER_PASSWORD")
    if not os.path.isfile(args.video):
        fail(f"video not found: {args.video}")

    api = args.api.rstrip("/")

    # 1. health
    status, _, body = request("GET", f"{api}/health")
    print(f"health      -> {status} {body.decode(errors='replace').strip()}")
    if status != 200:
        fail("gateway not healthy")

    # 2. login
    basic = base64.b64encode(f"{args.email}:{args.password}".encode()).decode()
    status, _, body = request("POST", f"{api}/login", {"Authorization": f"Basic {basic}"})
    print(f"login       -> {status}")
    if status != 200:
        fail(f"login failed: {body.decode(errors='replace')}")
    token = json.loads(body)["token"]
    bearer = {"Authorization": f"Bearer {token}"}

    # 3. upload (multipart by hand)
    boundary = uuid.uuid4().hex
    filename = os.path.basename(args.video)
    ctype = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    with open(args.video, "rb") as fh:
        content = fh.read()
    parts = [
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode(),
        f"Content-Type: {ctype}\r\n\r\n".encode(),
        content,
        f"\r\n--{boundary}--\r\n".encode(),
    ]
    payload = b"".join(parts)
    headers = {**bearer, "Content-Type": f"multipart/form-data; boundary={boundary}"}
    status, _, body = request("POST", f"{api}/upload", headers, payload)
    print(f"upload      -> {status} {body.decode(errors='replace').strip()}")
    if status != 200:
        fail("upload failed")
    job_id = json.loads(body)["job_id"]

    # 4. poll job
    deadline = time.time() + args.timeout
    job = None
    while time.time() < deadline:
        status, _, body = request("GET", f"{api}/jobs/{job_id}", bearer)
        if status != 200:
            fail(f"job lookup failed: {status} {body.decode(errors='replace')}")
        job = json.loads(body)
        print(f"job status  -> {job['status']}")
        if job["status"] in ("done", "failed"):
            break
        time.sleep(2)
    if job is None or job["status"] != "done":
        fail(f"conversion did not finish: {job}")

    # 5. download
    status, headers, body = request("GET", f"{api}/download?fid={job['mp3_fid']}", bearer)
    print(f"download    -> {status} {headers.get('Content-Type')} {len(body)} bytes")
    if status != 200 or len(body) == 0:
        fail("download failed")
    out = args.out or os.path.splitext(filename)[0] + ".mp3"
    with open(out, "wb") as fh:
        fh.write(body)
    print(f"PASS: mp3 saved to {out}")


if __name__ == "__main__":
    main()
