from ragpilot_api.infrastructure.database.base import Base
from ragpilot_api.infrastructure.database import models  # noqa: F401


def test_initial_platform_tables_are_registered() -> None:
    expected_tables = {
        "tenants",
        "users",
        "user_sessions",
        "tenant_memberships",
        "roles",
        "permissions",
        "role_permissions",
        "workspaces",
        "knowledge_bases",
        "agent_definitions",
        "agent_runs",
        "agent_executions",
        "model_endpoints",
        "retrieval_profiles",
        "retrieval_evaluations",
        "tool_registrations",
        "documents",
        "document_versions",
        "document_assets",
        "document_chunks",
        "document_chunk_embeddings",
        "conversations",
        "messages",
        "message_citations",
        "message_feedback_entries",
        "workflow_runs",
        "workflow_steps",
        "user_access_events",
    }

    assert expected_tables.issubset(Base.metadata.tables.keys())
