from __future__ import annotations

from typing import Any
from uuid import UUID

import httpx
from ragpilot_api.infrastructure.observability import traced


class ElasticsearchRetrievalError(RuntimeError):
    """Raised when Elasticsearch cannot serve the lexical retrieval request."""


class ElasticsearchRetrievalRepository:
    def __init__(self, *, base_url: str, read_alias: str, timeout_seconds: float) -> None:
        self.base_url = base_url.rstrip("/")
        self.read_alias = read_alias
        self.timeout_seconds = timeout_seconds

    @traced("retrieval.elasticsearch_bm25.search")
    async def search_lexical_document_chunks(
        self,
        *,
        tenant_id: UUID,
        knowledge_base_id: UUID,
        query_text: str,
        top_k: int,
        workspace_id: UUID | None = None,
        document_id: UUID | None = None,
        document_version_id: UUID | None = None,
    ) -> list[dict[str, Any]]:
        filters: list[dict[str, Any]] = [
            {"term": {"tenant_id": str(tenant_id)}},
            {"term": {"knowledge_base_id": str(knowledge_base_id)}},
        ]
        for field, value in (
            ("workspace_id", workspace_id),
            ("document_id", document_id),
            ("document_version_id", document_version_id),
        ):
            if value is not None:
                filters.append({"term": {field: str(value)}})

        payload = {
            "size": top_k,
            "track_total_hits": False,
            "query": {
                "bool": {
                    "filter": filters,
                    "must": [
                        {
                            "multi_match": {
                                "query": query_text,
                                "fields": ["document_title^3", "content"],
                                "type": "best_fields",
                                "operator": "or",
                            }
                        }
                    ],
                }
            },
            "sort": ["_score", {"chunk_index": "asc"}],
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    f"{self.base_url}/{self.read_alias}/_search",
                    json=payload,
                )
                response.raise_for_status()
        except (httpx.HTTPError, ValueError) as exc:
            raise ElasticsearchRetrievalError(str(exc)) from exc

        hits = response.json().get("hits", {}).get("hits", [])
        rows: list[dict[str, Any]] = []
        for hit in hits:
            source = hit.get("_source", {})
            rows.append(
                {
                    "document_chunk_id": source.get("document_chunk_id"),
                    "document_id": source.get("document_id"),
                    "document_version_id": source.get("document_version_id"),
                    "knowledge_base_id": source.get("knowledge_base_id"),
                    "document_title": source.get("document_title"),
                    "chunk_index": source.get("chunk_index"),
                    "content": source.get("content"),
                    "token_count": source.get("token_count"),
                    "metadata_json": source.get("metadata") or {},
                    "created_at": source.get("chunk_created_at"),
                    "embedding_model": None,
                    "lexical_score": float(hit.get("_score") or 0.0),
                }
            )
        return rows
