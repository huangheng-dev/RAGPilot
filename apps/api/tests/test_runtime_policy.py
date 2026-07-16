import asyncio

import httpx
import pytest

import ragpilot_api.infrastructure.runtime_policy as runtime_policy
from ragpilot_api.infrastructure.runtime_policy import AsyncOutboundPolicy


@pytest.mark.anyio
async def test_outbound_policy_retries_retryable_status_and_reports_attempts() -> None:
    calls = 0
    policy = AsyncOutboundPolicy(
        concurrency_limit=1, requests_per_minute=1000, max_attempts=2,
        retryable_status_codes={503}, retry_backoff_seconds=0,
    )

    async def operation() -> str:
        nonlocal calls
        calls += 1
        if calls == 1:
            request = httpx.Request("GET", "https://runtime.example")
            response = httpx.Response(503, request=request)
            raise httpx.HTTPStatusError("unavailable", request=request, response=response)
        return "ok"

    value, attempts = await policy.execute(operation)

    assert (value, attempts, calls) == ("ok", 2, 2)


@pytest.mark.anyio
async def test_outbound_policy_enforces_concurrency_limit() -> None:
    active = 0
    peak = 0
    policy = AsyncOutboundPolicy(
        concurrency_limit=2, requests_per_minute=1000, max_attempts=1,
        retryable_status_codes=set(), retry_backoff_seconds=0,
    )

    async def operation() -> None:
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.01)
        active -= 1

    await asyncio.gather(*(policy.execute(operation) for _ in range(6)))

    assert peak == 2


@pytest.mark.anyio
async def test_outbound_policy_does_not_retry_non_retryable_client_error() -> None:
    calls = 0
    policy = AsyncOutboundPolicy(
        concurrency_limit=1, requests_per_minute=1000, max_attempts=3,
        retryable_status_codes={503}, retry_backoff_seconds=0,
    )

    async def operation() -> None:
        nonlocal calls
        calls += 1
        request = httpx.Request("GET", "https://runtime.example")
        response = httpx.Response(400, request=request)
        raise httpx.HTTPStatusError("bad request", request=request, response=response)

    with pytest.raises(httpx.HTTPStatusError):
        await policy.execute(operation)

    assert calls == 1


@pytest.mark.anyio
async def test_outbound_policy_propagates_cancellation_without_retry() -> None:
    calls = 0
    started = asyncio.Event()
    policy = AsyncOutboundPolicy(
        concurrency_limit=1, requests_per_minute=1000, max_attempts=3,
        retryable_status_codes={503}, retry_backoff_seconds=0,
    )

    async def operation() -> None:
        nonlocal calls
        calls += 1
        started.set()
        await asyncio.Event().wait()

    task = asyncio.create_task(policy.execute(operation))
    await started.wait()
    task.cancel()

    with pytest.raises(asyncio.CancelledError):
        await task
    assert calls == 1


@pytest.mark.anyio
async def test_outbound_policy_uses_shared_distributed_concurrency(monkeypatch: pytest.MonkeyPatch) -> None:
    shared_semaphore = asyncio.Semaphore(1)

    class FakeDistributedLimiter:
        def __init__(self, **kwargs) -> None:
            pass

        async def acquire_concurrency(self) -> str:
            await shared_semaphore.acquire()
            return "lease"

        async def renew_concurrency(self, token: str) -> bool:
            return True

        async def release_concurrency(self, token: str) -> None:
            shared_semaphore.release()

        async def wait_for_rate_slot(self) -> None:
            return None

    monkeypatch.setattr(runtime_policy, "RedisRuntimeLimiter", FakeDistributedLimiter)
    policies = [
        AsyncOutboundPolicy(
            lane="model:test", redis_url="redis://shared", concurrency_limit=10,
            requests_per_minute=100, max_attempts=1, retryable_status_codes=set(),
        )
        for _ in range(2)
    ]
    active = 0
    peak = 0

    async def operation() -> None:
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.01)
        active -= 1

    await asyncio.gather(*(policy.execute(operation) for policy in policies))
    assert peak == 1
