from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ragpilot_api.infrastructure.database.base import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class Tenant(Base, TimestampMixin):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    email: Mapped[str] = mapped_column(String(320), unique=True)
    display_name: Mapped[str] = mapped_column(String(160))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    role: Mapped[str] = mapped_column(String(40), server_default=text("'operator'"))
    last_signed_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UserSession(Base, TimestampMixin):
    __tablename__ = "user_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    session_token_hash: Mapped[str] = mapped_column(String(128), unique=True)
    authentication_mode: Mapped[str] = mapped_column(String(40), server_default=text("'directory_login'"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TenantMembership(Base, TimestampMixin):
    __tablename__ = "tenant_memberships"
    __table_args__ = (UniqueConstraint("tenant_id", "user_id", name="uq_tenant_memberships_tenant_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    membership_status: Mapped[str] = mapped_column(String(40), server_default=text("'active'"))
    invitation_token: Mapped[str | None] = mapped_column(String(80))
    invitation_issue_count: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    last_invitation_issued_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    invited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    invitation_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Role(Base, TimestampMixin):
    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    is_system: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Permission(Base, TimestampMixin):
    __tablename__ = "permissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    category: Mapped[str] = mapped_column(String(80))
    description: Mapped[str | None] = mapped_column(Text)
    is_system: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RolePermission(Base, TimestampMixin):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_role_permissions_role_permission"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roles.id"))
    permission_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("permissions.id"))
    is_enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))


class Workspace(Base, TimestampMixin):
    __tablename__ = "workspaces"
    __table_args__ = (UniqueConstraint("tenant_id", "slug", name="uq_workspaces_tenant_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    is_archived: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class KnowledgeBase(Base, TimestampMixin):
    __tablename__ = "knowledge_bases"
    __table_args__ = (UniqueConstraint("workspace_id", "slug", name="uq_knowledge_bases_workspace_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id"))
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    retrieval_profile_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("retrieval_profiles.id"))
    publication_status: Mapped[str] = mapped_column(String(40), server_default=text("'draft'"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AgentDefinition(Base, TimestampMixin):
    __tablename__ = "agent_definitions"
    __table_args__ = (UniqueConstraint("tenant_id", "slug", name="uq_agent_definitions_tenant_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(120))
    agent_mode: Mapped[str] = mapped_column(String(40))
    agent_status: Mapped[str] = mapped_column(String(40), server_default=text("'draft'"))
    model_strategy: Mapped[str] = mapped_column(String(40))
    model_endpoint_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("model_endpoints.id"))
    objective: Mapped[str] = mapped_column(Text, server_default=text("''"))
    instructions: Mapped[str] = mapped_column(Text, server_default=text("''"))
    knowledge_base_scope: Mapped[str | None] = mapped_column(String(160))
    tool_bindings_json: Mapped[list[str]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    tool_registration_ids_json: Mapped[list[str]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AgentRun(Base, TimestampMixin):
    __tablename__ = "agent_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    agent_definition_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agent_definitions.id"))
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("workspaces.id"))
    knowledge_base_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("knowledge_bases.id"))
    target_surface: Mapped[str] = mapped_column(String(40))
    handoff_intent: Mapped[str | None] = mapped_column(String(80))
    run_status: Mapped[str] = mapped_column(String(40), server_default=text("'launched'"))
    trigger_source: Mapped[str] = mapped_column(String(80), server_default=text("'agents_console'"))
    launch_prompt: Mapped[str | None] = mapped_column(Text)
    navigation_href: Mapped[str | None] = mapped_column(String(2000))
    launched_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AgentExecution(Base, TimestampMixin):
    __tablename__ = "agent_executions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    agent_definition_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agent_definitions.id"))
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("workspaces.id"))
    knowledge_base_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("knowledge_bases.id"))
    execution_mode: Mapped[str] = mapped_column(String(40))
    execution_status: Mapped[str] = mapped_column(String(40), server_default=text("'queued'"))
    trigger_source: Mapped[str] = mapped_column(String(80), server_default=text("'agents_console'"))
    knowledge_base_scope: Mapped[str | None] = mapped_column(String(160))
    model_endpoint_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("model_endpoints.id"))
    tool_registration_ids_json: Mapped[list[str]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    execution_input: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    result_payload_json: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    error_message: Mapped[str | None] = mapped_column(Text)
    launched_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ModelEndpoint(Base, TimestampMixin):
    __tablename__ = "model_endpoints"
    __table_args__ = (UniqueConstraint("slug", name="uq_model_endpoints_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(120))
    provider_type: Mapped[str] = mapped_column(String(40))
    model_name: Mapped[str] = mapped_column(String(160))
    base_url: Mapped[str | None] = mapped_column(String(500))
    credential_mode: Mapped[str] = mapped_column(String(40), server_default=text("'none'"))
    credential_key_hint: Mapped[str | None] = mapped_column(String(160))
    capabilities_json: Mapped[list[str]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    is_enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    is_default: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    notes: Mapped[str | None] = mapped_column(Text)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RetrievalProfile(Base, TimestampMixin):
    __tablename__ = "retrieval_profiles"
    __table_args__ = (UniqueConstraint("slug", name="uq_retrieval_profiles_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(120))
    retrieval_mode: Mapped[str] = mapped_column(String(40), server_default=text("'hybrid'"))
    top_k: Mapped[int] = mapped_column(Integer, server_default=text("5"))
    vector_weight: Mapped[Decimal] = mapped_column(Numeric(4, 3), server_default=text("0.650"))
    lexical_weight: Mapped[Decimal] = mapped_column(Numeric(4, 3), server_default=text("0.350"))
    hybrid_overlap_bonus: Mapped[Decimal] = mapped_column(Numeric(4, 3), server_default=text("0.050"))
    is_enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    is_default: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    notes: Mapped[str | None] = mapped_column(Text)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RetrievalEvaluation(Base, TimestampMixin):
    __tablename__ = "retrieval_evaluations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id"))
    knowledge_base_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("knowledge_bases.id"))
    evaluation_mode: Mapped[str] = mapped_column(String(40))
    validation_status: Mapped[str] = mapped_column(String(40))
    query_text: Mapped[str] = mapped_column(Text)
    baseline_engine_name: Mapped[str] = mapped_column(String(80))
    candidate_engine_name: Mapped[str | None] = mapped_column(String(80))
    retrieval_profile_name: Mapped[str | None] = mapped_column(String(160))
    retrieval_profile_source: Mapped[str | None] = mapped_column(String(80))
    result_count: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    shared_result_count: Mapped[int | None] = mapped_column(Integer)
    baseline_only_count: Mapped[int | None] = mapped_column(Integer)
    candidate_only_count: Mapped[int | None] = mapped_column(Integer)
    top_result_matches: Mapped[bool | None] = mapped_column(Boolean)
    recommendation_reason: Mapped[str | None] = mapped_column(Text)
    evaluation_payload_json: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))


class ToolRegistration(Base, TimestampMixin):
    __tablename__ = "tool_registrations"
    __table_args__ = (UniqueConstraint("slug", name="uq_tool_registrations_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(120))
    transport_type: Mapped[str] = mapped_column(String(40))
    surface_area: Mapped[str] = mapped_column(String(40))
    endpoint_url: Mapped[str | None] = mapped_column(String(500))
    connector_reference: Mapped[str | None] = mapped_column(String(240))
    description: Mapped[str | None] = mapped_column(Text)
    capabilities_json: Mapped[list[str]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    requires_admin_approval: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    is_enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class McpConnector(Base, TimestampMixin):
    __tablename__ = "mcp_connectors"
    __table_args__ = (UniqueConstraint("slug", name="uq_mcp_connectors_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(120))
    connector_type: Mapped[str] = mapped_column(String(40))
    base_url: Mapped[str | None] = mapped_column(String(500))
    auth_mode: Mapped[str] = mapped_column(String(40), server_default=text("'none'"))
    credential_key_hint: Mapped[str | None] = mapped_column(String(160))
    notes: Mapped[str | None] = mapped_column(Text)
    is_enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Document(Base, TimestampMixin):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    knowledge_base_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("knowledge_bases.id"))
    title: Mapped[str] = mapped_column(String(240))
    source_uri: Mapped[str | None] = mapped_column(Text)
    ingestion_status: Mapped[str] = mapped_column(String(40), server_default=text("'pending'"))
    indexing_status: Mapped[str] = mapped_column(String(40), server_default=text("'pending'"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DocumentVersion(Base, TimestampMixin):
    __tablename__ = "document_versions"
    __table_args__ = (UniqueConstraint("document_id", "version_number", name="uq_document_versions_document_version"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id"))
    version_number: Mapped[int] = mapped_column(Integer)
    content_hash: Mapped[str] = mapped_column(String(128))
    parser_name: Mapped[str | None] = mapped_column(String(120))
    ingestion_status: Mapped[str] = mapped_column(String(40), server_default=text("'pending'"))


class DocumentAsset(Base):
    __tablename__ = "document_assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    document_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("document_versions.id"))
    storage_bucket: Mapped[str] = mapped_column(String(160))
    storage_key: Mapped[str] = mapped_column(Text)
    file_name: Mapped[str] = mapped_column(String(260))
    content_type: Mapped[str | None] = mapped_column(String(160))
    file_size_bytes: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = (UniqueConstraint("document_version_id", "chunk_index", name="uq_document_chunks_version_index"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    document_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("document_versions.id"))
    chunk_index: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    token_count: Mapped[int | None] = mapped_column(Integer)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class DocumentChunkEmbedding(Base):
    __tablename__ = "document_chunk_embeddings"
    __table_args__ = (UniqueConstraint("document_chunk_id", "embedding_model", name="uq_document_chunk_embeddings_chunk_model"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    document_chunk_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("document_chunks.id"))
    embedding_model: Mapped[str] = mapped_column(String(160))
    embedding_dimension: Mapped[int] = mapped_column(Integer)
    embedding: Mapped[list[float]] = mapped_column(Vector(1536))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class Conversation(Base, TimestampMixin):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id"))
    knowledge_base_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("knowledge_bases.id"))
    title: Mapped[str] = mapped_column(String(240))
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id"))
    role: Mapped[str] = mapped_column(String(40))
    content: Mapped[str] = mapped_column(Text)
    model_name: Mapped[str | None] = mapped_column(String(160))
    usage_json: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class MessageFeedbackEntry(Base, TimestampMixin):
    __tablename__ = "message_feedback_entries"
    __table_args__ = (
        UniqueConstraint("message_id", "submitted_by_user_id", name="uq_message_feedback_entries_message_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    message_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("messages.id"))
    submitted_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    answer_quality: Mapped[str] = mapped_column(String(40))
    citation_quality: Mapped[str] = mapped_column(String(40))
    issue_labels_json: Mapped[list[str]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    feedback_notes: Mapped[str | None] = mapped_column(Text)


class MessageCitation(Base):
    __tablename__ = "message_citations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    message_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("messages.id"))
    document_chunk_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("document_chunks.id"))
    rank: Mapped[int] = mapped_column(Integer)
    score: Mapped[Decimal | None] = mapped_column(Numeric(10, 6))
    quote: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class WorkflowRun(Base, TimestampMixin):
    __tablename__ = "workflow_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    workflow_type: Mapped[str] = mapped_column(String(120))
    workflow_status: Mapped[str] = mapped_column(String(40), server_default=text("'pending'"))
    temporal_workflow_id: Mapped[str | None] = mapped_column(String(240))
    subject_type: Mapped[str | None] = mapped_column(String(120))
    subject_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    input_json: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class WorkflowStep(Base, TimestampMixin):
    __tablename__ = "workflow_steps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    workflow_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workflow_runs.id"))
    step_name: Mapped[str] = mapped_column(String(160))
    step_status: Mapped[str] = mapped_column(String(40), server_default=text("'pending'"))
    attempt_count: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UserAccessEvent(Base):
    __tablename__ = "user_access_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tenants.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    membership_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tenant_memberships.id"))
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    event_type: Mapped[str] = mapped_column(String(80))
    detail_json: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
