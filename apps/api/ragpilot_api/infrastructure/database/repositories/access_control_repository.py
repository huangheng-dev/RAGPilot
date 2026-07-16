from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.infrastructure.database.models import (
    AccessGroup,
    AccessGroupMembership,
    Document,
    DocumentAccessGrant,
    DocumentChunk,
    DocumentChunkAccessGrant,
    DocumentVersion,
    TenantMembership,
)


@dataclass(frozen=True)
class ResourceAccessPolicyRecord:
    tenant_id: UUID
    resource_type: str
    resource_id: UUID
    access_scope: str
    grants: list[DocumentAccessGrant | DocumentChunkAccessGrant]


class AccessControlRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_group(self, *, tenant_id: UUID, name: str, slug: str, description: str | None) -> AccessGroup:
        group = AccessGroup(tenant_id=tenant_id, name=name, slug=slug, description=description)
        self.session.add(group)
        await self.session.commit()
        await self.session.refresh(group)
        return group

    async def list_groups(self, *, tenant_id: UUID) -> list[tuple[AccessGroup, list[UUID]]]:
        groups = list(await self.session.scalars(
            select(AccessGroup)
            .where(AccessGroup.tenant_id == tenant_id, AccessGroup.deleted_at.is_(None))
            .order_by(AccessGroup.name.asc())
        ))
        if not groups:
            return []
        memberships = (await self.session.execute(
            select(AccessGroupMembership.group_id, AccessGroupMembership.user_id)
            .where(AccessGroupMembership.group_id.in_([group.id for group in groups]))
            .order_by(AccessGroupMembership.created_at.asc())
        )).all()
        members_by_group: dict[UUID, list[UUID]] = {group.id: [] for group in groups}
        for group_id, user_id in memberships:
            members_by_group[group_id].append(user_id)
        return [(group, members_by_group[group.id]) for group in groups]

    async def get_group(self, *, tenant_id: UUID, group_id: UUID) -> AccessGroup | None:
        return await self.session.scalar(select(AccessGroup).where(
            AccessGroup.id == group_id, AccessGroup.tenant_id == tenant_id, AccessGroup.deleted_at.is_(None)
        ))

    async def add_group_member(self, *, tenant_id: UUID, group_id: UUID, user_id: UUID) -> bool:
        group = await self.get_group(tenant_id=tenant_id, group_id=group_id)
        if group is None:
            return False
        active_membership = await self.session.scalar(select(TenantMembership.id).where(
            TenantMembership.tenant_id == tenant_id,
            TenantMembership.user_id == user_id,
            TenantMembership.membership_status == "active",
        ))
        if active_membership is None:
            raise ValueError("User must have an active membership in the group's tenant.")
        existing = await self.session.scalar(select(AccessGroupMembership.id).where(
            AccessGroupMembership.group_id == group_id, AccessGroupMembership.user_id == user_id
        ))
        if existing is None:
            self.session.add(AccessGroupMembership(tenant_id=tenant_id, group_id=group_id, user_id=user_id))
            await self.session.commit()
        return True

    async def remove_group_member(self, *, tenant_id: UUID, group_id: UUID, user_id: UUID) -> bool:
        if await self.get_group(tenant_id=tenant_id, group_id=group_id) is None:
            return False
        result = await self.session.execute(delete(AccessGroupMembership).where(
            AccessGroupMembership.group_id == group_id,
            AccessGroupMembership.user_id == user_id,
            AccessGroupMembership.tenant_id == tenant_id,
        ))
        await self.session.commit()
        return bool(result.rowcount)

    async def get_document_policy(self, *, tenant_id: UUID, document_id: UUID) -> ResourceAccessPolicyRecord | None:
        document = await self.session.scalar(select(Document).where(Document.id == document_id, Document.tenant_id == tenant_id))
        if document is None:
            return None
        grants = list(await self.session.scalars(select(DocumentAccessGrant).where(
            DocumentAccessGrant.document_id == document_id, DocumentAccessGrant.tenant_id == tenant_id
        ).order_by(DocumentAccessGrant.created_at.asc())))
        return ResourceAccessPolicyRecord(tenant_id, "document", document_id, document.access_scope, grants)

    async def replace_document_policy(
        self, *, tenant_id: UUID, document_id: UUID, access_scope: str,
        grants: list[tuple[UUID | None, UUID | None]], created_by_user_id: UUID | None,
    ) -> ResourceAccessPolicyRecord | None:
        document = await self.session.scalar(select(Document).where(Document.id == document_id, Document.tenant_id == tenant_id))
        if document is None:
            return None
        await self._validate_subjects(tenant_id=tenant_id, grants=grants)
        document.access_scope = access_scope
        await self.session.execute(delete(DocumentAccessGrant).where(DocumentAccessGrant.document_id == document_id))
        self.session.add_all([
            DocumentAccessGrant(
                tenant_id=tenant_id, document_id=document_id, user_id=user_id, group_id=group_id,
                permission="read", created_by_user_id=created_by_user_id,
            )
            for user_id, group_id in grants
        ])
        await self.session.commit()
        return await self.get_document_policy(tenant_id=tenant_id, document_id=document_id)

    async def get_chunk_policy(self, *, tenant_id: UUID, chunk_id: UUID) -> ResourceAccessPolicyRecord | None:
        chunk = await self._get_chunk(tenant_id=tenant_id, chunk_id=chunk_id)
        if chunk is None:
            return None
        grants = list(await self.session.scalars(select(DocumentChunkAccessGrant).where(
            DocumentChunkAccessGrant.document_chunk_id == chunk_id,
            DocumentChunkAccessGrant.tenant_id == tenant_id,
        ).order_by(DocumentChunkAccessGrant.created_at.asc())))
        return ResourceAccessPolicyRecord(tenant_id, "document_chunk", chunk_id, chunk.access_scope, grants)

    async def replace_chunk_policy(
        self, *, tenant_id: UUID, chunk_id: UUID, access_scope: str,
        grants: list[tuple[UUID | None, UUID | None]], created_by_user_id: UUID | None,
    ) -> ResourceAccessPolicyRecord | None:
        chunk = await self._get_chunk(tenant_id=tenant_id, chunk_id=chunk_id)
        if chunk is None:
            return None
        await self._validate_subjects(tenant_id=tenant_id, grants=grants)
        chunk.access_scope = access_scope
        await self.session.execute(delete(DocumentChunkAccessGrant).where(DocumentChunkAccessGrant.document_chunk_id == chunk_id))
        self.session.add_all([
            DocumentChunkAccessGrant(
                tenant_id=tenant_id, document_chunk_id=chunk_id, user_id=user_id, group_id=group_id,
                permission="read", created_by_user_id=created_by_user_id,
            )
            for user_id, group_id in grants
        ])
        await self.session.commit()
        return await self.get_chunk_policy(tenant_id=tenant_id, chunk_id=chunk_id)

    async def _get_chunk(self, *, tenant_id: UUID, chunk_id: UUID) -> DocumentChunk | None:
        return await self.session.scalar(
            select(DocumentChunk)
            .join(DocumentVersion, DocumentVersion.id == DocumentChunk.document_version_id)
            .join(Document, Document.id == DocumentVersion.document_id)
            .where(DocumentChunk.id == chunk_id, DocumentChunk.tenant_id == tenant_id, Document.tenant_id == tenant_id)
        )

    async def _validate_subjects(self, *, tenant_id: UUID, grants: list[tuple[UUID | None, UUID | None]]) -> None:
        user_ids = {user_id for user_id, _ in grants if user_id is not None}
        group_ids = {group_id for _, group_id in grants if group_id is not None}
        if len(user_ids) + len(group_ids) != len(grants):
            raise ValueError("Duplicate access grant subject.")
        if user_ids:
            valid_user_ids = set(await self.session.scalars(select(TenantMembership.user_id).where(
                TenantMembership.tenant_id == tenant_id,
                TenantMembership.user_id.in_(user_ids),
                TenantMembership.membership_status == "active",
            )))
            if valid_user_ids != user_ids:
                raise ValueError("Every granted user must have an active tenant membership.")
        if group_ids:
            valid_group_ids = set(await self.session.scalars(select(AccessGroup.id).where(
                AccessGroup.tenant_id == tenant_id, AccessGroup.id.in_(group_ids), AccessGroup.deleted_at.is_(None)
            )))
            if valid_group_ids != group_ids:
                raise ValueError("Every granted group must belong to the resource tenant.")
