"""add user access events

Revision ID: 202606180006
Revises: 202606180005
Create Date: 2026-06-18 18:15:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "202606180006"
down_revision = "202606180005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_access_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("membership_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenant_memberships.id"), nullable=True),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("detail_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_user_access_events_created_at", "user_access_events", ["created_at"])
    op.create_index("ix_user_access_events_tenant_id", "user_access_events", ["tenant_id"])
    op.create_index("ix_user_access_events_user_id", "user_access_events", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_access_events_user_id", table_name="user_access_events")
    op.drop_index("ix_user_access_events_tenant_id", table_name="user_access_events")
    op.drop_index("ix_user_access_events_created_at", table_name="user_access_events")
    op.drop_table("user_access_events")
