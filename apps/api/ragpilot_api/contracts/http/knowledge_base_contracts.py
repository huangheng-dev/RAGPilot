from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class KnowledgeBaseCreateRequest(BaseModel):
    tenant_id: UUID
    workspace_id: UUID
    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str | None = Field(default=None, max_length=2000)
    retrieval_profile_id: UUID | None = None


class KnowledgeBaseUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str | None = Field(default=None, max_length=2000)
    retrieval_profile_id: UUID | None = None


class KnowledgeBaseResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    workspace_id: UUID
    name: str
    slug: str
    description: str | None
    retrieval_profile_id: UUID | None
    retrieval_profile_name: str | None
    publication_status: str
    created_at: datetime
    updated_at: datetime


class KnowledgeBasePublicationRequest(BaseModel):
    publication_status: str = Field(pattern=r"^(draft|published)$")
