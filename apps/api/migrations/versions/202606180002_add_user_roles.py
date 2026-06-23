"""add user roles

Revision ID: 202606180002
Revises: 202606180001
Create Date: 2026-06-18 00:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202606180002"
down_revision: Union[str, None] = "202606180001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(length=40), nullable=False, server_default=sa.text("'operator'")),
    )
    op.execute(
        """
        WITH first_user AS (
            SELECT id
            FROM users
            WHERE deleted_at IS NULL
            ORDER BY created_at ASC, id ASC
            LIMIT 1
        )
        UPDATE users
        SET role = CASE
            WHEN id = (SELECT id FROM first_user) THEN 'super_admin'
            ELSE 'operator'
        END
        WHERE deleted_at IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("users", "role")
