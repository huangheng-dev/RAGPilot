"""add grounded chat prompt v1.1

Revision ID: 202607170001
Revises: 202607160001
"""
from __future__ import annotations

import hashlib
from typing import Sequence, Union
from uuid import UUID

import sqlalchemy as sa
from alembic import op


revision: str = "202607170001"
down_revision: Union[str, None] = "202607160001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CHAT_TEMPLATE_ID = UUID("00000000-0000-0000-0000-000000000001")
CHAT_VERSION_ID = UUID("10000000-0000-0000-0000-000000000003")
CHAT_TEMPLATE = (
    "You are RAGPilot. Answer only from the provided knowledge base context. "
    "Always answer in the same language as the user's question unless the user explicitly requests another language. "
    "First decide whether the retrieved context is directly relevant to the user's question. "
    "Never summarize or reuse context that does not answer the question. "
    "If the context is irrelevant or insufficient, say that the current knowledge base does not contain enough relevant information. "
    "When agent context is provided, follow its objective and instructions without inventing facts beyond the retrieved evidence."
)


def upgrade() -> None:
    prompt_versions = sa.table(
        "prompt_versions",
        sa.column("id", sa.Uuid),
        sa.column("prompt_template_id", sa.Uuid),
        sa.column("version", sa.String),
        sa.column("template_text", sa.Text),
        sa.column("content_hash", sa.String),
        sa.column("status", sa.String),
    )
    op.bulk_insert(
        prompt_versions,
        [
            {
                "id": CHAT_VERSION_ID,
                "prompt_template_id": CHAT_TEMPLATE_ID,
                "version": "1.1.0",
                "template_text": CHAT_TEMPLATE,
                "content_hash": hashlib.sha256(CHAT_TEMPLATE.encode("utf-8")).hexdigest(),
                "status": "active",
            }
        ],
    )
    op.execute(
        sa.text(
            "UPDATE prompt_versions SET status = 'superseded' "
            "WHERE prompt_template_id = :template_id AND id <> :version_id"
        ).bindparams(template_id=CHAT_TEMPLATE_ID, version_id=CHAT_VERSION_ID)
    )
    op.execute(
        sa.text("UPDATE prompt_templates SET active_version_id = :version_id WHERE id = :template_id").bindparams(
            version_id=CHAT_VERSION_ID,
            template_id=CHAT_TEMPLATE_ID,
        )
    )


def downgrade() -> None:
    previous_version_id = UUID("10000000-0000-0000-0000-000000000001")
    op.execute(
        sa.text("UPDATE prompt_templates SET active_version_id = :version_id WHERE id = :template_id").bindparams(
            version_id=previous_version_id,
            template_id=CHAT_TEMPLATE_ID,
        )
    )
    op.execute(
        sa.text("UPDATE prompt_versions SET status = 'active' WHERE id = :version_id").bindparams(
            version_id=previous_version_id
        )
    )
    op.execute(sa.text("DELETE FROM prompt_versions WHERE id = :version_id").bindparams(version_id=CHAT_VERSION_ID))
