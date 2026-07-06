"""add user session telemetry

Revision ID: 202606230005
Revises: 202606230004
Create Date: 2026-06-23 23:50:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202606230005"
down_revision: Union[str, None] = "202606230004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_sessions", sa.Column("user_agent", sa.String(length=512), nullable=True))
    op.add_column("user_sessions", sa.Column("ip_address", sa.String(length=128), nullable=True))
    op.add_column("user_sessions", sa.Column("device_label", sa.String(length=160), nullable=True))


def downgrade() -> None:
    op.drop_column("user_sessions", "device_label")
    op.drop_column("user_sessions", "ip_address")
    op.drop_column("user_sessions", "user_agent")
