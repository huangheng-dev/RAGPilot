"""add prompt versions and run bindings

Revision ID: 202607150002
Revises: 202607150001
"""
from __future__ import annotations

import hashlib
from typing import Sequence, Union
from uuid import UUID

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "202607150002"
down_revision: Union[str, None] = "202607150001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CHAT_TEMPLATE_ID = UUID("00000000-0000-0000-0000-000000000001")
CHAT_VERSION_ID = UUID("10000000-0000-0000-0000-000000000001")
AGENT_TEMPLATE_ID = UUID("00000000-0000-0000-0000-000000000002")
AGENT_VERSION_ID = UUID("10000000-0000-0000-0000-000000000002")
CHAT_TEMPLATE = (
    "You are RAGPilot. Answer only from the provided knowledge base context. "
    "First decide whether the retrieved context is directly relevant to the user's question. "
    "Never summarize or reuse context that does not answer the question. "
    "If the context is irrelevant or insufficient, say that the current knowledge base does not contain enough relevant information. "
    "When agent context is provided, follow its objective and instructions without inventing facts beyond the retrieved evidence."
)
AGENT_TEMPLATE = (
    "Execute the governed agent definition using its objective, instructions, approved tools, "
    "scoped knowledge, and the supplied launch input."
)


def upgrade() -> None:
    op.create_table(
        "prompt_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("prompt_key", sa.String(160), nullable=False, unique=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("active_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "prompt_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("prompt_template_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("prompt_templates.id"), nullable=False),
        sa.Column("version", sa.String(80), nullable=False),
        sa.Column("template_text", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(40), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("prompt_template_id", "version", name="uq_prompt_versions_template_version"),
    )
    op.create_foreign_key(
        "fk_prompt_templates_active_version", "prompt_templates", "prompt_versions", ["active_version_id"], ["id"]
    )

    templates = sa.table(
        "prompt_templates",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("prompt_key", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
        sa.column("active_version_id", postgresql.UUID(as_uuid=True)),
    )
    versions = sa.table(
        "prompt_versions",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("prompt_template_id", postgresql.UUID(as_uuid=True)),
        sa.column("version", sa.String),
        sa.column("template_text", sa.Text),
        sa.column("content_hash", sa.String),
        sa.column("status", sa.String),
    )
    op.bulk_insert(templates, [
        {"id": CHAT_TEMPLATE_ID, "prompt_key": "grounded-chat", "name": "Grounded chat", "description": "System contract for grounded knowledge-base answers.", "active_version_id": None},
        {"id": AGENT_TEMPLATE_ID, "prompt_key": "governed-agent-execution", "name": "Governed agent execution", "description": "Execution contract for governed agent runs.", "active_version_id": None},
    ])
    op.bulk_insert(versions, [
        {"id": CHAT_VERSION_ID, "prompt_template_id": CHAT_TEMPLATE_ID, "version": "1.0.0", "template_text": CHAT_TEMPLATE, "content_hash": hashlib.sha256(CHAT_TEMPLATE.encode("utf-8")).hexdigest(), "status": "active"},
        {"id": AGENT_VERSION_ID, "prompt_template_id": AGENT_TEMPLATE_ID, "version": "1.0.0", "template_text": AGENT_TEMPLATE, "content_hash": hashlib.sha256(AGENT_TEMPLATE.encode("utf-8")).hexdigest(), "status": "active"},
    ])
    op.execute(sa.text("UPDATE prompt_templates SET active_version_id = :version_id WHERE id = :template_id").bindparams(version_id=CHAT_VERSION_ID, template_id=CHAT_TEMPLATE_ID))
    op.execute(sa.text("UPDATE prompt_templates SET active_version_id = :version_id WHERE id = :template_id").bindparams(version_id=AGENT_VERSION_ID, template_id=AGENT_TEMPLATE_ID))

    for table_name in ("messages", "agent_runs", "agent_executions"):
        op.add_column(table_name, sa.Column("prompt_version_id", postgresql.UUID(as_uuid=True), nullable=True))
        op.add_column(table_name, sa.Column("prompt_snapshot_hash", sa.String(64), nullable=True))
        op.create_foreign_key(f"fk_{table_name}_prompt_version", table_name, "prompt_versions", ["prompt_version_id"], ["id"])
        op.create_index(f"ix_{table_name}_prompt_version_id", table_name, ["prompt_version_id"])


def downgrade() -> None:
    for table_name in ("agent_executions", "agent_runs", "messages"):
        op.drop_index(f"ix_{table_name}_prompt_version_id", table_name=table_name)
        op.drop_constraint(f"fk_{table_name}_prompt_version", table_name, type_="foreignkey")
        op.drop_column(table_name, "prompt_snapshot_hash")
        op.drop_column(table_name, "prompt_version_id")
    op.drop_constraint("fk_prompt_templates_active_version", "prompt_templates", type_="foreignkey")
    op.drop_table("prompt_versions")
    op.drop_table("prompt_templates")
