"""add data sources and sync state

Revision ID: 202607150004
Revises: 202607150003
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "202607150004"
down_revision: Union[str, None] = "202607150003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "data_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("knowledge_base_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("knowledge_bases.id"), nullable=False),
        sa.Column("name", sa.String(240), nullable=False),
        sa.Column("source_type", sa.String(40), nullable=False),
        sa.Column("source_uri", sa.Text(), nullable=True),
        sa.Column("identity_key", sa.String(128), nullable=False),
        sa.Column("connection_status", sa.String(40), server_default="connected", nullable=False),
        sa.Column("sync_status", sa.String(40), server_default="never_synced", nullable=False),
        sa.Column("sync_cursor", sa.String(512), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_error", sa.Text(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("knowledge_base_id", "identity_key", name="uq_data_sources_kb_identity"),
    )
    op.create_index("ix_data_sources_tenant_id", "data_sources", ["tenant_id"])
    op.create_index("ix_data_sources_kb_status", "data_sources", ["knowledge_base_id", "sync_status"])
    op.create_table(
        "data_source_sync_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("data_source_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("data_sources.id"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("run_status", sa.String(40), server_default="running", nullable=False),
        sa.Column("cursor_before", sa.String(512), nullable=True),
        sa.Column("cursor_after", sa.String(512), nullable=True),
        sa.Column("documents_discovered", sa.Integer(), server_default="0", nullable=False),
        sa.Column("documents_changed", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_data_source_sync_runs_source_started", "data_source_sync_runs", ["data_source_id", "started_at"])
    op.add_column("documents", sa.Column("data_source_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_documents_data_source", "documents", "data_sources", ["data_source_id"], ["id"])
    op.create_index("ix_documents_data_source_id", "documents", ["data_source_id"])

    op.execute(sa.text("""
        INSERT INTO data_sources (
            id, tenant_id, knowledge_base_id, name, source_type, source_uri, identity_key,
            connection_status, sync_status, last_synced_at, metadata_json, created_at, updated_at
        )
        SELECT
            documents.id, documents.tenant_id, documents.knowledge_base_id, documents.title,
            CASE
                WHEN lower(coalesce(documents.source_uri, '')) LIKE 'http://%' OR lower(coalesce(documents.source_uri, '')) LIKE 'https://%' THEN 'web'
                WHEN coalesce(documents.source_uri, '') <> '' THEN 'file'
                ELSE 'manual'
            END,
            documents.source_uri, 'legacy:' || documents.id::text,
            'connected', 'completed', documents.updated_at,
            jsonb_build_object('backfilled_from_document_id', documents.id::text),
            documents.created_at, documents.updated_at
        FROM documents
    """))
    op.execute(sa.text("UPDATE documents SET data_source_id = id WHERE data_source_id IS NULL"))


def downgrade() -> None:
    op.drop_index("ix_documents_data_source_id", table_name="documents")
    op.drop_constraint("fk_documents_data_source", "documents", type_="foreignkey")
    op.drop_column("documents", "data_source_id")
    op.drop_index("ix_data_source_sync_runs_source_started", table_name="data_source_sync_runs")
    op.drop_table("data_source_sync_runs")
    op.drop_index("ix_data_sources_kb_status", table_name="data_sources")
    op.drop_index("ix_data_sources_tenant_id", table_name="data_sources")
    op.drop_table("data_sources")
