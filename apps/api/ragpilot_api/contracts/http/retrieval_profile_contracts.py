from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


RetrievalMode = Literal["hybrid", "vector", "lexical"]
RetrievalProfileGovernanceActionType = Literal["enable_profile", "disable_profile", "promote_default"]


class RetrievalProfileCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    retrieval_mode: RetrievalMode = "hybrid"
    top_k: int = Field(default=5, ge=1, le=20)
    vector_weight: float = Field(default=0.65, ge=0.0, le=1.0)
    lexical_weight: float = Field(default=0.35, ge=0.0, le=1.0)
    hybrid_overlap_bonus: float = Field(default=0.05, ge=0.0, le=1.0)
    is_enabled: bool = True
    is_default: bool = False
    notes: str | None = Field(default=None, max_length=4000)


class RetrievalProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    retrieval_mode: RetrievalMode
    top_k: int = Field(ge=1, le=20)
    vector_weight: float = Field(ge=0.0, le=1.0)
    lexical_weight: float = Field(ge=0.0, le=1.0)
    hybrid_overlap_bonus: float = Field(ge=0.0, le=1.0)
    is_enabled: bool
    is_default: bool
    notes: str | None = Field(default=None, max_length=4000)


class RetrievalProfileResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    retrieval_mode: RetrievalMode
    top_k: int
    vector_weight: float
    lexical_weight: float
    hybrid_overlap_bonus: float
    is_enabled: bool
    is_default: bool
    notes: str | None
    bound_knowledge_base_count: int = 0
    created_at: datetime
    updated_at: datetime


class RetrievalProfileGovernanceActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action_type: RetrievalProfileGovernanceActionType


class RetrievalProfileGovernanceActionResponse(BaseModel):
    action_type: RetrievalProfileGovernanceActionType
    summary: str
    retrieval_profile: RetrievalProfileResponse
