"""add membership invitation expiration

Revision ID: 202606180004
Revises: 202606180003
Create Date: 2026-06-18 16:40:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "202606180004"
down_revision = "202606180003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenant_memberships",
        sa.Column("invitation_expires_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.execute(
        """
        UPDATE tenant_memberships
        SET invitation_expires_at = COALESCE(invited_at, now()) + interval '7 days'
        WHERE membership_status = 'invited'
        """
    )


def downgrade() -> None:
    op.drop_column("tenant_memberships", "invitation_expires_at")
