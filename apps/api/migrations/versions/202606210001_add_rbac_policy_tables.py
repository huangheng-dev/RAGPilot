"""add rbac policy tables

Revision ID: 202606210001
Revises: 202606200003
Create Date: 2026-06-21 00:00:01.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "202606210001"
down_revision: Union[str, None] = "202606200003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ROLE_GRANTS = {
    "super_admin": [
        "access_home",
        "access_chat",
        "access_documents",
        "access_agents",
        "access_operations",
        "access_settings",
        "access_admin_console",
        "manage_admin_resources",
        "manage_members",
        "manage_runtime_governance",
        "review_runtime_governance",
        "manage_agent_definitions",
        "execute_agents",
        "manage_documents",
        "send_chat_messages",
        "retry_workflow_runs",
        "view_audit_events",
        "manage_local_session_role",
    ],
    "operator": [
        "access_home",
        "access_chat",
        "access_documents",
        "access_agents",
        "access_operations",
        "access_settings",
        "execute_agents",
        "manage_agent_definitions",
        "manage_documents",
        "review_runtime_governance",
        "retry_workflow_runs",
        "send_chat_messages",
    ],
    "reviewer": [
        "access_home",
        "access_chat",
        "access_documents",
        "access_agents",
        "access_operations",
        "access_settings",
        "access_admin_console",
        "review_runtime_governance",
    ],
}


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("slug", name="uq_roles_slug"),
    )
    op.create_index("ix_roles_deleted_at", "roles", ["deleted_at"])

    op.create_table(
        "permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("slug", name="uq_permissions_slug"),
    )
    op.create_index("ix_permissions_category", "permissions", ["category"])
    op.create_index("ix_permissions_deleted_at", "permissions", ["deleted_at"])

    op.create_table(
        "role_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("permission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], name="fk_role_permissions_role_id_roles"),
        sa.ForeignKeyConstraint(["permission_id"], ["permissions.id"], name="fk_role_permissions_permission_id_permissions"),
        sa.UniqueConstraint("role_id", "permission_id", name="uq_role_permissions_role_permission"),
    )
    op.create_index("ix_role_permissions_role_id", "role_permissions", ["role_id"])
    op.create_index("ix_role_permissions_permission_id", "role_permissions", ["permission_id"])

    _seed_default_rbac_policy()


def downgrade() -> None:
    op.drop_index("ix_role_permissions_permission_id", table_name="role_permissions")
    op.drop_index("ix_role_permissions_role_id", table_name="role_permissions")
    op.drop_table("role_permissions")
    op.drop_index("ix_permissions_deleted_at", table_name="permissions")
    op.drop_index("ix_permissions_category", table_name="permissions")
    op.drop_table("permissions")
    op.drop_index("ix_roles_deleted_at", table_name="roles")
    op.drop_table("roles")


def _seed_default_rbac_policy() -> None:
    role_rows = [
        {
            "slug": "super_admin",
            "name": "Super Admin",
            "description": "Full platform administration role.",
        },
        {
            "slug": "operator",
            "name": "Operator",
            "description": "Knowledge operations role for documents, chat, workflows, and agents.",
        },
        {
            "slug": "reviewer",
            "name": "Reviewer",
            "description": "Read-focused governance role with admin console visibility.",
        },
    ]

    permission_slugs = sorted({permission_slug for grants in ROLE_GRANTS.values() for permission_slug in grants})
    permission_rows = [
        {
            "slug": permission_slug,
            "name": permission_slug.replace("_", " ").title(),
            "category": permission_slug.split("_", 1)[0],
            "description": f"Allows {permission_slug.replace('_', ' ')}.",
        }
        for permission_slug in permission_slugs
    ]

    op.bulk_insert(sa.table("roles", sa.column("slug"), sa.column("name"), sa.column("description")), role_rows)
    op.bulk_insert(
        sa.table("permissions", sa.column("slug"), sa.column("name"), sa.column("category"), sa.column("description")),
        permission_rows,
    )

    for role_slug, permission_grants in ROLE_GRANTS.items():
        for permission_slug in permission_grants:
            op.execute(
                sa.text(
                    """
                    INSERT INTO role_permissions (role_id, permission_id)
                    SELECT roles.id, permissions.id
                    FROM roles
                    CROSS JOIN permissions
                    WHERE roles.slug = :role_slug
                      AND permissions.slug = :permission_slug
                    """
                ).bindparams(role_slug=role_slug, permission_slug=permission_slug)
            )
