"""add incremental connector state

Revision ID: 202607150006
Revises: 202607150005
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "202607150006"
down_revision: Union[str, None] = "202607150005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("data_sources", sa.Column("sync_lease_token", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("data_sources", sa.Column("sync_lease_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("data_source_sync_runs", sa.Column("documents_unchanged", sa.Integer(), server_default="0", nullable=False))
    op.add_column("data_source_sync_runs", sa.Column("documents_deleted", sa.Integer(), server_default="0", nullable=False))
    op.add_column("data_source_sync_runs", sa.Column("temporal_workflow_id", sa.String(240), nullable=True))
    op.add_column("data_source_sync_runs", sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "data_source_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("data_source_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("external_id", sa.String(512), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version_token", sa.String(512), nullable=False),
        sa.Column("content_hash", sa.String(128), nullable=True),
        sa.Column("source_uri", sa.Text(), nullable=True),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("item_status", sa.String(40), server_default="active", nullable=False),
        sa.Column("last_seen_sync_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("data_source_sync_runs.id"), nullable=True),
        sa.Column("last_changed_sync_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("data_source_sync_runs.id"), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("data_source_id", "external_id", name="uq_data_source_items_source_external"),
        sa.CheckConstraint("item_status IN ('active', 'deleted', 'error')", name="ck_data_source_items_status"),
    )
    op.create_foreign_key("fk_data_source_items_document", "data_source_items", "documents", ["document_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_data_source_items_source_status", "data_source_items", ["data_source_id", "item_status"])
    op.create_index("ix_data_source_items_document", "data_source_items", ["document_id"])


def downgrade() -> None:
    op.drop_table("data_source_items")
    op.drop_column("data_source_sync_runs", "heartbeat_at")
    op.drop_column("data_source_sync_runs", "temporal_workflow_id")
    op.drop_column("data_source_sync_runs", "documents_deleted")
    op.drop_column("data_source_sync_runs", "documents_unchanged")
    op.drop_column("data_sources", "sync_lease_expires_at")
    op.drop_column("data_sources", "sync_lease_token")
