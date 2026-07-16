import json
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI

from ragpilot_api.commands.staging_capacity_gate import evaluate_capacity
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
