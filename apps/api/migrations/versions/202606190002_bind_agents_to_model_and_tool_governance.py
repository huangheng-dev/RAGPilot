"""bind agents to model and tool governance

Revision ID: 202606190002
Revises: 202606190001
Create Date: 2026-06-19 00:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "202606190002"
down_revision: Union[str, None] = "202606190001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("agent_definitions", sa.Column("model_endpoint_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column(
        "agent_definitions",
        sa.Column(
            "tool_registration_ids_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.create_foreign_key(
        "fk_agent_definitions_model_endpoint_id_model_endpoints",
        "agent_definitions",
        "model_endpoints",
        ["model_endpoint_id"],
        ["id"],
    )
    op.create_index("ix_agent_definitions_model_endpoint_id", "agent_definitions", ["model_endpoint_id"])


def downgrade() -> None:
    op.drop_index("ix_agent_definitions_model_endpoint_id", table_name="agent_definitions")
    op.drop_constraint("fk_agent_definitions_model_endpoint_id_model_endpoints", "agent_definitions", type_="foreignkey")
    op.drop_column("agent_definitions", "tool_registration_ids_json")
    op.drop_column("agent_definitions", "model_endpoint_id")
