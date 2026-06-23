"""add user login and invitation audit

Revision ID: 202606180005
Revises: 202606180004
Create Date: 2026-06-18 17:30:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "202606180005"
down_revision = "202606180004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_signed_in_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "tenant_memberships",
        sa.Column("invitation_issue_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "tenant_memberships",
        sa.Column("last_invitation_issued_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_tenant_memberships_last_invitation_issued_by_user",
        "tenant_memberships",
        "users",
        ["last_invitation_issued_by_user_id"],
        ["id"],
    )

    op.execute(
        """
        UPDATE tenant_memberships
        SET invitation_issue_count = CASE
            WHEN invitation_token IS NOT NULL OR invited_at IS NOT NULL THEN 1
            ELSE 0
        END
        """
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_tenant_memberships_last_invitation_issued_by_user",
        "tenant_memberships",
        type_="foreignkey",
    )
    op.drop_column("tenant_memberships", "last_invitation_issued_by_user_id")
    op.drop_column("tenant_memberships", "invitation_issue_count")
    op.drop_column("users", "last_signed_in_at")
