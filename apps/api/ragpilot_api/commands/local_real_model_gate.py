from __future__ import annotations

import argparse
import asyncio
import json
import time
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlsplit
from uuid import UUID

import httpx

from ragpilot_api.application.identity.api_key_service import ApiKeyService
from ragpilot_api.contracts.http.api_key_contracts import ApiKeyCreateRequest
from ragpilot_api.infrastructure.database.repositories.api_key_repository import ApiKeyRepository
from ragpilot_api.infrastructure.database.session import async_session_factory


async def evaluate_real_model(
    *,
    base_url: str,
    tenant_id: UUID,
    workspace_id: UUID,
    knowledge_base_id: UUID,
    actor_user_id: UUID,
    question: str,
    expected_model: str | None,
    api_key_service: ApiKeyService,
    transport: httpx.AsyncBaseTransport | None = None,
) -> dict[str, Any]:
    parsed_url = urlsplit(base_url)
    if parsed_url.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("Local real-model qualification only accepts a loopback API URL.")

    created = await api_key_service.create(
        ApiKeyCreateRequest(
            tenant_id=tenant_id,
            name="Local real-model gate (temporary)",
            role="super_admin",
            scopes=["access_chat", "send_chat_messages"],
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        ),
        actor_user_id=actor_user_id,
    )
    conversation_id: UUID | None = None
    headers = {"X-API-Key": created.secret}
    try:
        async with httpx.AsyncClient(
            base_url=base_url.rstrip("/"), timeout=180, transport=transport, trust_env=False
        ) as client:
            started_at = time.perf_counter()
            response = await client.post(
                "/api/v1/chat/messages",
                headers=headers,
                json={
                    "tenant_id": str(tenant_id),
                    "workspace_id": str(workspace_id),
                    "knowledge_base_id": str(knowledge_base_id),
                    "question": question,
                    "top_k": 3,
                },
            )
            response.raise_for_status()
            latency_ms = (time.perf_counter() - started_at) * 1000
            payload = response.json()
            conversation_id = UUID(payload["conversation"]["id"])
            assistant = payload["assistant_message"]
            content = str(assistant.get("content") or "").strip()
            model_name = str(assistant.get("model_name") or "").strip()
            citations = list(assistant.get("citations") or [])
            usage = dict(assistant.get("usage_json") or {})
            failures = []
            if not content:
                failures.append("assistant content is empty")
            if not model_name:
                failures.append("assistant model identity is missing")
            if expected_model and model_name != expected_model:
                failures.append(f"model_name={model_name!r} does not match {expected_model!r}")
            if not citations:
                failures.append("grounded response contains no citations")
            report = {
                "target": f"{parsed_url.scheme}://{parsed_url.netloc}",
                "status": "passed" if not failures else "failed",
                "model_name": model_name,
                "provider": usage.get("provider"),
                "latency_ms": latency_ms,
                "citation_count": len(citations),
                "retrieval_result_count": usage.get("retrieval_result_count"),
                "promotion": {"passed": not failures, "failures": failures},
            }
            delete_response = await client.delete(
                f"/api/v1/chat/conversations/{conversation_id}",
                headers=headers,
                params={"tenant_id": str(tenant_id)},
            )
            delete_response.raise_for_status()
            conversation_id = None
            return report
    finally:
        try:
            if conversation_id is not None:
                async with httpx.AsyncClient(
                    base_url=base_url.rstrip("/"), timeout=30, transport=transport, trust_env=False
                ) as cleanup_client:
                    cleanup_response = await cleanup_client.delete(
                        f"/api/v1/chat/conversations/{conversation_id}",
                        headers=headers,
                        params={"tenant_id": str(tenant_id)},
                    )
                    cleanup_response.raise_for_status()
        finally:
            await api_key_service.revoke(
                api_key_id=created.id,
                tenant_id=tenant_id,
                actor_user_id=actor_user_id,
                reason="Local real-model gate completed",
            )


async def run(args: argparse.Namespace) -> dict[str, Any]:
    async with async_session_factory() as session:
        return await evaluate_real_model(
            base_url=args.base_url,
            tenant_id=args.tenant_id,
            workspace_id=args.workspace_id,
            knowledge_base_id=args.knowledge_base_id,
            actor_user_id=args.actor_user_id,
            question=args.question,
            expected_model=args.expected_model,
            api_key_service=ApiKeyService(ApiKeyRepository(session)),
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Qualify a loopback deployment with a real model and clean up all test state."
    )
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--tenant-id", type=UUID, required=True)
    parser.add_argument("--workspace-id", type=UUID, required=True)
    parser.add_argument("--knowledge-base-id", type=UUID, required=True)
    parser.add_argument("--actor-user-id", type=UUID, required=True)
    parser.add_argument("--question", required=True)
    parser.add_argument("--expected-model")
    args = parser.parse_args()
    report = asyncio.run(run(args))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report["promotion"]["passed"] else 2)


if __name__ == "__main__":
    main()
