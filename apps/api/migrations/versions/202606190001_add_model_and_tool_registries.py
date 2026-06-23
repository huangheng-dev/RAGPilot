"""add model and tool registries

Revision ID: 202606190001
Revises: 202606180006
Create Date: 2026-06-19 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "202606190001"
down_revision: Union[str, None] = "202606180006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "model_endpoints",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("provider_type", sa.String(length=40), nullable=False),
        sa.Column("model_name", sa.String(length=160), nullable=False),
        sa.Column("base_url", sa.String(length=500), nullable=True),
        sa.Column("credential_mode", sa.String(length=40), nullable=False, server_default=sa.text("'none'")),
        sa.Column("credential_key_hint", sa.String(length=160), nullable=True),
        sa.Column("capabilities_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("slug", name="uq_model_endpoints_slug"),
    )
    op.create_index("ix_model_endpoints_provider_enabled", "model_endpoints", ["provider_type", "is_enabled"])

    op.create_table(
        "tool_registrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("transport_type", sa.String(length=40), nullable=False),
        sa.Column("surface_area", sa.String(length=40), nullable=False),
        sa.Column("endpoint_url", sa.String(length=500), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("capabilities_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("requires_admin_approval", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("slug", name="uq_tool_registrations_slug"),
    )
    op.create_index(
        "ix_tool_registrations_transport_surface_enabled",
        "tool_registrations",
        ["transport_type", "surface_area", "is_enabled"],
    )


def downgrade() -> None:
    op.drop_index("ix_tool_registrations_transport_surface_enabled", table_name="tool_registrations")
    op.drop_table("tool_registrations")
    op.drop_index("ix_model_endpoints_provider_enabled", table_name="model_endpoints")
    op.drop_table("model_endpoints")
