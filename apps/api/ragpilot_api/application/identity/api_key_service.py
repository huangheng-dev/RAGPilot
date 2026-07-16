from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from collections import OrderedDict
from datetime import datetime, timezone
from uuid import UUID

from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.application.identity.access_policy import get_role_capabilities
from ragpilot_api.contracts.http.api_key_contracts import ApiKeyCreateRequest, ApiKeyCreatedResponse, ApiKeyResponse
from ragpilot_api.infrastructure.database.models import ApiKey
from ragpilot_api.infrastructure.database.repositories.api_key_repository import ApiKeyRepository


API_KEY_USAGE_TOUCH_INTERVAL_SECONDS = 60.0
API_KEY_USAGE_CACHE_MAX_ENTRIES = 4096
_api_key_usage_touches: OrderedDict[UUID, float] = OrderedDict()


class ApiKeyService:
    def __init__(self, repository: ApiKeyRepository) -> None:
        self.repository = repository

    async def create(self, request: ApiKeyCreateRequest, *, actor_user_id: UUID | None) -> ApiKeyCreatedResponse:
        allowed = get_role_capabilities(request.role)
        scopes = sorted(set(request.scopes))
        invalid = [scope for scope in scopes if scope not in allowed]
        if invalid:
            raise ResourceConflictError(f"API key scopes exceed the selected role: {', '.join(invalid)}")
        if request.expires_at is not None and request.expires_at <= datetime.now(timezone.utc):
            raise ResourceConflictError("API key expiry must be in the future.")
        prefix = secrets.token_hex(6)
        secret = f"rpk_{prefix}_{secrets.token_urlsafe(32)}"
        item = await self.repository.create(
            tenant_id=request.tenant_id, name=request.name.strip(), key_prefix=prefix,
            key_hash=hashlib.sha256(secret.encode("utf-8")).hexdigest(), role=request.role,
            scopes=scopes, created_by_user_id=actor_user_id, expires_at=request.expires_at,
        )
        return ApiKeyCreatedResponse(**build_api_key_response(item).model_dump(), secret=secret)

    async def authenticate(self, secret: str) -> ApiKey | None:
        prefix = extract_api_key_prefix(secret)
        if prefix is None:
            return None
        item = await self.repository.get_by_prefix(key_prefix=prefix)
        if item is None or item.revoked_at is not None:
            return None
        if item.expires_at is not None and item.expires_at <= datetime.now(timezone.utc):
            return None
        digest = hashlib.sha256(secret.encode("utf-8")).hexdigest()
        if not hmac.compare_digest(item.key_hash, digest):
            return None
        if _reserve_usage_touch(item.id):
            try:
                await self.repository.mark_used(item=item)
            except Exception:
                _api_key_usage_touches.pop(item.id, None)
                raise
        return item

    async def list(self, *, tenant_id: UUID) -> list[ApiKeyResponse]:
        return [build_api_key_response(item) for item in await self.repository.list(tenant_id=tenant_id)]

    async def revoke(self, *, api_key_id: UUID, tenant_id: UUID, actor_user_id: UUID | None, reason: str | None) -> ApiKeyResponse:
        item = await self.repository.get(api_key_id=api_key_id, tenant_id=tenant_id)
        if item is None:
            raise ResourceNotFoundError("API key not found.")
        return build_api_key_response(await self.repository.revoke(item=item, actor_user_id=actor_user_id, reason=reason))


def extract_api_key_prefix(secret: str) -> str | None:
    parts = secret.split("_", 2)
    if len(parts) != 3 or parts[0] != "rpk" or len(parts[1]) != 12:
        return None
    return parts[1]


def _reserve_usage_touch(api_key_id: UUID, *, now: float | None = None) -> bool:
    observed_at = time.monotonic() if now is None else now
    previous = _api_key_usage_touches.get(api_key_id)
    if previous is not None and observed_at - previous < API_KEY_USAGE_TOUCH_INTERVAL_SECONDS:
        return False
    _api_key_usage_touches[api_key_id] = observed_at
    _api_key_usage_touches.move_to_end(api_key_id)
    while len(_api_key_usage_touches) > API_KEY_USAGE_CACHE_MAX_ENTRIES:
        _api_key_usage_touches.popitem(last=False)
    return True


def build_api_key_response(item: ApiKey) -> ApiKeyResponse:
    return ApiKeyResponse(
        id=item.id, tenant_id=item.tenant_id, name=item.name, key_prefix=f"rpk_{item.key_prefix}",
        role=item.role, scopes=list(item.scopes_json or []), created_by_user_id=item.created_by_user_id,
        expires_at=item.expires_at, last_used_at=item.last_used_at, revoked_at=item.revoked_at,
        created_at=item.created_at, updated_at=item.updated_at,
    )
