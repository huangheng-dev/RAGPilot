from __future__ import annotations

import argparse
import asyncio
import json
import os
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit
from uuid import UUID

from ragpilot_api.application.identity.api_key_service import ApiKeyService
from ragpilot_api.commands.staging_capacity_gate import evaluate_capacity
from ragpilot_api.contracts.http.api_key_contracts import ApiKeyCreateRequest
from ragpilot_api.infrastructure.database.repositories.api_key_repository import ApiKeyRepository
from ragpilot_api.infrastructure.database.session import async_session_factory


CAPACITY_ENVIRONMENT = (
    "RAGPILOT_CAPACITY_API_KEY",
    "RAGPILOT_CAPACITY_TENANT_ID",
    "RAGPILOT_CAPACITY_KNOWLEDGE_BASE_ID",
)


async def evaluate_local_capacity(
    *,
    dataset: dict[str, Any],
    base_url: str,
    tenant_id: UUID,
    knowledge_base_id: UUID,
    actor_user_id: UUID,
    api_key_service: ApiKeyService,
    evaluator: Callable[..., Awaitable[dict[str, Any]]] = evaluate_capacity,
) -> dict[str, Any]:
    parsed_url = urlsplit(base_url)
    if parsed_url.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("Local capacity qualification only accepts a loopback API URL.")

    created = await api_key_service.create(
        ApiKeyCreateRequest(
            tenant_id=tenant_id,
            name="Local staging capacity gate (temporary)",
            role="reviewer",
            scopes=["access_chat"],
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        ),
        actor_user_id=actor_user_id,
    )
    previous_environment = {name: os.environ.get(name) for name in CAPACITY_ENVIRONMENT}
    try:
        os.environ.update(
            {
                "RAGPILOT_CAPACITY_API_KEY": created.secret,
                "RAGPILOT_CAPACITY_TENANT_ID": str(tenant_id),
                "RAGPILOT_CAPACITY_KNOWLEDGE_BASE_ID": str(knowledge_base_id),
            }
        )
        return await evaluator(dataset=dataset, base_url=base_url, trust_env=False)
    finally:
        try:
            for name, previous_value in previous_environment.items():
                if previous_value is None:
                    os.environ.pop(name, None)
                else:
                    os.environ[name] = previous_value
        finally:
            await api_key_service.revoke(
                api_key_id=created.id,
                tenant_id=tenant_id,
                actor_user_id=actor_user_id,
                reason="Local staging capacity gate completed",
            )


async def run(args: argparse.Namespace) -> dict[str, Any]:
    dataset = json.loads(args.dataset.read_text(encoding="utf-8"))
    async with async_session_factory() as session:
        return await evaluate_local_capacity(
            dataset=dataset,
            base_url=args.base_url,
            tenant_id=args.tenant_id,
            knowledge_base_id=args.knowledge_base_id,
            actor_user_id=args.actor_user_id,
            api_key_service=ApiKeyService(ApiKeyRepository(session)),
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Qualify a loopback deployment with an in-process temporary API key that is always revoked."
        )
    )
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--tenant-id", type=UUID, required=True)
    parser.add_argument("--knowledge-base-id", type=UUID, required=True)
    parser.add_argument("--actor-user-id", type=UUID, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = asyncio.run(run(args))
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    raise SystemExit(0 if report["promotion"]["passed"] else 2)


if __name__ == "__main__":
    main()
