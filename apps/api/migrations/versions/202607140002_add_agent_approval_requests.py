"""add durable agent approval requests

Revision ID: 202607140002
Revises: 202607140001
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "202607140002"
down_revision: Union[str, None] = "202607140001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_approval_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("agent_execution_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tool_registration_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("approval_status", sa.String(length=40), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("requested_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decided_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decision_reason", sa.Text(), nullable=True),
        sa.Column("resume_token", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["agent_execution_id"], ["agent_executions.id"]),
        sa.ForeignKeyConstraint(["tool_registration_id"], ["tool_registrations.id"]),
        sa.ForeignKeyConstraint(["requested_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["decided_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("resume_token", name="uq_agent_approval_requests_resume_token"),
    )
    op.create_index("ix_agent_approval_requests_execution", "agent_approval_requests", ["agent_execution_id"])
    op.create_index("ix_agent_approval_requests_tenant_status", "agent_approval_requests", ["tenant_id", "approval_status"])


def downgrade() -> None:
    op.drop_index("ix_agent_approval_requests_tenant_status", table_name="agent_approval_requests")
    op.drop_index("ix_agent_approval_requests_execution", table_name="agent_approval_requests")
    op.drop_table("agent_approval_requests")
