from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


RetrievalMode = Literal["hybrid", "vector", "lexical"]
RetrievalEngineName = Literal["native", "llamaindex_pilot"]
RetrievalProfileGovernanceActionType = Literal["enable_profile", "disable_profile", "promote_default"]


class RetrievalProfileCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    retrieval_mode: RetrievalMode = "hybrid"
    engine_name: RetrievalEngineName = "native"
    engine_version: str = Field(default="native_v1", min_length=1, max_length=80, pattern=r"^[a-z0-9_]+$")
    top_k: int = Field(default=5, ge=1, le=20)
    vector_weight: float = Field(default=0.65, ge=0.0, le=1.0)
    lexical_weight: float = Field(default=0.35, ge=0.0, le=1.0)
    hybrid_overlap_bonus: float = Field(default=0.05, ge=0.0, le=1.0)
    llamaindex_similarity_cutoff: float = Field(default=0.0, ge=0.0, le=1.0)
    llamaindex_long_context_reorder_enabled: bool = True
    is_enabled: bool = True
    is_default: bool = False
    notes: str | None = Field(default=None, max_length=4000)


class RetrievalProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    retrieval_mode: RetrievalMode
    engine_name: RetrievalEngineName | None = None
    engine_version: str | None = Field(default=None, min_length=1, max_length=80, pattern=r"^[a-z0-9_]+$")
    top_k: int = Field(ge=1, le=20)
    vector_weight: float = Field(ge=0.0, le=1.0)
    lexical_weight: float = Field(ge=0.0, le=1.0)
    hybrid_overlap_bonus: float = Field(ge=0.0, le=1.0)
    llamaindex_similarity_cutoff: float | None = Field(default=None, ge=0.0, le=1.0)
    llamaindex_long_context_reorder_enabled: bool | None = None
    is_enabled: bool
    is_default: bool
    notes: str | None = Field(default=None, max_length=4000)


class RetrievalProfileResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    retrieval_mode: RetrievalMode
    engine_name: RetrievalEngineName = "native"
    engine_version: str = "native_v1"
    runtime_ready: bool = True
    runtime_issue: Literal["engine_unavailable"] | None = None
    top_k: int
    vector_weight: float
    lexical_weight: float
    hybrid_overlap_bonus: float
    llamaindex_similarity_cutoff: float = 0.0
    llamaindex_long_context_reorder_enabled: bool = True
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
