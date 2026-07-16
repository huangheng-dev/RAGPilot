"""add agent execution policy and replay

Revision ID: 202607150007
Revises: 202607150006
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "202607150007"
down_revision: Union[str, None] = "202607150006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("agent_executions", sa.Column("execution_policy_json", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False))
    op.add_column("agent_executions", sa.Column("output_schema_json", postgresql.JSONB(), nullable=True))
    op.add_column("agent_executions", sa.Column("replay_fingerprint", sa.String(64), nullable=True))
    op.add_column("agent_executions", sa.Column("replay_of_execution_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_agent_executions_replay_of", "agent_executions", "agent_executions", ["replay_of_execution_id"], ["id"])
    op.create_index("ix_agent_executions_replay_fingerprint", "agent_executions", ["tenant_id", "replay_fingerprint"])


def downgrade() -> None:
    op.drop_index("ix_agent_executions_replay_fingerprint", table_name="agent_executions")
    op.drop_constraint("fk_agent_executions_replay_of", "agent_executions", type_="foreignkey")
    op.drop_column("agent_executions", "replay_of_execution_id")
    op.drop_column("agent_executions", "replay_fingerprint")
    op.drop_column("agent_executions", "output_schema_json")
    op.drop_column("agent_executions", "execution_policy_json")
