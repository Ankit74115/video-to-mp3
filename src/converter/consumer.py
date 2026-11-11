"""Converter worker: consumes video jobs, extracts audio with ffmpeg, publishes mp3 jobs."""

import logging
import os
import sys
import time

import gridfs
import pika
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from convert import to_mp3

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("converter")
logging.getLogger("pika").setLevel(logging.WARNING)

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongodb:27017")
MONGO_DB = os.environ.get("MONGO_DB", "mp3converter")
RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/%2F")
VIDEO_QUEUE = os.environ.get("VIDEO_QUEUE", "video")
MP3_QUEUE = os.environ.get("MP3_QUEUE", "mp3")
STARTUP_RETRIES = int(os.environ.get("STARTUP_RETRIES", "30"))
STARTUP_RETRY_SECONDS = float(os.environ.get("STARTUP_RETRY_SECONDS", "2"))


def connect_mongo():
    for attempt in range(1, STARTUP_RETRIES + 1):
        try:
            client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            client.admin.command("ping")
            log.info("MongoDB is reachable")
            return client
        except PyMongoError as exc:
            log.warning("MongoDB not ready (attempt %s/%s): %s", attempt, STARTUP_RETRIES, exc)
            time.sleep(STARTUP_RETRY_SECONDS)
    log.error("Giving up waiting for MongoDB")
    sys.exit(1)


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
    client = connect_mongo()
    db = client[MONGO_DB]
    fs_videos = gridfs.GridFS(db, collection="videos")
    fs_mp3s = gridfs.GridFS(db, collection="mp3s")
    jobs = db["jobs"]

    while True:
        connection = connect_rabbit()
        channel = connection.channel()
        channel.queue_declare(queue=VIDEO_QUEUE, durable=True)
        channel.queue_declare(queue=MP3_QUEUE, durable=True)
        # One message at a time: ffmpeg is CPU bound and we want fair dispatch.
        channel.basic_qos(prefetch_count=1)

        def callback(ch, method, properties, body):
            err = to_mp3.start(body, fs_videos, fs_mp3s, jobs, ch, MP3_QUEUE)
            if err:
                log.error("job failed, dropping message: %s", err)
                # requeue=False: a poison message must not loop forever.
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
            else:
                ch.basic_ack(delivery_tag=method.delivery_tag)

        channel.basic_consume(queue=VIDEO_QUEUE, on_message_callback=callback)
        log.info("Waiting for messages on %s", VIDEO_QUEUE)

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
