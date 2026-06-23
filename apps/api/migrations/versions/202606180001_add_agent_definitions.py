"""add agent definitions

Revision ID: 202606180001
Revises: 202606120001
Create Date: 2026-06-18 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "202606180001"
down_revision: Union[str, None] = "202606120001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_definitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("agent_mode", sa.String(length=40), nullable=False),
        sa.Column("agent_status", sa.String(length=40), nullable=False, server_default=sa.text("'draft'")),
        sa.Column("model_strategy", sa.String(length=40), nullable=False),
        sa.Column("objective", sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.Column("instructions", sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.Column("knowledge_base_scope", sa.String(length=160), nullable=True),
        sa.Column("tool_bindings_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_agent_definitions_tenant_id_tenants"),
        sa.UniqueConstraint("tenant_id", "slug", name="uq_agent_definitions_tenant_slug"),
    )
    op.create_index("ix_agent_definitions_tenant_status", "agent_definitions", ["tenant_id", "agent_status"])


def downgrade() -> None:
    op.drop_index("ix_agent_definitions_tenant_status", table_name="agent_definitions")
    op.drop_table("agent_definitions")
