from __future__ import annotations

from typing import Any


def build_chunk_index_name(*, prefix: str, version: int) -> str:
    normalized_prefix = prefix.strip().lower().rstrip("-")
    if not normalized_prefix:
        raise ValueError("Elasticsearch index prefix must not be empty.")
    if version < 1:
        raise ValueError("Elasticsearch index version must be at least 1.")
    return f"{normalized_prefix}-v{version}"


def build_chunk_read_alias(*, prefix: str) -> str:
    normalized_prefix = prefix.strip().lower().rstrip("-")
    if not normalized_prefix:
        raise ValueError("Elasticsearch index prefix must not be empty.")
    return f"{normalized_prefix}-read"


def build_chunk_write_alias(*, prefix: str) -> str:
    normalized_prefix = prefix.strip().lower().rstrip("-")
    if not normalized_prefix:
        raise ValueError("Elasticsearch index prefix must not be empty.")
    return f"{normalized_prefix}-write"


def build_chunk_index_contract(*, prefix: str, version: int, include_aliases: bool = True) -> dict[str, Any]:
    read_alias = build_chunk_read_alias(prefix=prefix)
    write_alias = build_chunk_write_alias(prefix=prefix)
    contract: dict[str, Any] = {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0,
            "refresh_interval": "1s",
        },
        "mappings": {
            "dynamic": "strict",
            "_meta": {
                "contract": "ragpilot_document_chunk_projection",
                "contract_version": version,
                "source_of_truth": "postgresql",
            },
            "properties": {
                "tenant_id": {"type": "keyword"},
                "workspace_id": {"type": "keyword"},
                "knowledge_base_id": {"type": "keyword"},
                "document_id": {"type": "keyword"},
                "document_version_id": {"type": "keyword"},
                "document_version_number": {"type": "integer"},
                "document_chunk_id": {"type": "keyword"},
                "chunk_index": {"type": "integer"},
                "document_title": {
                    "type": "text",
                    "analyzer": "standard",
                    "fields": {"keyword": {"type": "keyword", "ignore_above": 512}},
                },
                "content": {"type": "text", "analyzer": "standard"},
                "content_hash": {"type": "keyword"},
                "token_count": {"type": "integer"},
                "source_uri": {"type": "keyword", "ignore_above": 2048},
                "parser_name": {"type": "keyword"},
                "metadata": {"type": "object", "enabled": False},
                "document_created_at": {"type": "date"},
                "document_updated_at": {"type": "date"},
                "version_created_at": {"type": "date"},
                "chunk_created_at": {"type": "date"},
                "projected_at": {"type": "date"},
            },
        },
    }
    if include_aliases:
        contract["aliases"] = {read_alias: {}, write_alias: {"is_write_index": True}}
    return contract
