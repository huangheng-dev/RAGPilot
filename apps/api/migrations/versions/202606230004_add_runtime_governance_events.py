"""add runtime governance events

Revision ID: 202606230004
Revises: 202606230003
Create Date: 2026-06-23 23:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "202606230004"
down_revision: str | None = "202606230003"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "runtime_governance_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("actor_role", sa.String(length=40), nullable=True),
        sa.Column("resource_type", sa.String(length=80), nullable=False),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resource_name", sa.String(length=160), nullable=True),
        sa.Column("resource_slug", sa.String(length=120), nullable=True),
        sa.Column("action_type", sa.String(length=80), nullable=False),
        sa.Column(
            "detail_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_runtime_governance_events_created_at",
        "runtime_governance_events",
        ["created_at"],
    )
    op.create_index(
        "ix_runtime_governance_events_resource_type",
        "runtime_governance_events",
        ["resource_type"],
    )


def downgrade() -> None:
    op.drop_index("ix_runtime_governance_events_resource_type", table_name="runtime_governance_events")
    op.drop_index("ix_runtime_governance_events_created_at", table_name="runtime_governance_events")
    op.drop_table("runtime_governance_events")
