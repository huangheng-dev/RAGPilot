"""add retrieval evaluations

Revision ID: 202606220002
Revises: 202606220001
Create Date: 2026-06-22 22:35:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "202606220002"
down_revision = "202606220001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "retrieval_evaluations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("knowledge_base_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("evaluation_mode", sa.String(length=40), nullable=False),
        sa.Column("validation_status", sa.String(length=40), nullable=False),
        sa.Column("query_text", sa.Text(), nullable=False),
        sa.Column("baseline_engine_name", sa.String(length=80), nullable=False),
        sa.Column("candidate_engine_name", sa.String(length=80), nullable=True),
        sa.Column("retrieval_profile_name", sa.String(length=160), nullable=True),
        sa.Column("retrieval_profile_source", sa.String(length=80), nullable=True),
        sa.Column("result_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("shared_result_count", sa.Integer(), nullable=True),
        sa.Column("baseline_only_count", sa.Integer(), nullable=True),
        sa.Column("candidate_only_count", sa.Integer(), nullable=True),
        sa.Column("top_result_matches", sa.Boolean(), nullable=True),
        sa.Column("recommendation_reason", sa.Text(), nullable=True),
        sa.Column("evaluation_payload_json", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["knowledge_base_id"], ["knowledge_bases.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_retrieval_evaluations_scope_created_at",
        "retrieval_evaluations",
        ["tenant_id", "workspace_id", "knowledge_base_id", "created_at"],
    )
    op.create_index(
        "ix_retrieval_evaluations_status_created_at",
        "retrieval_evaluations",
        ["tenant_id", "validation_status", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_retrieval_evaluations_status_created_at", table_name="retrieval_evaluations")
    op.drop_index("ix_retrieval_evaluations_scope_created_at", table_name="retrieval_evaluations")
    op.drop_table("retrieval_evaluations")
