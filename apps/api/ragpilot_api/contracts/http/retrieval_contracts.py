from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from typing import Literal


class RetrievalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: UUID
    knowledge_base_id: UUID
    query_text: str = Field(min_length=1, max_length=8000)
    top_k: int = Field(default=5, ge=1, le=20)


class RetrievalResultChunkResponse(BaseModel):
    document_chunk_id: UUID
    document_id: UUID
    document_version_id: UUID
    knowledge_base_id: UUID
    document_title: str
    chunk_index: int
    content: str
    token_count: int | None
    score: float
    vector_score: float | None = None
    lexical_score: float | None = None
    lexical_normalized_score: float | None = None
    rerank_score: float | None = None
    rerank_rank: int | None = None
    embedding_model: str | None
    retrieval_method: str
    metadata_json: dict
    created_at: datetime


class RetrievalResponse(BaseModel):
    tenant_id: UUID
    knowledge_base_id: UUID
    query_text: str
    engine_name: str
    retrieval_profile_id: UUID | None = None
    retrieval_profile_name: str | None = None
    retrieval_profile_source: str | None = None
    retrieval_mode: str
    embedding_model: str
    effective_top_k: int
    rerank_applied: bool = False
    rerank_strategy: str | None = None
    rerank_window: int | None = None
    results: list[RetrievalResultChunkResponse]


class RetrievalEngineDiagnosticsResponse(BaseModel):
    engine_name: str
    retrieval_profile_id: UUID | None = None
    retrieval_profile_name: str | None = None
    retrieval_profile_source: str | None = None
    retrieval_mode: str
    embedding_model: str
    effective_top_k: int
    rerank_applied: bool = False
    rerank_strategy: str | None = None
    rerank_window: int | None = None
    result_count: int
    retrieval_method_breakdown: dict[str, int]
    top_result_chunk_id: UUID | None = None
    top_result_document_title: str | None = None
    results: list[RetrievalResultChunkResponse]


class RetrievalCompareRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: UUID
    knowledge_base_id: UUID
    query_text: str = Field(min_length=1, max_length=8000)
    top_k: int = Field(default=5, ge=1, le=20)
    baseline_engine: str = Field(default="native", min_length=1, max_length=64)
    candidate_engine: str = Field(default="llamaindex_pilot", min_length=1, max_length=64)


class RetrievalComparisonSummaryResponse(BaseModel):
    shared_chunk_ids: list[UUID]
    baseline_only_chunk_ids: list[UUID]
    candidate_only_chunk_ids: list[UUID]
    shared_result_count: int
    baseline_only_count: int
    candidate_only_count: int
    top_result_matches: bool
    recommendation_status: str
    recommendation_reason: str


class RetrievalCompareResponse(BaseModel):
    tenant_id: UUID
    knowledge_base_id: UUID
    query_text: str
    baseline: RetrievalEngineDiagnosticsResponse
    candidate: RetrievalEngineDiagnosticsResponse
    summary: RetrievalComparisonSummaryResponse


RetrievalEvaluationMode = Literal["inspect", "compare"]
RetrievalValidationStatus = Literal["ready", "review", "hold", "empty", "failed"]
RetrievalFollowUpStatus = Literal["pending", "resolved"]
RetrievalEvaluationFollowUpActionKey = Literal[
    "review_knowledge_base_governance",
    "review_retrieval_profile_governance",
    "rerun_retrieval_inspection",
    "rerun_retrieval_comparison",
    "validate_in_chat",
]
RetrievalEvaluationFollowUpActionCategory = Literal["governance", "analysis", "validation"]
RetrievalIntelligenceStatus = Literal["stable", "review", "hold"]


class RetrievalEvaluationCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: UUID
    workspace_id: UUID
    knowledge_base_id: UUID
    evaluation_mode: RetrievalEvaluationMode
    validation_status: RetrievalValidationStatus
    query_text: str = Field(min_length=1, max_length=8000)
    baseline_engine_name: str = Field(min_length=1, max_length=80)
    candidate_engine_name: str | None = Field(default=None, max_length=80)
    retrieval_profile_name: str | None = Field(default=None, max_length=160)
    retrieval_profile_source: str | None = Field(default=None, max_length=80)
    result_count: int = Field(default=0, ge=0, le=100)
    shared_result_count: int | None = Field(default=None, ge=0, le=100)
    baseline_only_count: int | None = Field(default=None, ge=0, le=100)
    candidate_only_count: int | None = Field(default=None, ge=0, le=100)
    top_result_matches: bool | None = None
    recommendation_reason: str | None = Field(default=None, max_length=4000)
    evaluation_payload_json: dict = Field(default_factory=dict)


class RetrievalEvaluationFollowUpUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    follow_up_status: RetrievalFollowUpStatus


class RetrievalEvaluationQueryFollowUpUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: UUID
    workspace_id: UUID
    knowledge_base_id: UUID | None = None
    query_text: str = Field(min_length=1, max_length=8000)
    follow_up_status: RetrievalFollowUpStatus


class RetrievalEvaluationResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    workspace_id: UUID
    knowledge_base_id: UUID
    evaluation_mode: RetrievalEvaluationMode
    validation_status: RetrievalValidationStatus
    query_text: str
    baseline_engine_name: str
    candidate_engine_name: str | None = None
    retrieval_profile_id: UUID | None = None
    retrieval_profile_name: str | None = None
    retrieval_profile_source: str | None = None
    result_count: int
    shared_result_count: int | None = None
    baseline_only_count: int | None = None
    candidate_only_count: int | None = None
    top_result_matches: bool | None = None
    recommendation_reason: str | None = None
    evaluation_payload_json: dict = Field(default_factory=dict)
    follow_up_status: RetrievalFollowUpStatus
    resolved_at: datetime | None = None
    resolved_by_user_id: UUID | None = None
    source_documents: list["RetrievalEvaluationSourceDocumentResponse"] = Field(default_factory=list)
    recommended_actions: list["RetrievalEvaluationFollowUpActionResponse"] = Field(default_factory=list)
    created_by_user_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class RetrievalEvaluationStatusBreakdownResponse(BaseModel):
    ready: int = 0
    review: int = 0
    hold: int = 0
    empty: int = 0
    failed: int = 0


class RetrievalEvaluationFollowUpBreakdownResponse(BaseModel):
    pending: int = 0
    resolved: int = 0


class RetrievalEvaluationSourceDocumentResponse(BaseModel):
    document_id: UUID
    document_title: str
    hit_count: int = 1


class RetrievalEvaluationFollowUpActionResponse(BaseModel):
    action_key: RetrievalEvaluationFollowUpActionKey
    action_category: RetrievalEvaluationFollowUpActionCategory
    action_label: str
    action_reason: str


class RetrievalEvaluationTuningCandidateResponse(BaseModel):
    query_text: str
    evaluation_count: int
    latest_evaluation_mode: RetrievalEvaluationMode
    latest_validation_status: RetrievalValidationStatus
    follow_up_status: RetrievalFollowUpStatus
    ready_count: int = 0
    review_count: int = 0
    hold_count: int = 0
    empty_count: int = 0
    failed_count: int = 0
    pending_evaluation_count: int = 0
    resolved_evaluation_count: int = 0
    attention_score: int = 0
    baseline_engine_name: str
    candidate_engine_name: str | None = None
    retrieval_profile_id: UUID | None = None
    retrieval_profile_name: str | None = None
    retrieval_profile_source: str | None = None
    recommendation_reason: str | None = None
    result_count: int = 0
    shared_result_count: int | None = None
    baseline_only_count: int | None = None
    candidate_only_count: int | None = None
    top_result_matches: bool | None = None
    latest_source_documents: list[RetrievalEvaluationSourceDocumentResponse] = Field(default_factory=list)
    recommended_actions: list[RetrievalEvaluationFollowUpActionResponse] = Field(default_factory=list)
    last_evaluated_at: datetime


class RetrievalEvaluationSummaryResponse(BaseModel):
    tenant_id: UUID
    workspace_id: UUID
    knowledge_base_id: UUID | None = None
    total_evaluations: int = 0
    total_queries: int = 0
    intelligence_status: RetrievalIntelligenceStatus = "stable"
    intelligence_reason: str = ""
    primary_query_text: str | None = None
    primary_baseline_engine_name: str | None = None
    primary_candidate_engine_name: str | None = None
    primary_retrieval_profile_name: str | None = None
    status_breakdown: RetrievalEvaluationStatusBreakdownResponse
    follow_up_breakdown: RetrievalEvaluationFollowUpBreakdownResponse
    primary_recommended_actions: list[RetrievalEvaluationFollowUpActionResponse] = Field(default_factory=list)
    candidates: list[RetrievalEvaluationTuningCandidateResponse] = Field(default_factory=list)
    recent_evaluations: list[RetrievalEvaluationResponse] = Field(default_factory=list)


class RetrievalEvaluationQueryFollowUpUpdateResponse(BaseModel):
    tenant_id: UUID
    workspace_id: UUID
    knowledge_base_id: UUID | None = None
    query_text: str
    follow_up_status: RetrievalFollowUpStatus
    updated_count: int = Field(default=0, ge=0)
    acted_at: datetime
    acted_by_user_id: UUID | None = None
