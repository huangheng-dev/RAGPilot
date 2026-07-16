"""add persisted framework runtime policies

Revision ID: 202607160001
Revises: 202607150007
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "202607160001"
down_revision: Union[str, None] = "202607150007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agent_definitions",
        sa.Column("runtime_engine", sa.String(40), server_default=sa.text("'native'"), nullable=False),
    )
    op.add_column(
        "agent_definitions",
        sa.Column("runtime_version", sa.String(80), server_default=sa.text("'native_v1'"), nullable=False),
    )
    op.add_column(
        "retrieval_profiles",
        sa.Column("engine_name", sa.String(40), server_default=sa.text("'native'"), nullable=False),
    )
    op.add_column(
        "retrieval_profiles",
        sa.Column("engine_version", sa.String(80), server_default=sa.text("'native_v1'"), nullable=False),
    )
    op.add_column(
        "retrieval_profiles",
        sa.Column(
            "llamaindex_similarity_cutoff",
            sa.Numeric(6, 5),
            server_default=sa.text("0.00000"),
            nullable=False,
        ),
    )
    op.add_column(
        "retrieval_profiles",
        sa.Column(
            "llamaindex_long_context_reorder_enabled",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("retrieval_profiles", "llamaindex_long_context_reorder_enabled")
    op.drop_column("retrieval_profiles", "llamaindex_similarity_cutoff")
    op.drop_column("retrieval_profiles", "engine_version")
    op.drop_column("retrieval_profiles", "engine_name")
    op.drop_column("agent_definitions", "runtime_version")
    op.drop_column("agent_definitions", "runtime_engine")
