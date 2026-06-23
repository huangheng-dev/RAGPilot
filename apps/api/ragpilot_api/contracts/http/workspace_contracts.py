from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class WorkspaceCreateRequest(BaseModel):
    tenant_id: UUID
    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str | None = Field(default=None, max_length=2000)


class WorkspaceUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str | None = Field(default=None, max_length=2000)


class WorkspaceResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    slug: str
    description: str | None
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class WorkspaceLifecycleRequest(BaseModel):
    is_archived: bool
