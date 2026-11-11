"""Short-lived RabbitMQ connections.

The gateway runs under gunicorn with several workers and handles sparse
traffic, so a connection per publish is simpler and more robust than a shared
long-lived connection that silently dies on missed heartbeats.
"""

import logging
import os
import sys
import time

import pika

log = logging.getLogger("gateway.rabbit")
logging.getLogger("pika").setLevel(logging.WARNING)

RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/%2F")
STARTUP_RETRIES = int(os.environ.get("STARTUP_RETRIES", "30"))
STARTUP_RETRY_SECONDS = float(os.environ.get("STARTUP_RETRY_SECONDS", "2"))


def _params():
    params = pika.URLParameters(RABBITMQ_URL)
    params.socket_timeout = 5
    params.blocked_connection_timeout = 30
    return params


def with_channel(fn, retries=None):
    """Open a connection, run fn(channel), close.

    With retries=None (startup) it retries STARTUP_RETRIES times and exits the
    process if RabbitMQ never comes up. With an explicit retry count (request
    path) it raises the last error instead so the caller can return a 500.
    """
    startup = retries is None
    attempts = STARTUP_RETRIES if startup else retries
    last_exc = None
    for attempt in range(1, attempts + 1):
        try:
            connection = pika.BlockingConnection(_params())
            try:
                channel = connection.channel()
                return fn(channel)
            finally:
                connection.close()
        except pika.exceptions.AMQPError as exc:
            last_exc = exc
            log.warning("RabbitMQ unavailable (attempt %s/%s): %s", attempt, attempts, exc)
            if attempt < attempts:
                time.sleep(STARTUP_RETRY_SECONDS if startup else 0.5)
    if startup:
        log.error("Giving up waiting for RabbitMQ: %s", last_exc)
        sys.exit(1)
    raise last_exc
