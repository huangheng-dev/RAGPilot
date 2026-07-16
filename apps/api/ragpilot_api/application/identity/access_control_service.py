from __future__ import annotations

from uuid import UUID

from sqlalchemy.exc import IntegrityError

from ragpilot_api.contracts.http.access_control_contracts import (
    AccessGrantResponse,
    AccessGroupCreateRequest,
    AccessGroupResponse,
    ChunkAccessPolicyUpdateRequest,
    DocumentAccessPolicyUpdateRequest,
    ResourceAccessPolicyResponse,
)
from ragpilot_api.infrastructure.database.repositories.access_control_repository import (
    AccessControlRepository,
    ResourceAccessPolicyRecord,
)
from ragpilot_api.infrastructure.database.repositories.runtime_governance_event_repository import RuntimeGovernanceEventRepository


class AccessControlService:
    def __init__(
        self,
        repository: AccessControlRepository,
        event_repository: RuntimeGovernanceEventRepository,
    ) -> None:
        self.repository = repository
        self.event_repository = event_repository

    async def create_group(
        self, request: AccessGroupCreateRequest, *, actor_user_id: UUID | None, actor_role: str | None,
    ) -> AccessGroupResponse:
        try:
            group = await self.repository.create_group(
                tenant_id=request.tenant_id,
                name=request.name.strip(),
                slug=request.slug.strip().lower(),
                description=request.description.strip() if request.description else None,
            )
        except IntegrityError as error:
            await self.repository.session.rollback()
            raise ValueError("An access group with this slug already exists in the tenant.") from error
        await self._audit(
            actor_user_id=actor_user_id, actor_role=actor_role, resource_type="access_group",
            resource_id=group.id, resource_name=group.name, resource_slug=group.slug,
            action_type="access_group_created", detail={"tenant_id": str(group.tenant_id)},
        )
        return self._group_response(group, [])

    async def list_groups(self, *, tenant_id: UUID) -> list[AccessGroupResponse]:
        return [self._group_response(group, member_ids) for group, member_ids in await self.repository.list_groups(tenant_id=tenant_id)]

    async def set_group_member(
        self, *, tenant_id: UUID, group_id: UUID, user_id: UUID, enabled: bool,
        actor_user_id: UUID | None, actor_role: str | None,
    ) -> bool:
        group = await self.repository.get_group(tenant_id=tenant_id, group_id=group_id)
        if group is None:
            return False
        changed = (
            await self.repository.add_group_member(tenant_id=tenant_id, group_id=group_id, user_id=user_id)
            if enabled else
            await self.repository.remove_group_member(tenant_id=tenant_id, group_id=group_id, user_id=user_id)
        )
        await self._audit(
            actor_user_id=actor_user_id, actor_role=actor_role, resource_type="access_group",
            resource_id=group.id, resource_name=group.name, resource_slug=group.slug,
            action_type="access_group_member_added" if enabled else "access_group_member_removed",
            detail={"tenant_id": str(tenant_id), "user_id": str(user_id), "changed": changed},
        )
        return True

    async def get_document_policy(self, *, tenant_id: UUID, document_id: UUID) -> ResourceAccessPolicyResponse | None:
        return self._policy_response(await self.repository.get_document_policy(tenant_id=tenant_id, document_id=document_id))

    async def update_document_policy(
        self, *, document_id: UUID, request: DocumentAccessPolicyUpdateRequest,
        actor_user_id: UUID | None, actor_role: str | None,
    ) -> ResourceAccessPolicyResponse | None:
        record = await self.repository.replace_document_policy(
            tenant_id=request.tenant_id,
            document_id=document_id,
            access_scope=request.access_scope,
            grants=[(grant.user_id, grant.group_id) for grant in request.grants],
            created_by_user_id=actor_user_id,
        )
        if record is None:
            return None
        await self._audit_policy(record, actor_user_id=actor_user_id, actor_role=actor_role)
        return self._policy_response(record)

    async def get_chunk_policy(self, *, tenant_id: UUID, chunk_id: UUID) -> ResourceAccessPolicyResponse | None:
        return self._policy_response(await self.repository.get_chunk_policy(tenant_id=tenant_id, chunk_id=chunk_id))

    async def update_chunk_policy(
        self, *, chunk_id: UUID, request: ChunkAccessPolicyUpdateRequest,
        actor_user_id: UUID | None, actor_role: str | None,
    ) -> ResourceAccessPolicyResponse | None:
        record = await self.repository.replace_chunk_policy(
            tenant_id=request.tenant_id,
            chunk_id=chunk_id,
            access_scope=request.access_scope,
            grants=[(grant.user_id, grant.group_id) for grant in request.grants],
            created_by_user_id=actor_user_id,
        )
        if record is None:
            return None
        await self._audit_policy(record, actor_user_id=actor_user_id, actor_role=actor_role)
        return self._policy_response(record)

    async def _audit_policy(
        self, record: ResourceAccessPolicyRecord, *, actor_user_id: UUID | None, actor_role: str | None,
    ) -> None:
        await self._audit(
            actor_user_id=actor_user_id, actor_role=actor_role,
            resource_type=record.resource_type, resource_id=record.resource_id,
            resource_name=None, resource_slug=None, action_type="retrieval_access_policy_replaced",
            detail={
                "tenant_id": str(record.tenant_id),
                "access_scope": record.access_scope,
                "grant_count": len(record.grants),
                "user_ids": [str(grant.user_id) for grant in record.grants if grant.user_id],
                "group_ids": [str(grant.group_id) for grant in record.grants if grant.group_id],
            },
        )

    async def _audit(self, **kwargs) -> None:
        await self.event_repository.create_runtime_governance_event(**kwargs)

    @staticmethod
    def _group_response(group, member_ids: list[UUID]) -> AccessGroupResponse:
        return AccessGroupResponse(
            id=group.id, tenant_id=group.tenant_id, name=group.name, slug=group.slug,
            description=group.description, member_user_ids=member_ids,
            created_at=group.created_at, updated_at=group.updated_at,
        )

    @staticmethod
    def _policy_response(record: ResourceAccessPolicyRecord | None) -> ResourceAccessPolicyResponse | None:
        if record is None:
            return None
        return ResourceAccessPolicyResponse(
            tenant_id=record.tenant_id,
            resource_type=record.resource_type,
            resource_id=record.resource_id,
            access_scope=record.access_scope,
            grants=[
                AccessGrantResponse(id=grant.id, user_id=grant.user_id, group_id=grant.group_id, permission="read")
                for grant in record.grants
            ],
        )
