from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.main import app
from ragpilot_api.presentation.http.v1 import knowledge_base_routes, workspace_routes


async def override_database_session():
    yield None


def test_workspace_list_route_exposes_archive_filter(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeWorkspaceService:
        async def list_workspaces(self, tenant_id, *, is_archived):
            captured.update({"tenant_id": tenant_id, "is_archived": is_archived})
            return [
                {
                    "id": str(uuid4()),
                    "tenant_id": str(tenant_id),
                    "name": "Archived Operations",
                    "slug": "archived-operations",
                    "description": "Archived workspace",
                    "is_archived": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ]

    monkeypatch.setattr(workspace_routes, "build_workspace_service", lambda session: FakeWorkspaceService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/workspaces",
        params={"tenant_id": str(uuid4()), "is_archived": "true"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["is_archived"] is True
    assert response.json()[0]["is_archived"] is True


def test_knowledge_base_list_route_exposes_publication_filter(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeKnowledgeBaseService:
        async def list_knowledge_bases(self, workspace_id, *, publication_status):
            captured.update({"workspace_id": workspace_id, "publication_status": publication_status})
            return [
                {
                    "id": str(uuid4()),
                    "tenant_id": str(uuid4()),
                    "workspace_id": str(workspace_id),
                    "name": "Operator Handbook",
                    "slug": "operator-handbook",
                    "description": "Published knowledge base",
                    "retrieval_profile_id": None,
                    "retrieval_profile_name": None,
                    "publication_status": "published",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ]

    monkeypatch.setattr(knowledge_base_routes, "build_knowledge_base_service", lambda session: FakeKnowledgeBaseService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/knowledge-bases",
        params={"workspace_id": str(uuid4()), "publication_status": "published"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["publication_status"] == "published"
    assert response.json()[0]["publication_status"] == "published"
