"""add tool connector reference

Revision ID: 202606230001
Revises: 202606220003
Create Date: 2026-06-23 00:01:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202606230001"
down_revision: Union[str, None] = "202606220003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tool_registrations",
        sa.Column("connector_reference", sa.String(length=240), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tool_registrations", "connector_reference")
