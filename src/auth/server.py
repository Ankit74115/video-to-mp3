"""Auth service: issues and validates JWTs backed by a MySQL user table."""

import datetime
import logging
import os
import sys
import time

import bcrypt
import jwt
import pymysql
from flask import Flask, jsonify, request

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("auth")

server = Flask(__name__)

MYSQL_HOST = os.environ.get("MYSQL_HOST", "mysql")
MYSQL_PORT = int(os.environ.get("MYSQL_PORT", "3306"))
MYSQL_USER = os.environ.get("MYSQL_USER", "auth_user")
MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", "")
MYSQL_DB = os.environ.get("MYSQL_DB", "auth")

JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_EXP_HOURS = int(os.environ.get("JWT_EXP_HOURS", "24"))

DEMO_USER_EMAIL = os.environ.get("DEMO_USER_EMAIL")
DEMO_USER_PASSWORD = os.environ.get("DEMO_USER_PASSWORD")

STARTUP_RETRIES = int(os.environ.get("STARTUP_RETRIES", "30"))
STARTUP_RETRY_SECONDS = float(os.environ.get("STARTUP_RETRY_SECONDS", "2"))

if not JWT_SECRET or len(JWT_SECRET) < 16:
    log.error("JWT_SECRET must be set and at least 16 characters long")
    sys.exit(1)


def db_connect():
    return pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB,
        connect_timeout=5,
        autocommit=True,
        cursorclass=pymysql.cursors.DictCursor,
    )


def wait_for_db():
    for attempt in range(1, STARTUP_RETRIES + 1):
        try:
            conn = db_connect()
            conn.close()
            log.info("MySQL is reachable at %s:%s", MYSQL_HOST, MYSQL_PORT)
            return
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "MySQL not ready (attempt %s/%s): %s", attempt, STARTUP_RETRIES, exc
            )
            time.sleep(STARTUP_RETRY_SECONDS)
    log.error("Giving up waiting for MySQL")
    sys.exit(1)


def init_schema_and_seed():
    """Create the user table if needed and seed the demo user (idempotent)."""
    conn = db_connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS user (
                  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                  email VARCHAR(255) NOT NULL UNIQUE,
                  password VARCHAR(255) NOT NULL,
                  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            if DEMO_USER_EMAIL and DEMO_USER_PASSWORD:
                cur.execute("SELECT id FROM user WHERE email=%s", (DEMO_USER_EMAIL,))
                if cur.fetchone() is None:
                    cur.execute(
                        "INSERT INTO user (email, password) VALUES (%s, %s)",
                        (DEMO_USER_EMAIL, hash_password(DEMO_USER_PASSWORD)),
                    )
                    log.info("Seeded demo user %s", DEMO_USER_EMAIL)
                else:
                    log.info("Demo user %s already exists", DEMO_USER_EMAIL)
    finally:
        conn.close()


def hash_password(plain):
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain, hashed):
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_jwt(username):
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    return jwt.encode(
        {
            "username": username,
            "iat": now,
            "exp": now + datetime.timedelta(hours=JWT_EXP_HOURS),
            "admin": True,
        },
        JWT_SECRET,
        algorithm="HS256",
    )


@server.route("/health", methods=["GET"])
def health():
    try:
        conn = db_connect()
        conn.ping(reconnect=False)
        conn.close()
    except Exception as exc:  # noqa: BLE001
        log.warning("health check failed: %s", exc)
        return jsonify({"status": "degraded", "mysql": "unreachable"}), 503
    return jsonify({"status": "ok"}), 200


@server.route("/login", methods=["POST"])
def login():
    auth = request.authorization
    if not auth or not auth.username or not auth.password:
        return jsonify({"error": "missing credentials"}), 401

    try:
        conn = db_connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT email, password FROM user WHERE email=%s", (auth.username,)
                )
                row = cur.fetchone()
        finally:
            conn.close()
    except Exception as exc:  # noqa: BLE001
        log.error("database error during login: %s", exc)
        return jsonify({"error": "internal server error"}), 500

    if row is None or not verify_password(auth.password, row["password"]):
        return jsonify({"error": "invalid credentials"}), 401

    return jsonify({"token": create_jwt(row["email"])}), 200


@server.route("/register", methods=["POST"])
def register():
    body = request.get_json(silent=True) or {}
    email = str(body.get("email", "")).strip().lower()
    password = str(body.get("password", ""))
    if not email or "@" not in email or len(email) > 255:
        return jsonify({"error": "enter a valid email address"}), 400
    if len(password) < 8:
        return jsonify({"error": "password must be at least 8 characters"}), 400

    try:
        conn = db_connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO user (email, password) VALUES (%s, %s)",
                    (email, hash_password(password)),
                )
        finally:
            conn.close()
    except pymysql.err.IntegrityError:
        return jsonify({"error": "an account with that email already exists"}), 409
    except Exception as exc:  # noqa: BLE001
        log.error("database error during register: %s", exc)
        return jsonify({"error": "internal server error"}), 500

    log.info("registered user %s", email)
    return jsonify({"token": create_jwt(email)}), 201


@server.route("/validate", methods=["POST"])
def validate():
    header = request.headers.get("Authorization", "")
    parts = header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1]:
        return jsonify({"error": "missing credentials"}), 401

    try:
        decoded = jwt.decode(parts[1], JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "token expired"}), 403
    except jwt.InvalidTokenError:
        return jsonify({"error": "not authorized"}), 403

    return jsonify(decoded), 200


# Runs at import time so gunicorn workers also wait for the DB and seed once.
wait_for_db()
init_schema_and_seed()


if __name__ == "__main__":
    server.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))
