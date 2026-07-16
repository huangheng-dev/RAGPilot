"""add search projection outbox

Revision ID: 202607140001
Revises: 202607110001
Create Date: 2026-07-14 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "202607140001"
down_revision: str | None = "202607110001"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "search_projection_outbox_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("aggregate_type", sa.String(length=80), nullable=False),
        sa.Column("aggregate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("event_key", sa.String(length=320), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("event_status", sa.String(length=40), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_search_projection_outbox_tenant"),
        sa.UniqueConstraint("event_key", name="uq_search_projection_outbox_event_key"),
    )
    op.create_index(
        "ix_search_projection_outbox_status_available",
        "search_projection_outbox_events",
        ["event_status", "available_at"],
    )
    op.create_index(
        "ix_search_projection_outbox_tenant_document",
        "search_projection_outbox_events",
        ["tenant_id", "document_id", "created_at"],
    )
    op.create_index(
        "ix_search_projection_outbox_document_version",
        "search_projection_outbox_events",
        ["document_version_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_search_projection_outbox_document_version", table_name="search_projection_outbox_events")
    op.drop_index("ix_search_projection_outbox_tenant_document", table_name="search_projection_outbox_events")
    op.drop_index("ix_search_projection_outbox_status_available", table_name="search_projection_outbox_events")
    op.drop_table("search_projection_outbox_events")
