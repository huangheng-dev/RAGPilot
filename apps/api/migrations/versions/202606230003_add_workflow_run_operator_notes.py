"""add workflow run operator notes

Revision ID: 202606230003
Revises: 202606230002
Create Date: 2026-06-23 01:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "202606230003"
down_revision: str | None = "202606230002"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("workflow_runs", sa.Column("operator_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("workflow_runs", "operator_notes")
