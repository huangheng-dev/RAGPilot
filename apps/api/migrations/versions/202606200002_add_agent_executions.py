"""add agent execution tasks

Revision ID: 202606200002
Revises: 202606200001
Create Date: 2026-06-20 22:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "202606200002"
down_revision: Union[str, None] = "202606200001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_executions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("agent_definition_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("knowledge_base_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("execution_mode", sa.String(length=40), nullable=False),
        sa.Column("execution_status", sa.String(length=40), server_default=sa.text("'queued'"), nullable=False),
        sa.Column("trigger_source", sa.String(length=80), server_default=sa.text("'agents_console'"), nullable=False),
        sa.Column("knowledge_base_scope", sa.String(length=160), nullable=True),
        sa.Column("model_endpoint_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "tool_registration_ids_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("execution_input", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column(
            "result_payload_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("launched_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["agent_definition_id"], ["agent_definitions.id"]),
        sa.ForeignKeyConstraint(["knowledge_base_id"], ["knowledge_bases.id"]),
        sa.ForeignKeyConstraint(["launched_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["model_endpoint_id"], ["model_endpoints.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_executions_tenant_id", "agent_executions", ["tenant_id"])
    op.create_index("ix_agent_executions_agent_definition_id", "agent_executions", ["agent_definition_id"])
    op.create_index("ix_agent_executions_created_at", "agent_executions", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_agent_executions_created_at", table_name="agent_executions")
    op.drop_index("ix_agent_executions_agent_definition_id", table_name="agent_executions")
    op.drop_index("ix_agent_executions_tenant_id", table_name="agent_executions")
    op.drop_table("agent_executions")
