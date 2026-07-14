from __future__ import annotations

import asyncio
from collections import deque
from dataclasses import dataclass
from time import monotonic
from typing import Awaitable, Callable, TypeVar

import httpx

T = TypeVar("T")


@dataclass(frozen=True)
class OutboundPolicyResult:
    value: object
    attempts: int


class AsyncOutboundPolicy:
    """Process-wide concurrency, rate and retry boundary for outbound runtimes."""

    def __init__(self, *, concurrency_limit: int, requests_per_minute: int, max_attempts: int,
                 retryable_status_codes: set[int], retry_backoff_seconds: float = 0.25) -> None:
        self._semaphore = asyncio.Semaphore(max(concurrency_limit, 1))
        self._rate_limit = max(requests_per_minute, 1)
        self._max_attempts = max(max_attempts, 1)
        self._retryable_status_codes = retryable_status_codes
        self._retry_backoff_seconds = max(retry_backoff_seconds, 0.0)
        self._starts: deque[float] = deque()
        self._rate_lock = asyncio.Lock()

    async def execute(self, operation: Callable[[], Awaitable[T]]) -> tuple[T, int]:
        async with self._semaphore:
            for attempt in range(1, self._max_attempts + 1):
                await self._wait_for_rate_slot()
                try:
                    return await operation(), attempt
                except httpx.HTTPStatusError as error:
                    if attempt >= self._max_attempts or error.response.status_code not in self._retryable_status_codes:
                        raise
                except (httpx.TimeoutException, httpx.NetworkError):
                    if attempt >= self._max_attempts:
                        raise
                await asyncio.sleep(self._retry_backoff_seconds * (2 ** (attempt - 1)))
        raise RuntimeError("Outbound policy exhausted without a result.")

    async def _wait_for_rate_slot(self) -> None:
        while True:
            async with self._rate_lock:
                now = monotonic()
                while self._starts and now - self._starts[0] >= 60:
                    self._starts.popleft()
                if len(self._starts) < self._rate_limit:
                    self._starts.append(now)
                    return
                wait_seconds = max(60 - (now - self._starts[0]), 0.001)
            await asyncio.sleep(wait_seconds)


_policies: dict[tuple, AsyncOutboundPolicy] = {}


def get_outbound_policy(*, lane: str, concurrency_limit: int, requests_per_minute: int,
                        max_attempts: int, retryable_status_codes: set[int],
                        retry_backoff_seconds: float = 0.25) -> AsyncOutboundPolicy:
    key = (lane, concurrency_limit, requests_per_minute, max_attempts, tuple(sorted(retryable_status_codes)), retry_backoff_seconds)
    if key not in _policies:
        _policies[key] = AsyncOutboundPolicy(
            concurrency_limit=concurrency_limit, requests_per_minute=requests_per_minute,
            max_attempts=max_attempts, retryable_status_codes=retryable_status_codes,
            retry_backoff_seconds=retry_backoff_seconds,
        )
    return _policies[key]
