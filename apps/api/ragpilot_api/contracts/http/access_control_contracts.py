from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AccessGroupCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: UUID
    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=120)
    description: str | None = Field(default=None, max_length=2000)


class AccessGroupResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    slug: str
    description: str | None
    member_user_ids: list[UUID]
    created_at: datetime
    updated_at: datetime


class AccessGroupMembershipMutationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: UUID


class AccessGrantRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: UUID | None = None
    group_id: UUID | None = None

    @model_validator(mode="after")
    def exactly_one_subject(self):
        if (self.user_id is None) == (self.group_id is None):
            raise ValueError("Exactly one of user_id or group_id is required.")
        return self


class AccessGrantResponse(BaseModel):
    id: UUID
    user_id: UUID | None
    group_id: UUID | None
    permission: Literal["read"]


class DocumentAccessPolicyUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: UUID
    access_scope: Literal["tenant", "restricted"]
    grants: list[AccessGrantRequest] = Field(default_factory=list, max_length=500)


class ChunkAccessPolicyUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: UUID
    access_scope: Literal["inherit", "restricted"]
    grants: list[AccessGrantRequest] = Field(default_factory=list, max_length=500)


class ResourceAccessPolicyResponse(BaseModel):
    tenant_id: UUID
    resource_type: Literal["document", "document_chunk"]
    resource_id: UUID
    access_scope: str
    grants: list[AccessGrantResponse]
