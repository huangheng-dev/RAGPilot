"""create initial platform tables

Revision ID: 202606120001
Revises:
Create Date: 2026-06-12 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql


revision: str = "202606120001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "vector"')

    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("slug", name="uq_tenants_slug"),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("display_name", sa.String(length=160), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )

    op.create_table(
        "tenant_memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("membership_status", sa.String(length=40), nullable=False, server_default=sa.text("'active'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_tenant_memberships_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_tenant_memberships_user_id_users"),
        sa.UniqueConstraint("tenant_id", "user_id", name="uq_tenant_memberships_tenant_user"),
    )

    op.create_table(
        "workspaces",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_workspaces_tenant_id_tenants"),
        sa.UniqueConstraint("tenant_id", "slug", name="uq_workspaces_tenant_slug"),
    )

    op.create_table(
        "knowledge_bases",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("publication_status", sa.String(length=40), nullable=False, server_default=sa.text("'draft'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_knowledge_bases_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], name="fk_knowledge_bases_workspace_id_workspaces"),
        sa.UniqueConstraint("workspace_id", "slug", name="uq_knowledge_bases_workspace_slug"),
    )

    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("knowledge_base_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("source_uri", sa.Text(), nullable=True),
        sa.Column("ingestion_status", sa.String(length=40), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("indexing_status", sa.String(length=40), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_documents_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["knowledge_base_id"], ["knowledge_bases.id"], name="fk_documents_knowledge_base_id_knowledge_bases"),
    )

    op.create_table(
        "document_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("content_hash", sa.String(length=128), nullable=False),
        sa.Column("parser_name", sa.String(length=120), nullable=True),
        sa.Column("ingestion_status", sa.String(length=40), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_document_versions_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], name="fk_document_versions_document_id_documents"),
        sa.UniqueConstraint("document_id", "version_number", name="uq_document_versions_document_version"),
    )

    op.create_table(
        "document_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("storage_bucket", sa.String(length=160), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("file_name", sa.String(length=260), nullable=False),
        sa.Column("content_type", sa.String(length=160), nullable=True),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_document_assets_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["document_version_id"], ["document_versions.id"], name="fk_document_assets_document_version_id_document_versions"),
    )

    op.create_table(
        "document_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_document_chunks_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["document_version_id"], ["document_versions.id"], name="fk_document_chunks_document_version_id_document_versions"),
        sa.UniqueConstraint("document_version_id", "chunk_index", name="uq_document_chunks_version_index"),
    )

    op.create_table(
        "document_chunk_embeddings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_chunk_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("embedding_model", sa.String(length=160), nullable=False),
        sa.Column("embedding_dimension", sa.Integer(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_document_chunk_embeddings_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["document_chunk_id"], ["document_chunks.id"], name="fk_document_chunk_embeddings_document_chunk_id_document_chunks"),
        sa.UniqueConstraint("document_chunk_id", "embedding_model", name="uq_document_chunk_embeddings_chunk_model"),
    )

    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("knowledge_base_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_conversations_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], name="fk_conversations_workspace_id_workspaces"),
        sa.ForeignKeyConstraint(["knowledge_base_id"], ["knowledge_bases.id"], name="fk_conversations_knowledge_base_id_knowledge_bases"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], name="fk_conversations_created_by_user_id_users"),
    )

    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=40), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("model_name", sa.String(length=160), nullable=True),
        sa.Column("usage_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_messages_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], name="fk_messages_conversation_id_conversations"),
    )

    op.create_table(
        "message_citations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_chunk_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("score", sa.Numeric(precision=10, scale=6), nullable=True),
        sa.Column("quote", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_message_citations_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["message_id"], ["messages.id"], name="fk_message_citations_message_id_messages"),
        sa.ForeignKeyConstraint(["document_chunk_id"], ["document_chunks.id"], name="fk_message_citations_document_chunk_id_document_chunks"),
    )

    op.create_table(
        "workflow_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workflow_type", sa.String(length=120), nullable=False),
        sa.Column("workflow_status", sa.String(length=40), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("temporal_workflow_id", sa.String(length=240), nullable=True),
        sa.Column("subject_type", sa.String(length=120), nullable=True),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("input_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_workflow_runs_tenant_id_tenants"),
    )

    op.create_table(
        "workflow_steps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workflow_run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("step_name", sa.String(length=160), nullable=False),
        sa.Column("step_status", sa.String(length=40), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_workflow_steps_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["workflow_run_id"], ["workflow_runs.id"], name="fk_workflow_steps_workflow_run_id_workflow_runs"),
    )

    op.create_index("ix_tenant_memberships_tenant_id", "tenant_memberships", ["tenant_id"])
    op.create_index("ix_workspaces_tenant_id", "workspaces", ["tenant_id"])
    op.create_index("ix_knowledge_bases_tenant_id", "knowledge_bases", ["tenant_id"])
    op.create_index("ix_documents_knowledge_base_id", "documents", ["knowledge_base_id"])
    op.create_index("ix_document_chunks_document_version_id", "document_chunks", ["document_version_id"])
    op.create_index("ix_conversations_workspace_id", "conversations", ["workspace_id"])
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])
    op.create_index("ix_workflow_runs_tenant_status", "workflow_runs", ["tenant_id", "workflow_status"])
    op.create_index("ix_workflow_steps_run_status", "workflow_steps", ["workflow_run_id", "step_status"])
    op.create_index(
        "ix_document_chunk_embeddings_embedding",
        "document_chunk_embeddings",
        ["embedding"],
        postgresql_using="ivfflat",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_document_chunk_embeddings_embedding", table_name="document_chunk_embeddings")
    op.drop_index("ix_workflow_steps_run_status", table_name="workflow_steps")
    op.drop_index("ix_workflow_runs_tenant_status", table_name="workflow_runs")
    op.drop_index("ix_messages_conversation_id", table_name="messages")
    op.drop_index("ix_conversations_workspace_id", table_name="conversations")
    op.drop_index("ix_document_chunks_document_version_id", table_name="document_chunks")
    op.drop_index("ix_documents_knowledge_base_id", table_name="documents")
    op.drop_index("ix_knowledge_bases_tenant_id", table_name="knowledge_bases")
    op.drop_index("ix_workspaces_tenant_id", table_name="workspaces")
    op.drop_index("ix_tenant_memberships_tenant_id", table_name="tenant_memberships")

    op.drop_table("workflow_steps")
    op.drop_table("workflow_runs")
    op.drop_table("message_citations")
    op.drop_table("messages")
    op.drop_table("conversations")
    op.drop_table("document_chunk_embeddings")
    op.drop_table("document_chunks")
    op.drop_table("document_assets")
    op.drop_table("document_versions")
    op.drop_table("documents")
    op.drop_table("knowledge_bases")
    op.drop_table("workspaces")
    op.drop_table("tenant_memberships")
    op.drop_table("users")
    op.drop_table("tenants")
