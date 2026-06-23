"""add message feedback entries

Revision ID: 202606220001
Revises: 202606210001
Create Date: 2026-06-22 00:00:01.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "202606220001"
down_revision: Union[str, None] = "202606210001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "message_feedback_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("submitted_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("answer_quality", sa.String(length=40), nullable=False),
        sa.Column("citation_quality", sa.String(length=40), nullable=False),
        sa.Column(
            "issue_labels_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("feedback_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_message_feedback_entries_tenant_id_tenants"),
        sa.ForeignKeyConstraint(["message_id"], ["messages.id"], name="fk_message_feedback_entries_message_id_messages"),
        sa.ForeignKeyConstraint(
            ["submitted_by_user_id"],
            ["users.id"],
            name="fk_message_feedback_entries_submitted_by_user_id_users",
        ),
        sa.UniqueConstraint("message_id", "submitted_by_user_id", name="uq_message_feedback_entries_message_user"),
    )
    op.create_index("ix_message_feedback_entries_message_id", "message_feedback_entries", ["message_id"])
    op.create_index(
        "ix_message_feedback_entries_tenant_quality",
        "message_feedback_entries",
        ["tenant_id", "answer_quality", "citation_quality"],
    )


def downgrade() -> None:
    op.drop_index("ix_message_feedback_entries_tenant_quality", table_name="message_feedback_entries")
    op.drop_index("ix_message_feedback_entries_message_id", table_name="message_feedback_entries")
    op.drop_table("message_feedback_entries")
