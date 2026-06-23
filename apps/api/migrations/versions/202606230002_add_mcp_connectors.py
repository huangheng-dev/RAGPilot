"""add mcp connectors

Revision ID: 202606230002
Revises: 202606230001
Create Date: 2026-06-23 00:20:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "202606230002"
down_revision: str | None = "202606230001"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "mcp_connectors",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("connector_type", sa.String(length=40), nullable=False),
        sa.Column("base_url", sa.String(length=500), nullable=True),
        sa.Column("auth_mode", sa.String(length=40), nullable=False, server_default=sa.text("'none'")),
        sa.Column("credential_key_hint", sa.String(length=160), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_mcp_connectors_slug"),
    )


def downgrade() -> None:
    op.drop_table("mcp_connectors")
