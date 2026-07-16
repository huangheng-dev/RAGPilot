"""add retrieval access control

Revision ID: 202607150005
Revises: 202607150004
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "202607150005"
down_revision: Union[str, None] = "202607150004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "access_groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_id", "slug", name="uq_access_groups_tenant_slug"),
    )
    op.create_index("ix_access_groups_tenant", "access_groups", ["tenant_id"])
    op.create_table(
        "access_group_memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("access_groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("group_id", "user_id", name="uq_access_group_memberships_group_user"),
    )
    op.create_index("ix_access_group_memberships_user_tenant", "access_group_memberships", ["user_id", "tenant_id"])
    op.add_column("documents", sa.Column("access_scope", sa.String(40), server_default="tenant", nullable=False))
    op.create_check_constraint("ck_documents_access_scope", "documents", "access_scope IN ('tenant', 'restricted')")
    op.add_column("document_chunks", sa.Column("access_scope", sa.String(40), server_default="inherit", nullable=False))
    op.create_check_constraint("ck_document_chunks_access_scope", "document_chunks", "access_scope IN ('inherit', 'restricted')")
    _create_grants_table("document_access_grants", "document_id", "documents")
    _create_grants_table("document_chunk_access_grants", "document_chunk_id", "document_chunks")


def _create_grants_table(table_name: str, resource_column: str, resource_table: str) -> None:
    op.create_table(
        table_name,
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column(resource_column, postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{resource_table}.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("access_groups.id", ondelete="CASCADE"), nullable=True),
        sa.Column("permission", sa.String(40), server_default="read", nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("num_nonnulls(user_id, group_id) = 1", name=f"ck_{table_name}_one_subject"),
        sa.CheckConstraint("permission = 'read'", name=f"ck_{table_name}_permission"),
    )
    op.create_index(f"ix_{table_name}_resource", table_name, [resource_column])
    op.create_index(f"uq_{table_name}_user", table_name, [resource_column, "user_id"], unique=True, postgresql_where=sa.text("user_id IS NOT NULL"))
    op.create_index(f"uq_{table_name}_group", table_name, [resource_column, "group_id"], unique=True, postgresql_where=sa.text("group_id IS NOT NULL"))


def downgrade() -> None:
    op.drop_table("document_chunk_access_grants")
    op.drop_table("document_access_grants")
    op.drop_constraint("ck_document_chunks_access_scope", "document_chunks", type_="check")
    op.drop_column("document_chunks", "access_scope")
    op.drop_constraint("ck_documents_access_scope", "documents", type_="check")
    op.drop_column("documents", "access_scope")
    op.drop_table("access_group_memberships")
    op.drop_table("access_groups")
