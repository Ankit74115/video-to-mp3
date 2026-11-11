"""Conversion job records in MongoDB, so the UI can poll status without email."""

import datetime

from bson.errors import InvalidId
from bson.objectid import ObjectId
from pymongo import DESCENDING


def _now():
    return datetime.datetime.now(tz=datetime.timezone.utc)


def _iso(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def _serialize(doc):
    if doc is None:
        return None
    return {
        "id": str(doc["_id"]),
        "filename": doc.get("filename"),
        "status": doc.get("status"),
        "video_fid": doc.get("video_fid"),
        "mp3_fid": doc.get("mp3_fid"),
        "username": doc.get("username"),
        "error": doc.get("error"),
        "created_at": _iso(doc.get("created_at")),
        "updated_at": _iso(doc.get("updated_at")),
    }


class JobStore:
    def __init__(self, db):
        self.col = db["jobs"]
        self.col.create_index([("username", 1), ("created_at", DESCENDING)])
        self.col.create_index("mp3_fid")

    def create(self, username, video_fid, filename):
        now = _now()
        res = self.col.insert_one(
            {
                "username": username,
                "video_fid": video_fid,
                "mp3_fid": None,
                "filename": filename,
                "status": "queued",
                "error": None,
                "created_at": now,
                "updated_at": now,
            }
        )
        return str(res.inserted_id)

    def delete(self, job_id):
        self.col.delete_one({"_id": ObjectId(job_id)})

    def list_for_user(self, username, limit=100):
        cursor = (
            self.col.find({"username": username})
            .sort("created_at", DESCENDING)
            .limit(limit)
        )
        return [_serialize(d) for d in cursor]

    def get_for_user(self, job_id, username):
        try:
            oid = ObjectId(job_id)
        except (InvalidId, TypeError):
            return None
        return _serialize(self.col.find_one({"_id": oid, "username": username}))

    def get_by_mp3_fid(self, mp3_fid, username):
        return _serialize(self.col.find_one({"mp3_fid": mp3_fid, "username": username}))
