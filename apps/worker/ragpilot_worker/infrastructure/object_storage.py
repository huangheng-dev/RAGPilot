from __future__ import annotations

from io import BytesIO
from urllib.parse import urlparse

from minio import Minio

from ragpilot_worker.config import WorkerSettings, get_settings


class DocumentObjectStorage:
    def __init__(self, settings: WorkerSettings | None = None) -> None:
        self.settings = settings or get_settings()
        parsed_endpoint = urlparse(self.settings.minio_endpoint)
        endpoint = parsed_endpoint.netloc or parsed_endpoint.path
        secure = parsed_endpoint.scheme == "https"
        self.client = Minio(
            endpoint,
            access_key=self.settings.minio_root_user,
            secret_key=self.settings.minio_root_password,
            secure=secure,
        )

    def read_document_object(self, *, storage_bucket: str, storage_key: str) -> bytes:
        response = self.client.get_object(storage_bucket, storage_key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def store_document_object(self, *, storage_key: str, content: bytes, content_type: str) -> tuple[str, str]:
        bucket = self.settings.minio_bucket
        if not self.client.bucket_exists(bucket):
            self.client.make_bucket(bucket)
        self.client.put_object(
            bucket_name=bucket,
            object_name=storage_key,
            data=BytesIO(content),
            length=len(content),
            content_type=content_type,
        )
        return bucket, storage_key
