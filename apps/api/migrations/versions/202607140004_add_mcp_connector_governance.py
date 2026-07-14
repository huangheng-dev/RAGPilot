"""add MCP connector governance state

Revision ID: 202607140004
Revises: 202607140003
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "202607140004"
down_revision: Union[str, None] = "202607140003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("mcp_connectors", sa.Column("governance_status", sa.String(40), server_default="approved", nullable=False))
    op.add_column("mcp_connectors", sa.Column("approved_by_user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("mcp_connectors", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key("fk_mcp_connectors_approved_by_user", "mcp_connectors", "users", ["approved_by_user_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_mcp_connectors_approved_by_user", "mcp_connectors", type_="foreignkey")
    op.drop_column("mcp_connectors", "approved_at")
    op.drop_column("mcp_connectors", "approved_by_user_id")
    op.drop_column("mcp_connectors", "governance_status")
