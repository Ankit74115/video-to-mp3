"""Notification worker: emails the user when an mp3 is ready."""

import logging
import os
import sys
import time

import pika

from send import email

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("notification")
logging.getLogger("pika").setLevel(logging.WARNING)

RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/%2F")
MP3_QUEUE = os.environ.get("MP3_QUEUE", "mp3")
STARTUP_RETRIES = int(os.environ.get("STARTUP_RETRIES", "30"))
STARTUP_RETRY_SECONDS = float(os.environ.get("STARTUP_RETRY_SECONDS", "2"))


def connect_rabbit():
    params = pika.URLParameters(RABBITMQ_URL)
    params.heartbeat = 600
    params.blocked_connection_timeout = 300
    for attempt in range(1, STARTUP_RETRIES + 1):
        try:
            connection = pika.BlockingConnection(params)
            log.info("RabbitMQ is reachable")
            return connection
        except pika.exceptions.AMQPError as exc:
            log.warning("RabbitMQ not ready (attempt %s/%s): %s", attempt, STARTUP_RETRIES, exc)
            time.sleep(STARTUP_RETRY_SECONDS)
    log.error("Giving up waiting for RabbitMQ")
    sys.exit(1)


def main():
    if not email.is_configured():
        log.warning("SMTP not configured: messages will be logged and acknowledged, no email sent")

    while True:
        connection = connect_rabbit()
        channel = connection.channel()
        channel.queue_declare(queue=MP3_QUEUE, durable=True)
        channel.basic_qos(prefetch_count=1)

        def callback(ch, method, properties, body):
            err = email.notification(body)
            if err:
                log.error("notification failed, dropping message: %s", err)
                # requeue=False: a poison message must not loop forever.
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
            else:
                ch.basic_ack(delivery_tag=method.delivery_tag)

        channel.basic_consume(queue=MP3_QUEUE, on_message_callback=callback)
        log.info("Waiting for messages on %s", MP3_QUEUE)

        try:
            channel.start_consuming()
        except pika.exceptions.AMQPConnectionError as exc:
            log.warning("RabbitMQ connection lost, reconnecting: %s", exc)
            time.sleep(STARTUP_RETRY_SECONDS)
            continue
        except KeyboardInterrupt:
            log.info("Interrupted")
            try:
                channel.stop_consuming()
                connection.close()
            finally:
                return


if __name__ == "__main__":
    main()
