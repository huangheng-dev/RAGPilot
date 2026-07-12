from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from urllib.parse import urlparse

from minio import Minio

from ragpilot_api.shared.settings import Settings, get_settings


@dataclass(frozen=True)
class StoredDocumentObject:
    storage_bucket: str
    storage_key: str
    file_name: str
    content_type: str | None
    file_size_bytes: int


class DocumentStorage:
    def __init__(self, settings: Settings | None = None) -> None:
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

    def store_document_object(
        self,
        *,
        storage_key: str,
        file_name: str,
        content_type: str | None,
        content: bytes,
    ) -> StoredDocumentObject:
        bucket = self.settings.minio_bucket
        if not self.client.bucket_exists(bucket):
            self.client.make_bucket(bucket)

        self.client.put_object(
            bucket_name=bucket,
            object_name=storage_key,
            data=BytesIO(content),
            length=len(content),
            content_type=content_type or "application/octet-stream",
        )

        return StoredDocumentObject(
            storage_bucket=bucket,
            storage_key=storage_key,
            file_name=file_name,
            content_type=content_type,
            file_size_bytes=len(content),
        )

    def delete_document_object(self, *, storage_bucket: str, storage_key: str) -> None:
        self.client.remove_object(bucket_name=storage_bucket, object_name=storage_key)
