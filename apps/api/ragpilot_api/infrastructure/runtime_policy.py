from __future__ import annotations

import asyncio
import hashlib
import logging
import secrets
import time
from collections import deque
from typing import Awaitable, Callable, Literal, TypeVar

import httpx

T = TypeVar("T")
RedisFailureMode = Literal["local_fallback", "closed"]
_logger = logging.getLogger("ragpilot.runtime_policy")

_ACQUIRE_CONCURRENCY = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local expires = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local token = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, '-inf', now)
if redis.call('ZCARD', key) < limit then
  redis.call('ZADD', key, expires, token)
  redis.call('PEXPIRE', key, math.max(expires - now, 1000))
  return {1, 0}
end
local first = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
if #first == 0 then return {0, 50} end
return {0, math.max(tonumber(first[2]) - now, 1)}
"""

_ACQUIRE_RATE = """
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
if current <= tonumber(ARGV[2]) then return {1, 0} end
return {0, math.max(redis.call('PTTL', KEYS[1]), 1)}
"""

_RENEW_CONCURRENCY = """
if redis.call('ZSCORE', KEYS[1], ARGV[1]) then
  redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
  redis.call('PEXPIRE', KEYS[1], ARGV[3])
  return 1
end
return 0
"""


class RedisRuntimeLimiter:
    def __init__(
        self,
        *,
        redis_url: str,
        lane: str,
        concurrency_limit: int,
        requests_per_minute: int,
        lease_seconds: float,
    ) -> None:
        from redis.asyncio import from_url

        lane_digest = hashlib.sha256(lane.encode("utf-8")).hexdigest()[:24]
        self._redis = from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=0.5,
            socket_timeout=1.0,
        )
        self._concurrency_key = f"ragpilot:runtime:{lane_digest}:concurrency"
        self._rate_prefix = f"ragpilot:runtime:{lane_digest}:rate"
        self._concurrency_limit = max(concurrency_limit, 1)
        self._rate_limit = max(requests_per_minute, 1)
        self._lease_ms = max(int(lease_seconds * 1000), 10_000)

    async def acquire_concurrency(self) -> str:
        token = secrets.token_urlsafe(24)
        while True:
            now_ms = int(time.time() * 1000)
            acquired, wait_ms = await self._redis.eval(
                _ACQUIRE_CONCURRENCY,
                1,
                self._concurrency_key,
                now_ms,
                now_ms + self._lease_ms,
                self._concurrency_limit,
                token,
            )
            if int(acquired) == 1:
                return token
            await asyncio.sleep(min(max(int(wait_ms), 1) / 1000, 1.0))

    async def renew_concurrency(self, token: str) -> bool:
        now_ms = int(time.time() * 1000)
        updated = await self._redis.eval(
            _RENEW_CONCURRENCY,
            1,
            self._concurrency_key,
            token,
            now_ms + self._lease_ms,
            self._lease_ms,
        )
        return bool(updated)

    async def release_concurrency(self, token: str) -> None:
        await self._redis.zrem(self._concurrency_key, token)

    async def wait_for_rate_slot(self) -> None:
        while True:
            window = int(time.time() // 60)
            acquired, wait_ms = await self._redis.eval(
                _ACQUIRE_RATE,
                1,
                f"{self._rate_prefix}:{window}",
                61_000,
                self._rate_limit,
            )
            if int(acquired) == 1:
                return
            await asyncio.sleep(min(max(int(wait_ms), 1) / 1000, 1.0))


class AsyncOutboundPolicy:
    """Local safety boundary with optional Redis-backed cross-instance limits."""

    def __init__(
        self,
        *,
        concurrency_limit: int,
        requests_per_minute: int,
        max_attempts: int,
        retryable_status_codes: set[int],
        retry_backoff_seconds: float = 0.25,
        redis_url: str | None = None,
        lane: str = "outbound",
        redis_failure_mode: RedisFailureMode = "local_fallback",
        concurrency_lease_seconds: float = 300.0,
    ) -> None:
        self._semaphore = asyncio.Semaphore(max(concurrency_limit, 1))
        self._rate_limit = max(requests_per_minute, 1)
        self._max_attempts = max(max_attempts, 1)
        self._retryable_status_codes = retryable_status_codes
        self._retry_backoff_seconds = max(retry_backoff_seconds, 0.0)
        self._starts: deque[float] = deque()
        self._rate_lock = asyncio.Lock()
        self._lane = lane
        self._redis_failure_mode = redis_failure_mode
        self._distributed = (
            RedisRuntimeLimiter(
                redis_url=redis_url,
                lane=lane,
                concurrency_limit=concurrency_limit,
                requests_per_minute=requests_per_minute,
                lease_seconds=concurrency_lease_seconds,
            )
            if redis_url
            else None
        )

    async def execute(self, operation: Callable[[], Awaitable[T]]) -> tuple[T, int]:
        return await self._execute(operation, max_attempts=self._max_attempts)

    async def execute_once(self, operation: Callable[[], Awaitable[T]]) -> tuple[T, int]:
        """Apply limits without replaying a partially-consumed streaming operation."""
        return await self._execute(operation, max_attempts=1)

    async def _execute(self, operation: Callable[[], Awaitable[T]], *, max_attempts: int) -> tuple[T, int]:
        async with self._semaphore:
            token: str | None = None
            heartbeat: asyncio.Task | None = None
            if self._distributed is not None:
                try:
                    token = await self._distributed.acquire_concurrency()
                    heartbeat = asyncio.create_task(self._renew_lease(token))
                except Exception as error:
                    self._handle_redis_failure(error)
            try:
                for attempt in range(1, max_attempts + 1):
                    await self._wait_for_rate_slot()
                    try:
                        return await operation(), attempt
                    except httpx.HTTPStatusError as error:
                        if attempt >= max_attempts or error.response.status_code not in self._retryable_status_codes:
                            raise
                    except (httpx.TimeoutException, httpx.NetworkError):
                        if attempt >= max_attempts:
                            raise
                    await asyncio.sleep(self._retry_backoff_seconds * (2 ** (attempt - 1)))
            finally:
                if heartbeat is not None:
                    heartbeat.cancel()
                if token is not None and self._distributed is not None:
                    try:
                        await self._distributed.release_concurrency(token)
                    except Exception as error:
                        self._handle_redis_failure(error)
        raise RuntimeError("Outbound policy exhausted without a result.")

    async def _renew_lease(self, token: str) -> None:
        try:
            while True:
                await asyncio.sleep(30)
                if self._distributed is None or not await self._distributed.renew_concurrency(token):
                    return
        except asyncio.CancelledError:
            return
        except Exception as error:
            self._handle_redis_failure(error)

    async def _wait_for_rate_slot(self) -> None:
        if self._distributed is not None:
            try:
                await self._distributed.wait_for_rate_slot()
                return
            except Exception as error:
                self._handle_redis_failure(error)
        await self._wait_for_local_rate_slot()

    async def _wait_for_local_rate_slot(self) -> None:
        while True:
            async with self._rate_lock:
                now = time.monotonic()
                while self._starts and now - self._starts[0] >= 60:
                    self._starts.popleft()
                if len(self._starts) < self._rate_limit:
                    self._starts.append(now)
                    return
                wait_seconds = max(60 - (now - self._starts[0]), 0.001)
            await asyncio.sleep(wait_seconds)

    def _handle_redis_failure(self, error: Exception) -> None:
        _logger.warning(
            "Redis runtime limiter unavailable",
            extra={"event": "runtime.limit.redis_unavailable", "operation": self._lane, "error_type": type(error).__name__},
        )
        if self._redis_failure_mode == "closed":
            raise RuntimeError("Distributed runtime limiting is unavailable.") from error


_policies: dict[tuple, AsyncOutboundPolicy] = {}


def get_outbound_policy(
    *,
    lane: str,
    concurrency_limit: int,
    requests_per_minute: int,
    max_attempts: int,
    retryable_status_codes: set[int],
    retry_backoff_seconds: float = 0.25,
    redis_url: str | None = None,
    redis_failure_mode: RedisFailureMode = "local_fallback",
    concurrency_lease_seconds: float = 300.0,
) -> AsyncOutboundPolicy:
    key = (
        lane,
        concurrency_limit,
        requests_per_minute,
        max_attempts,
        tuple(sorted(retryable_status_codes)),
        retry_backoff_seconds,
        redis_url,
        redis_failure_mode,
        concurrency_lease_seconds,
    )
    if key not in _policies:
        _policies[key] = AsyncOutboundPolicy(
            lane=lane,
            concurrency_limit=concurrency_limit,
            requests_per_minute=requests_per_minute,
            max_attempts=max_attempts,
            retryable_status_codes=retryable_status_codes,
            retry_backoff_seconds=retry_backoff_seconds,
            redis_url=redis_url,
            redis_failure_mode=redis_failure_mode,
            concurrency_lease_seconds=concurrency_lease_seconds,
        )
    return _policies[key]
