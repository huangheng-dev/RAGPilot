"""add retrieval profiles

Revision ID: 202606200003
Revises: 202606200002
Create Date: 2026-06-20 00:00:03.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "202606200003"
down_revision: Union[str, None] = "202606200002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "retrieval_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("retrieval_mode", sa.String(length=40), nullable=False, server_default=sa.text("'hybrid'")),
        sa.Column("top_k", sa.Integer(), nullable=False, server_default=sa.text("5")),
        sa.Column("vector_weight", sa.Numeric(4, 3), nullable=False, server_default=sa.text("0.650")),
        sa.Column("lexical_weight", sa.Numeric(4, 3), nullable=False, server_default=sa.text("0.350")),
        sa.Column("hybrid_overlap_bonus", sa.Numeric(4, 3), nullable=False, server_default=sa.text("0.050")),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("slug", name="uq_retrieval_profiles_slug"),
    )
    op.create_index(
        "ix_retrieval_profiles_mode_enabled",
        "retrieval_profiles",
        ["retrieval_mode", "is_enabled"],
    )

    op.add_column(
        "knowledge_bases",
        sa.Column("retrieval_profile_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_knowledge_bases_retrieval_profile_id",
        "knowledge_bases",
        "retrieval_profiles",
        ["retrieval_profile_id"],
        ["id"],
    )

    op.execute(
        """
        INSERT INTO retrieval_profiles (
            name,
            slug,
            retrieval_mode,
            top_k,
            vector_weight,
            lexical_weight,
            hybrid_overlap_bonus,
            is_enabled,
            is_default,
            notes
        )
        VALUES (
            'Standard Hybrid Retrieval',
            'standard-hybrid-retrieval',
            'hybrid',
            5,
            0.650,
            0.350,
            0.050,
            true,
            true,
            'Default hybrid retrieval profile for grounded chat, agent execution, and diagnostics.'
        )
        """
    )
    op.execute(
        """
        UPDATE knowledge_bases
        SET retrieval_profile_id = (
            SELECT id
            FROM retrieval_profiles
            WHERE slug = 'standard-hybrid-retrieval'
              AND deleted_at IS NULL
            LIMIT 1
        )
        WHERE retrieval_profile_id IS NULL
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_knowledge_bases_retrieval_profile_id", "knowledge_bases", type_="foreignkey")
    op.drop_column("knowledge_bases", "retrieval_profile_id")
    op.drop_index("ix_retrieval_profiles_mode_enabled", table_name="retrieval_profiles")
    op.drop_table("retrieval_profiles")
