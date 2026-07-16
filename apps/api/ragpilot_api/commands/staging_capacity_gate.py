from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import time
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import httpx

from ragpilot_api.application.retrieval.batch_evaluator import percentile


ENV_PATTERN = re.compile(r"^\$\{([A-Z][A-Z0-9_]*)\}$")


def validate_dataset(dataset: dict[str, Any]) -> None:
    for field in ("dataset_id", "version", "scenarios"):
        if field not in dataset:
            raise ValueError(f"Capacity dataset is missing {field}.")
    if dataset.get("schema_version") != "1" or not dataset["scenarios"]:
        raise ValueError("Capacity dataset must use schema version 1 and contain scenarios.")
    scenario_ids = [scenario.get("scenario_id") for scenario in dataset["scenarios"]]
    if any(not item for item in scenario_ids) or len(scenario_ids) != len(set(scenario_ids)):
        raise ValueError("Capacity scenario IDs must be present and unique.")


def resolve_environment_value(value: Any) -> Any:
    if isinstance(value, str):
        match = ENV_PATTERN.fullmatch(value)
        if match:
            return os.environ[match.group(1)]
        return value
    if isinstance(value, list):
        return [resolve_environment_value(item) for item in value]
    if isinstance(value, dict):
        return {key: resolve_environment_value(item) for key, item in value.items()}
    return value


def read_json_path(payload: Any, path: str) -> Any:
    current = payload
    for segment in path.split("."):
        if not isinstance(current, dict) or segment not in current:
            raise KeyError(path)
        current = current[segment]
    return current


def response_contract_passed(response: httpx.Response, scenario: dict[str, Any]) -> bool:
    if response.status_code not in set(scenario.get("expected_status_codes", [200])):
        return False
    assertions = dict(scenario.get("json_assertions") or {})
    if not assertions:
        return True
    try:
        payload = response.json()
        return all(read_json_path(payload, path) == expected for path, expected in assertions.items())
    except (ValueError, KeyError):
        return False


async def run_scenario(
    *, client: httpx.AsyncClient, scenario: dict[str, Any], semaphore: asyncio.Semaphore,
) -> dict[str, Any]:
    method = str(scenario.get("method", "GET")).upper()
    path = str(scenario["path"])
    headers = resolve_environment_value(dict(scenario.get("headers") or {}))
    body = resolve_environment_value(scenario.get("json_body"))
    warmup_runs = int(scenario.get("warmup_runs", 0))

    for _ in range(warmup_runs):
        response = await client.request(method, path, headers=headers, json=body)
        if not response_contract_passed(response, scenario):
            return {
                "scenario_id": scenario["scenario_id"],
                "method": method,
                "path": path,
                "status": "failed",
                "promotion": {
                    "passed": False,
                    "failures": ["warmup response did not satisfy the scenario contract"],
                },
            }

    async def execute_request() -> tuple[float, int | None, bool, str | None]:
        async with semaphore:
            started_at = time.perf_counter()
            try:
                response = await client.request(method, path, headers=headers, json=body)
                elapsed_ms = (time.perf_counter() - started_at) * 1000
                return (
                    elapsed_ms,
                    response.status_code,
                    response_contract_passed(response, scenario),
                    None,
                )
            except httpx.HTTPError as exc:
                elapsed_ms = (time.perf_counter() - started_at) * 1000
                return elapsed_ms, None, False, type(exc).__name__

    request_count = int(scenario["requests"])
    started_at = time.perf_counter()
    observations = await asyncio.gather(*(execute_request() for _ in range(request_count)))
    wall_seconds = max(time.perf_counter() - started_at, 0.000001)
    latencies = [item[0] for item in observations]
    contract_failures = sum(1 for item in observations if not item[2])
    error_rate = contract_failures / request_count
    status_codes = Counter(str(item[1]) if item[1] is not None else "transport_error" for item in observations)
    error_types = Counter(item[3] for item in observations if item[3])
    metrics = {
        "requests": request_count,
        "concurrency": int(scenario["concurrency"]),
        "error_rate": error_rate,
        "throughput_requests_per_second": request_count / wall_seconds,
        "p50_latency_ms": percentile(latencies, 0.50),
        "p95_latency_ms": percentile(latencies, 0.95),
        "p99_latency_ms": percentile(latencies, 0.99),
        "max_latency_ms": max(latencies, default=0.0),
        "status_codes": dict(sorted(status_codes.items())),
        "transport_error_types": dict(sorted(error_types.items())),
    }
    gates = scenario["gates"]
    failures = []
    if metrics["error_rate"] > float(gates["max_error_rate"]):
        failures.append(
            f"error_rate={metrics['error_rate']:.4f} > {float(gates['max_error_rate']):.4f}"
        )
    if metrics["p95_latency_ms"] > float(gates["max_p95_latency_ms"]):
        failures.append(
            f"p95_latency_ms={metrics['p95_latency_ms']:.2f} > {float(gates['max_p95_latency_ms']):.2f}"
        )
    if metrics["throughput_requests_per_second"] < float(gates["min_throughput_rps"]):
        failures.append(
            "throughput_requests_per_second="
            f"{metrics['throughput_requests_per_second']:.2f} < {float(gates['min_throughput_rps']):.2f}"
        )
    return {
        "scenario_id": scenario["scenario_id"],
        "method": method,
        "path": path,
        "status": "passed" if not failures else "failed",
        "warmup_runs": warmup_runs,
        "gates": gates,
        "metrics": metrics,
        "promotion": {"passed": not failures, "failures": failures},
    }


async def evaluate_capacity(
    *, dataset: dict[str, Any], base_url: str, scenario_ids: set[str] | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> dict[str, Any]:
    validate_dataset(dataset)
    parsed_url = urlsplit(base_url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise ValueError("Capacity base URL must use HTTP or HTTPS and include a host.")
    if parsed_url.username or parsed_url.password:
        raise ValueError("Capacity base URL must not contain credentials.")

    selected = [
        scenario
        for scenario in dataset["scenarios"]
        if scenario_ids is None or scenario["scenario_id"] in scenario_ids
    ]
    if scenario_ids and {item["scenario_id"] for item in selected} != scenario_ids:
        missing = sorted(scenario_ids - {item["scenario_id"] for item in selected})
        raise ValueError(f"Unknown capacity scenarios: {', '.join(missing)}")

    reports: list[dict[str, Any]] = []
    timeout_seconds = float(dataset.get("request_timeout_seconds", 30.0))
    limits = httpx.Limits(
        max_connections=max(int(item["concurrency"]) for item in selected),
        max_keepalive_connections=max(int(item["concurrency"]) for item in selected),
    )
    async with httpx.AsyncClient(
        base_url=base_url.rstrip("/"), timeout=timeout_seconds, limits=limits, transport=transport
    ) as client:
        for scenario in selected:
            required_environment = list(scenario.get("required_environment") or [])
            missing_environment = sorted(name for name in required_environment if not os.getenv(name))
            if missing_environment:
                reports.append(
                    {
                        "scenario_id": scenario["scenario_id"],
                        "method": str(scenario.get("method", "GET")).upper(),
                        "path": scenario["path"],
                        "status": "skipped",
                        "missing_environment": missing_environment,
                        "promotion": {
                            "passed": False,
                            "failures": ["required staging inputs are unavailable"],
                        },
                    }
                )
                continue
            semaphore = asyncio.Semaphore(int(scenario["concurrency"]))
            reports.append(await run_scenario(client=client, scenario=scenario, semaphore=semaphore))

    failures = [
        f"{report['scenario_id']}: {failure}"
        for report in reports
        for failure in report["promotion"]["failures"]
    ]
    return {
        "dataset_id": dataset["dataset_id"],
        "dataset_version": dataset["version"],
        "target": f"{parsed_url.scheme}://{parsed_url.netloc}",
        "selected_scenario_count": len(selected),
        "completed_scenario_count": sum(report["status"] != "skipped" for report in reports),
        "promotion": {"passed": not failures, "failures": failures},
        "scenarios": reports,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run versioned staging capacity scenarios without exposing credentials or response bodies."
    )
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--scenario", action="append", dest="scenarios")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    dataset = json.loads(args.dataset.read_text(encoding="utf-8"))
    report = asyncio.run(
        evaluate_capacity(
            dataset=dataset,
            base_url=args.base_url,
            scenario_ids=set(args.scenarios) if args.scenarios else None,
        )
    )
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    raise SystemExit(0 if report["promotion"]["passed"] else 2)


if __name__ == "__main__":
    main()
