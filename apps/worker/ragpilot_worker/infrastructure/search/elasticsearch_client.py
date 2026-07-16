from __future__ import annotations

import json
from collections.abc import Iterable
from datetime import date, datetime
from typing import Any

import httpx

from ragpilot_worker.infrastructure.observability import inject_trace_headers


class ElasticsearchProjectionError(RuntimeError):
    """Raised when the Elasticsearch projection boundary rejects an operation."""


class ElasticsearchProjectionClient:
    def __init__(self, *, base_url: str, request_timeout_seconds: int = 30) -> None:
        self.base_url = base_url.rstrip("/")
        self.request_timeout_seconds = request_timeout_seconds

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.request_timeout_seconds,
            headers=inject_trace_headers(),
        )

    async def ensure_index(self, *, index_name: str, contract: dict[str, Any]) -> None:
        async with self._client() as client:
            response = await client.put(f"/{index_name}", json=contract)
        if response.status_code in (200, 201):
            return
        if response.status_code == 400 and "resource_already_exists_exception" in response.text:
            return
        raise ElasticsearchProjectionError(_format_error("create index", response))

    async def resolve_write_alias(
        self,
        *,
        bootstrap_index_name: str,
        contract: dict[str, Any],
        write_alias: str,
    ) -> str:
        async with self._client() as client:
            alias_response = await client.get(f"/_alias/{write_alias}")
        if alias_response.status_code == 200:
            return write_alias
        if alias_response.status_code != 404:
            raise ElasticsearchProjectionError(_format_error("resolve write alias", alias_response))

        await self.ensure_index(index_name=bootstrap_index_name, contract=contract)
        alias_actions = [
            {"add": {"index": bootstrap_index_name, "alias": alias, **settings}}
            for alias, settings in contract.get("aliases", {}).items()
        ]
        if alias_actions:
            async with self._client() as client:
                create_alias_response = await client.post("/_aliases", json={"actions": alias_actions})
            if create_alias_response.status_code != 200:
                raise ElasticsearchProjectionError(_format_error("create bootstrap aliases", create_alias_response))
        return write_alias

    async def delete_index(self, *, index_name: str) -> None:
        async with self._client() as client:
            response = await client.delete(f"/{index_name}")
        if response.status_code in (200, 404):
            return
        raise ElasticsearchProjectionError(_format_error("delete rebuild index", response))

    async def promote_aliases(
        self,
        *,
        target_index_name: str,
        read_alias: str,
        write_alias: str,
    ) -> None:
        alias_indices: dict[str, set[str]] = {read_alias: set(), write_alias: set()}
        async with self._client() as client:
            for alias in (read_alias, write_alias):
                response = await client.get(f"/_alias/{alias}")
                if response.status_code == 404:
                    continue
                if response.status_code != 200:
                    raise ElasticsearchProjectionError(_format_error(f"resolve alias {alias}", response))
                alias_indices[alias].update(response.json().keys())

            actions: list[dict[str, Any]] = []
            for alias, indices in alias_indices.items():
                for index_name in indices:
                    actions.append({"remove": {"index": index_name, "alias": alias}})
            actions.extend(
                [
                    {"add": {"index": target_index_name, "alias": read_alias}},
                    {"add": {"index": target_index_name, "alias": write_alias, "is_write_index": True}},
                ]
            )
            response = await client.post("/_aliases", json={"actions": actions})
        if response.status_code != 200:
            raise ElasticsearchProjectionError(_format_error("promote read/write aliases", response))

    async def get_alias_indices(self, *, alias: str) -> set[str]:
        async with self._client() as client:
            response = await client.get(f"/_alias/{alias}")
        if response.status_code == 404:
            return set()
        if response.status_code != 200:
            raise ElasticsearchProjectionError(_format_error(f"resolve alias {alias}", response))
        return set(response.json().keys())

    async def list_index_document_ids(self, *, index_name: str, batch_size: int = 1000) -> set[str]:
        document_ids: set[str] = set()
        async with self._client() as client:
            response = await client.post(
                f"/{index_name}/_search",
                params={"scroll": "1m"},
                json={"size": batch_size, "sort": ["_doc"], "_source": False, "query": {"match_all": {}}},
            )
            if response.status_code != 200:
                raise ElasticsearchProjectionError(_format_error("read rebuild index", response))
            payload = response.json()
            scroll_id = payload.get("_scroll_id")
            while True:
                hits = payload.get("hits", {}).get("hits", [])
                if not hits:
                    break
                document_ids.update(str(hit["_id"]) for hit in hits)
                if not scroll_id:
                    break
                response = await client.post("/_search/scroll", json={"scroll": "1m", "scroll_id": scroll_id})
                if response.status_code != 200:
                    raise ElasticsearchProjectionError(_format_error("continue rebuild validation scroll", response))
                payload = response.json()
                scroll_id = payload.get("_scroll_id", scroll_id)
            if scroll_id:
                await client.request("DELETE", "/_search/scroll", json={"scroll_id": [scroll_id]})
        return document_ids

    async def replace_document(
        self,
        *,
        index_name: str,
        tenant_id: str,
        document_id: str,
        document_version_id: str,
        chunks: Iterable[dict[str, Any]],
    ) -> int:
        chunk_rows = list(chunks)
        for chunk in chunk_rows:
            if (
                chunk.get("tenant_id") != tenant_id
                or chunk.get("document_id") != document_id
                or chunk.get("document_version_id") != document_version_id
            ):
                raise ElasticsearchProjectionError("Projection payload crossed its tenant, document, or version boundary.")
        delete_query = {
            "query": {
                "bool": {
                    "filter": [
                        {"term": {"tenant_id": tenant_id}},
                        {"term": {"document_id": document_id}},
                    ]
                }
            }
        }
        async with self._client() as client:
            delete_response = await client.post(
                f"/{index_name}/_delete_by_query",
                params={"conflicts": "proceed", "refresh": "true"},
                json=delete_query,
            )
            if delete_response.status_code not in (200, 404):
                raise ElasticsearchProjectionError(_format_error("delete existing document version", delete_response))

            if not chunk_rows:
                return 0

            bulk_lines: list[str] = []
            for chunk in chunk_rows:
                bulk_lines.append(
                    json.dumps(
                        {"index": {"_index": index_name, "_id": chunk["document_chunk_id"]}},
                        separators=(",", ":"),
                    )
                )
                bulk_lines.append(json.dumps(chunk, separators=(",", ":"), default=_json_default))
            bulk_payload = "\n".join(bulk_lines) + "\n"
            bulk_response = await client.post(
                "/_bulk",
                params={"refresh": "wait_for"},
                content=bulk_payload,
                headers={"Content-Type": "application/x-ndjson"},
            )
        if bulk_response.status_code != 200:
            raise ElasticsearchProjectionError(_format_error("bulk index document version", bulk_response))
        response_payload = bulk_response.json()
        if response_payload.get("errors"):
            failed_items = [item for item in response_payload.get("items", []) if item.get("index", {}).get("error")]
            first_error = failed_items[0]["index"]["error"] if failed_items else "unknown bulk indexing error"
            raise ElasticsearchProjectionError(f"Elasticsearch bulk indexing failed: {first_error}")
        return len(chunk_rows)

    async def delete_document(self, *, index_name: str, tenant_id: str, document_id: str) -> int:
        delete_query = {
            "query": {
                "bool": {
                    "filter": [
                        {"term": {"tenant_id": tenant_id}},
                        {"term": {"document_id": document_id}},
                    ]
                }
            }
        }
        async with self._client() as client:
            response = await client.post(
                f"/{index_name}/_delete_by_query",
                params={"conflicts": "proceed", "refresh": "true"},
                json=delete_query,
            )
        if response.status_code == 404:
            return 0
        if response.status_code != 200:
            raise ElasticsearchProjectionError(_format_error("delete document", response))
        return int(response.json().get("deleted", 0))


def _format_error(operation: str, response: httpx.Response) -> str:
    detail = response.text.strip()
    if len(detail) > 1000:
        detail = detail[:1000] + "..."
    return f"Elasticsearch {operation} failed with HTTP {response.status_code}: {detail}"


def _json_default(value: object) -> str:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)
