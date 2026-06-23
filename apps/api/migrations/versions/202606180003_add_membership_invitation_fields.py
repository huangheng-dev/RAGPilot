"""add membership invitation fields

Revision ID: 202606180003
Revises: 202606180002
Create Date: 2026-06-18 01:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202606180003"
down_revision: Union[str, None] = "202606180002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenant_memberships", sa.Column("invitation_token", sa.String(length=80), nullable=True))
    op.add_column("tenant_memberships", sa.Column("invited_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tenant_memberships", sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True))

    op.execute(
        """
        UPDATE tenant_memberships
        SET activated_at = COALESCE(updated_at, created_at, now())
        WHERE membership_status = 'active' AND activated_at IS NULL
        """
    )
    op.execute(
        """
        UPDATE tenant_memberships
        SET invited_at = COALESCE(updated_at, created_at, now()),
            invitation_token = CONCAT('RP-', UPPER(SUBSTRING(MD5(id::text || clock_timestamp()::text) FROM 1 FOR 8)))
        WHERE membership_status = 'invited' AND invitation_token IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("tenant_memberships", "activated_at")
    op.drop_column("tenant_memberships", "invited_at")
    op.drop_column("tenant_memberships", "invitation_token")
