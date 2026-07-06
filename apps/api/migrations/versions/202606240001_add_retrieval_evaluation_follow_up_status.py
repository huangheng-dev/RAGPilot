"""add retrieval evaluation follow up status

Revision ID: 202606240001
Revises: 202606230005
Create Date: 2026-06-24 16:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202606240001"
down_revision: Union[str, None] = "202606230005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "retrieval_evaluations",
        sa.Column("follow_up_status", sa.String(length=40), nullable=False, server_default="pending"),
    )
    op.add_column("retrieval_evaluations", sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "retrieval_evaluations",
        sa.Column("resolved_by_user_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_retrieval_evaluations_resolved_by_user_id_users",
        "retrieval_evaluations",
        "users",
        ["resolved_by_user_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_retrieval_evaluations_resolved_by_user_id_users", "retrieval_evaluations", type_="foreignkey")
    op.drop_column("retrieval_evaluations", "resolved_by_user_id")
    op.drop_column("retrieval_evaluations", "resolved_at")
    op.drop_column("retrieval_evaluations", "follow_up_status")
