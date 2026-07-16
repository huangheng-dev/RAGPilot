"""hash membership invitation tokens

Revision ID: 202607150001
Revises: 202607140004
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202607150001"
down_revision: Union[str, None] = "202607140004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tenant_memberships",
        sa.Column("invitation_token_hash", sa.String(length=64), nullable=True),
    )
    op.execute(
        """
        UPDATE tenant_memberships
        SET invitation_token_hash = encode(
            digest(upper(trim(invitation_token)), 'sha256'),
            'hex'
        )
        WHERE invitation_token IS NOT NULL
        """
    )
    op.execute("UPDATE tenant_memberships SET invitation_token = NULL WHERE invitation_token IS NOT NULL")


def downgrade() -> None:
    op.drop_column("tenant_memberships", "invitation_token_hash")
