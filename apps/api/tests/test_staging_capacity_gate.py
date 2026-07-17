import json
import os
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI

from ragpilot_api.commands.staging_capacity_gate import evaluate_capacity
from ragpilot_api.commands.local_staging_capacity_gate import evaluate_local_capacity
from ragpilot_api.presentation.http.v1.api_router import api_router


def test_versioned_capacity_contract_targets_real_api_routes() -> None:
    dataset_path = Path(__file__).parents[3] / "packages" / "evals" / "staging" / "capacity-contract-v1.json"
    dataset = json.loads(dataset_path.read_text(encoding="utf-8"))
    contract_app = FastAPI()
    contract_app.include_router(api_router, prefix="/api/v1")
    application_paths = set(contract_app.openapi()["paths"])

    assert {scenario["path"] for scenario in dataset["scenarios"]} <= application_paths


@pytest.mark.anyio
async def test_capacity_gate_measures_contract_and_does_not_emit_headers() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["X-API-Key"] == "rpk_test_secret"
        return httpx.Response(200, json={"status": "ready"})

    dataset = {
        "schema_version": "1",
        "dataset_id": "capacity-test",
        "version": "1.0.0",
        "scenarios": [
            {
                "scenario_id": "ready",
                "method": "GET",
                "path": "/ready",
                "requests": 5,
                "concurrency": 2,
                "warmup_runs": 1,
                "required_environment": ["RAGPILOT_CAPACITY_API_KEY"],
                "headers": {"X-API-Key": "${RAGPILOT_CAPACITY_API_KEY}"},
                "expected_status_codes": [200],
                "json_assertions": {"status": "ready"},
                "gates": {
                    "max_error_rate": 0.0,
                    "max_p95_latency_ms": 500,
                    "min_throughput_rps": 1,
                },
            }
        ],
    }

    with pytest.MonkeyPatch.context() as monkeypatch:
        monkeypatch.setenv("RAGPILOT_CAPACITY_API_KEY", "rpk_test_secret")
        report = await evaluate_capacity(
            dataset=dataset,
            base_url="https://staging.example.test",
            transport=httpx.MockTransport(handler),
        )

    assert report["promotion"]["passed"] is True
    assert report["scenarios"][0]["metrics"]["requests"] == 5
    assert "rpk_test_secret" not in str(report)
    assert "headers" not in report["scenarios"][0]


@pytest.mark.anyio
async def test_capacity_gate_marks_missing_staging_inputs_incomplete() -> None:
    dataset = {
        "schema_version": "1",
        "dataset_id": "capacity-test",
        "version": "1.0.0",
        "scenarios": [
            {
                "scenario_id": "retrieval",
                "method": "POST",
                "path": "/retrieval",
                "requests": 1,
                "concurrency": 1,
                "required_environment": ["RAGPILOT_CAPACITY_MISSING"],
                "gates": {
                    "max_error_rate": 0.0,
                    "max_p95_latency_ms": 500,
                    "min_throughput_rps": 1,
                },
            }
        ],
    }

    report = await evaluate_capacity(
        dataset=dataset,
        base_url="https://staging.example.test",
        transport=httpx.MockTransport(lambda request: httpx.Response(200)),
    )

    assert report["promotion"]["passed"] is False
    assert report["completed_scenario_count"] == 0
    assert report["scenarios"][0]["status"] == "skipped"


@pytest.mark.anyio
async def test_local_capacity_gate_revokes_temporary_key_and_restores_environment() -> None:
    tenant_id = uuid4()
    knowledge_base_id = uuid4()
    actor_user_id = uuid4()
    api_key_id = uuid4()
    calls: list[tuple[str, object]] = []

    class FakeApiKeyService:
        async def create(self, request, *, actor_user_id):
            calls.append(("create", request))
            return SimpleNamespace(id=api_key_id, secret="rpk_temporary_secret")

        async def revoke(self, **kwargs):
            calls.append(("revoke", kwargs))

    async def evaluator(**kwargs):
        assert kwargs["trust_env"] is False
        assert os.environ["RAGPILOT_CAPACITY_API_KEY"] == "rpk_temporary_secret"
        assert os.environ["RAGPILOT_CAPACITY_TENANT_ID"] == str(tenant_id)
        assert os.environ["RAGPILOT_CAPACITY_KNOWLEDGE_BASE_ID"] == str(knowledge_base_id)
        return {"promotion": {"passed": True}}

    with pytest.MonkeyPatch.context() as monkeypatch:
        monkeypatch.setenv("RAGPILOT_CAPACITY_API_KEY", "existing-key")
        report = await evaluate_local_capacity(
            dataset={"schema_version": "1"},
            base_url="http://localhost:8000",
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            actor_user_id=actor_user_id,
            api_key_service=FakeApiKeyService(),
            evaluator=evaluator,
        )
        assert os.environ["RAGPILOT_CAPACITY_API_KEY"] == "existing-key"
        assert "RAGPILOT_CAPACITY_TENANT_ID" not in os.environ
        assert "RAGPILOT_CAPACITY_KNOWLEDGE_BASE_ID" not in os.environ

    assert report["promotion"]["passed"] is True
    assert [name for name, _ in calls] == ["create", "revoke"]
    create_request = calls[0][1]
    assert create_request.role == "reviewer"
    assert create_request.scopes == ["access_chat"]
    assert calls[1][1]["api_key_id"] == api_key_id


@pytest.mark.anyio
async def test_local_capacity_gate_revokes_key_when_evaluation_fails() -> None:
    tenant_id = uuid4()
    api_key_id = uuid4()
    revoked: list[object] = []

    class FakeApiKeyService:
        async def create(self, request, *, actor_user_id):
            return SimpleNamespace(id=api_key_id, secret="rpk_temporary_secret")

        async def revoke(self, **kwargs):
            revoked.append(kwargs)

    async def evaluator(**kwargs):
        raise RuntimeError("capacity transport failed")

    with pytest.raises(RuntimeError, match="capacity transport failed"):
        await evaluate_local_capacity(
            dataset={"schema_version": "1"},
            base_url="http://127.0.0.1:8000",
            tenant_id=tenant_id,
            knowledge_base_id=uuid4(),
            actor_user_id=uuid4(),
            api_key_service=FakeApiKeyService(),
            evaluator=evaluator,
        )

    assert revoked[0]["api_key_id"] == api_key_id


@pytest.mark.anyio
async def test_local_capacity_gate_rejects_non_loopback_target() -> None:
    class UnexpectedApiKeyService:
        async def create(self, request, *, actor_user_id):
            raise AssertionError("A credential must not be created for a remote target.")

    with pytest.raises(ValueError, match="loopback"):
        await evaluate_local_capacity(
            dataset={"schema_version": "1"},
            base_url="https://staging.example.com",
            tenant_id=uuid4(),
            knowledge_base_id=uuid4(),
            actor_user_id=uuid4(),
            api_key_service=UnexpectedApiKeyService(),
        )


@pytest.mark.anyio
async def test_capacity_gate_reports_warmup_transport_failure_without_raising() -> None:
    dataset = {
        "schema_version": "1",
        "dataset_id": "capacity-warmup-failure",
        "version": "1.0.0",
        "request_timeout_seconds": 0.01,
        "scenarios": [
            {
                "scenario_id": "slow-warmup",
                "method": "GET",
                "path": "/slow",
                "requests": 1,
                "concurrency": 1,
                "warmup_runs": 1,
                "expected_status_codes": [200],
                "gates": {
                    "max_error_rate": 0.0,
                    "max_p95_latency_ms": 500,
                    "min_throughput_rps": 1,
                },
            }
        ],
    }

    async def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("warmup timed out", request=request)

    report = await evaluate_capacity(
        dataset=dataset,
        base_url="https://staging.example.test",
        transport=httpx.MockTransport(handler),
    )

    assert report["promotion"]["passed"] is False
    assert report["scenarios"][0]["status"] == "failed"
    assert report["scenarios"][0]["promotion"]["failures"] == [
        "warmup transport failed with ReadTimeout"
    ]
