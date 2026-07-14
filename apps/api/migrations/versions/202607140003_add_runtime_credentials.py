"""add encrypted runtime credentials

Revision ID: 202607140003
Revises: 202607140002
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "202607140003"
down_revision: Union[str, None] = "202607140002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "runtime_credentials",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("resource_type", sa.String(length=80), nullable=False),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ciphertext", sa.Text(), nullable=False),
        sa.Column("nonce", sa.String(length=80), nullable=False),
        sa.Column("key_version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("secret_hint", sa.String(length=40), nullable=False),
        sa.Column("rotated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("rotated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["rotated_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("resource_type", "resource_id", name="uq_runtime_credentials_resource"),
    )
    op.create_index("ix_runtime_credentials_resource", "runtime_credentials", ["resource_type", "resource_id"])


def downgrade() -> None:
    op.drop_index("ix_runtime_credentials_resource", table_name="runtime_credentials")
    op.drop_table("runtime_credentials")
