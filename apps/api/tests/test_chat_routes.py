from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.main import app
from ragpilot_api.presentation.http.v1 import chat_routes


async def override_database_session():
    yield None


def test_conversation_list_route_forwards_query(monkeypatch) -> None:
    captured: dict[str, object] = {}
    tenant_id = uuid4()
    workspace_id = uuid4()

    class FakeChatService:
        async def list_conversations(self, *, tenant_id, workspace_id, query, limit):
            captured.update(
                {
                    "tenant_id": tenant_id,
                    "workspace_id": workspace_id,
                    "query": query,
                    "limit": limit,
                }
            )
            return [
                {
                    "id": str(uuid4()),
                    "tenant_id": str(tenant_id),
                    "workspace_id": str(workspace_id),
                    "knowledge_base_id": str(uuid4()),
                    "title": "Release Readiness Review",
                    "created_by_user_id": None,
                    "message_count": 6,
                    "latest_activity_at": datetime.now(timezone.utc).isoformat(),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ]

    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/chat/conversations",
        params={"tenant_id": str(tenant_id), "workspace_id": str(workspace_id), "query": "release", "limit": "12"},
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "tenant_id": tenant_id,
        "workspace_id": workspace_id,
        "query": "release",
        "limit": 12,
    }
    assert response.json()[0]["title"] == "Release Readiness Review"
    assert response.json()[0]["message_count"] == 6


def test_conversation_metrics_route_forwards_scope(monkeypatch) -> None:
    captured: dict[str, object] = {}
    tenant_id = uuid4()
    workspace_id = uuid4()

    class FakeChatService:
        async def get_conversation_metrics(self, *, tenant_id, workspace_id):
            captured.update(
                {
                    "tenant_id": tenant_id,
                    "workspace_id": workspace_id,
                }
            )
            return {
                "total_conversations": 5,
                "active_conversations": 3,
                "total_messages": 12,
                "latest_activity_at": datetime.now(timezone.utc).isoformat(),
            }

    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/chat/conversations/metrics",
        params={"tenant_id": str(tenant_id), "workspace_id": str(workspace_id)},
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "tenant_id": tenant_id,
        "workspace_id": workspace_id,
    }
    assert response.json()["total_conversations"] == 5


def test_conversation_create_route_rejects_reviewer_role(monkeypatch) -> None:
    class FakeChatService:
        async def create_conversation(self, request):
            raise AssertionError("create_conversation should not be called for reviewer role.")

    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/chat/conversations",
        json={
            "tenant_id": str(uuid4()),
            "workspace_id": str(uuid4()),
            "knowledge_base_id": str(uuid4()),
            "title": "Blocked reviewer conversation",
        },
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_conversation_list_route_requires_chat_access(monkeypatch) -> None:
    class FakeChatService:
        async def list_conversations(self, **kwargs):
            raise AssertionError("list_conversations should not run without chat access.")

    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/chat/conversations",
        params={"tenant_id": str(uuid4()), "workspace_id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401


def test_conversation_list_route_requires_actor_identity(monkeypatch) -> None:
    class FakeChatService:
        async def list_conversations(self, **kwargs):
            raise AssertionError("list_conversations should not run without actor identity.")

    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/chat/conversations",
        params={"tenant_id": str(uuid4()), "workspace_id": str(uuid4())},
        headers={"X-RAGPilot-Role": "reviewer"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401


def test_chat_message_route_rejects_reviewer_role(monkeypatch) -> None:
    class FakeChatService:
        async def ask_question(self, request):
            raise AssertionError("ask_question should not be called for reviewer role.")

    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/chat/messages",
        json={
            "tenant_id": str(uuid4()),
            "workspace_id": str(uuid4()),
            "knowledge_base_id": str(uuid4()),
            "conversation_id": str(uuid4()),
            "question": "Can a reviewer send chat prompts?",
        },
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_chat_stream_route_emits_sse_deltas_and_completion(monkeypatch) -> None:
    tenant_id = uuid4()
    workspace_id = uuid4()
    knowledge_base_id = uuid4()

    class FakeResponse:
        assistant_message = SimpleNamespace(content="Temporal provides durable workflows.")

        def model_dump(self, *, mode):
            assert mode == "json"
            return {
                "conversation": {"id": str(uuid4())},
                "user_message": {"content": "question"},
                "assistant_message": {"content": self.assistant_message.content},
            }

    class FakeChatService:
        async def ask_question(self, request, *, on_delta=None, retrieval_acl_bypass=False):
            assert retrieval_acl_bypass is False
            assert on_delta is not None
            await on_delta("Temporal provides ")
            await on_delta("durable workflows.")
            return FakeResponse()

    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session
    client = TestClient(app)
    response = client.post(
        "/api/v1/chat/messages/stream",
        json={
            "tenant_id": str(tenant_id), "workspace_id": str(workspace_id),
            "knowledge_base_id": str(knowledge_base_id), "question": "Which system is durable?",
        },
        headers={"Accept": "text/event-stream", "X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
    )
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: start" in response.text
    assert "event: delta" in response.text
    assert 'data: {"content":"Temporal provides "}' in response.text
    assert 'data: {"content":"durable workflows."}' in response.text
    assert "event: complete" in response.text


def test_conversation_create_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"operator": {"access_home"}}

    class FakeChatService:
        async def create_conversation(self, request):
            raise AssertionError("create_conversation should not run when database policy denies chat access.")

    monkeypatch.setattr(chat_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/chat/conversations",
        json={
            "tenant_id": str(uuid4()),
            "workspace_id": str(uuid4()),
            "knowledge_base_id": str(uuid4()),
            "title": "Denied by policy",
        },
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_chat_message_route_forwards_agent_definition_id(monkeypatch) -> None:
    captured: dict[str, object] = {}
    tenant_id = uuid4()
    workspace_id = uuid4()
    knowledge_base_id = uuid4()
    agent_definition_id = uuid4()
    actor_user_id = uuid4()

    class FakeChatService:
        async def ask_question(self, request, *, retrieval_acl_bypass=False):
            assert retrieval_acl_bypass is False
            captured.update(
                {
                    "tenant_id": request.tenant_id,
                    "workspace_id": request.workspace_id,
                    "knowledge_base_id": request.knowledge_base_id,
                    "agent_definition_id": request.agent_definition_id,
                    "created_by_user_id": request.created_by_user_id,
                    "question": request.question,
                }
            )
            return {
                "conversation": {
                    "id": str(uuid4()),
                    "tenant_id": str(request.tenant_id),
                    "workspace_id": str(request.workspace_id),
                    "knowledge_base_id": str(request.knowledge_base_id),
                    "title": "Grounded agent conversation",
                    "created_by_user_id": None,
                    "message_count": 2,
                    "latest_activity_at": datetime.now(timezone.utc).isoformat(),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                "user_message": {
                    "id": str(uuid4()),
                    "tenant_id": str(request.tenant_id),
                    "conversation_id": str(uuid4()),
                    "role": "user",
                    "content": request.question,
                    "model_name": None,
                    "usage_json": {},
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "citations": [],
                },
                "assistant_message": {
                    "id": str(uuid4()),
                    "tenant_id": str(request.tenant_id),
                    "conversation_id": str(uuid4()),
                    "role": "assistant",
                    "content": "Temporal powers ingestion workflows.",
                    "model_name": "test-model",
                    "usage_json": {},
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "citations": [],
                },
            }

    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/chat/messages",
        json={
            "tenant_id": str(tenant_id),
            "workspace_id": str(workspace_id),
            "knowledge_base_id": str(knowledge_base_id),
            "agent_definition_id": str(agent_definition_id),
            "conversation_id": str(uuid4()),
            "question": "Which system powers ingestion workflows?",
        },
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(actor_user_id)},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "tenant_id": tenant_id,
        "workspace_id": workspace_id,
        "knowledge_base_id": knowledge_base_id,
        "agent_definition_id": agent_definition_id,
        "created_by_user_id": actor_user_id,
        "question": "Which system powers ingestion workflows?",
    }


def test_conversation_create_route_requires_actor_identity(monkeypatch) -> None:
    class FakeChatService:
        async def create_conversation(self, request):
            raise AssertionError("create_conversation should not run without actor identity.")

    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/chat/conversations",
        json={
            "tenant_id": str(uuid4()),
            "workspace_id": str(uuid4()),
            "knowledge_base_id": str(uuid4()),
            "title": "Blocked identity-free conversation",
        },
        headers={"X-RAGPilot-Role": "operator"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401


def test_chat_message_route_rejects_extra_fields(monkeypatch) -> None:
    class FakeChatService:
        async def ask_question(self, request):
            raise AssertionError("ask_question should not run when extra fields are submitted.")

    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/chat/messages",
        json={
            "tenant_id": str(uuid4()),
            "workspace_id": str(uuid4()),
            "knowledge_base_id": str(uuid4()),
            "question": "Can I send extra fields?",
            "unexpected_field": "blocked",
        },
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 422


def test_message_feedback_route_requires_actor_user(monkeypatch) -> None:
    class FakeChatService:
        async def submit_message_feedback(self, **kwargs):
            raise AssertionError("submit_message_feedback should not run without actor user scope.")

    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/chat/messages/{uuid4()}/feedback",
        params={"tenant_id": str(uuid4())},
        json={
            "answer_quality": "not_helpful",
            "citation_quality": "partial",
            "issue_labels": ["answer_quality_review"],
            "feedback_notes": "Needs review.",
        },
        headers={"X-RAGPilot-Role": "operator"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401


def test_message_feedback_route_forwards_actor_feedback(monkeypatch) -> None:
    captured: dict[str, object] = {}
    tenant_id = uuid4()
    message_id = uuid4()
    actor_user_id = uuid4()

    class FakeChatService:
        async def submit_message_feedback(self, *, tenant_id, message_id, submitted_by_user_id, request):
            captured.update(
                {
                    "tenant_id": tenant_id,
                    "message_id": message_id,
                    "submitted_by_user_id": submitted_by_user_id,
                    "answer_quality": request.answer_quality,
                    "citation_quality": request.citation_quality,
                    "issue_labels": request.issue_labels,
                    "feedback_notes": request.feedback_notes,
                }
            )
            return {
                "id": str(uuid4()),
                "message_id": str(message_id),
                "submitted_by_user_id": str(submitted_by_user_id),
                "answer_quality": request.answer_quality,
                "citation_quality": request.citation_quality,
                "issue_labels": request.issue_labels,
                "feedback_notes": request.feedback_notes,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/chat/messages/{message_id}/feedback",
        params={"tenant_id": str(tenant_id)},
        json={
            "answer_quality": "not_helpful",
            "citation_quality": "partial",
            "issue_labels": ["answer_quality_review"],
            "feedback_notes": "Needs review.",
        },
        headers={
            "X-RAGPilot-Role": "operator",
            "X-RAGPilot-Actor-Id": str(actor_user_id),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "tenant_id": tenant_id,
        "message_id": message_id,
        "submitted_by_user_id": actor_user_id,
        "answer_quality": "not_helpful",
        "citation_quality": "partial",
        "issue_labels": ["answer_quality_review"],
        "feedback_notes": "Needs review.",
    }


def test_message_feedback_summary_route_forwards_scope(monkeypatch) -> None:
    captured: dict[str, object] = {}
    tenant_id = uuid4()
    workspace_id = uuid4()
    knowledge_base_id = uuid4()

    class FakeChatService:
        async def get_message_feedback_summary(self, *, tenant_id, workspace_id, knowledge_base_id=None):
            captured.update(
                {
                    "tenant_id": tenant_id,
                    "workspace_id": workspace_id,
                    "knowledge_base_id": knowledge_base_id,
                }
            )
            return {
                "total_feedback": 3,
                "helpful_feedback": 1,
                "partially_helpful_feedback": 1,
                "not_helpful_feedback": 1,
                "citation_issue_feedback": 2,
                "retrieval_tuning_candidates": 2,
                "recent_feedback": [
                    {
                        "id": str(uuid4()),
                        "message_id": str(uuid4()),
                        "conversation_id": str(uuid4()),
                        "conversation_title": "Grounded review",
                        "knowledge_base_id": str(knowledge_base_id),
                        "submitted_by_user_id": str(uuid4()),
                        "answer_quality": "not_helpful",
                        "citation_quality": "broken",
                        "issue_labels": ["citation_broken"],
                        "feedback_notes": "Needs better evidence.",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "assistant_excerpt": "The answer drifted from the source.",
                        "latest_user_question": "Which system runs durable ingestion workflows?",
                        "retrieval_profile_id": str(uuid4()),
                        "retrieval_profile_name": "RAGPilot-default",
                        "follow_up_status": "resolved",
                        "recommended_actions": [
                            {
                                "action_key": "review_knowledge_base_governance",
                                "action_category": "governance",
                                "action_label": "Review knowledge base scope",
                                "action_reason": "Review the current source scope.",
                            }
                        ],
                    }
                ],
            }

    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/chat/feedback/summary",
        params={
            "tenant_id": str(tenant_id),
            "workspace_id": str(workspace_id),
            "knowledge_base_id": str(knowledge_base_id),
        },
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "tenant_id": tenant_id,
        "workspace_id": workspace_id,
        "knowledge_base_id": knowledge_base_id,
    }
    assert response.json()["retrieval_tuning_candidates"] == 2
    assert response.json()["recent_feedback"][0]["recommended_actions"][0]["action_key"] == "review_knowledge_base_governance"
    assert response.json()["recent_feedback"][0]["follow_up_status"] == "resolved"


def test_conversation_update_route_forwards_title_and_tenant_scope(monkeypatch) -> None:
    captured: dict[str, object] = {}
    conversation_id = uuid4()
    tenant_id = uuid4()

    class FakeChatService:
        async def update_conversation(self, *, conversation_id, tenant_id, request):
            captured.update(
                {
                    "conversation_id": conversation_id,
                    "tenant_id": tenant_id,
                    "title": request.title,
                }
            )
            return {
                "id": str(conversation_id),
                "tenant_id": str(tenant_id),
                "workspace_id": str(uuid4()),
                "knowledge_base_id": str(uuid4()),
                "title": request.title,
                "created_by_user_id": None,
                "message_count": 4,
                "latest_activity_at": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.patch(
        f"/api/v1/chat/conversations/{conversation_id}",
        params={"tenant_id": str(tenant_id)},
        json={"title": "Renamed Conversation"},
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "conversation_id": conversation_id,
        "tenant_id": tenant_id,
        "title": "Renamed Conversation",
    }
    assert response.json()["title"] == "Renamed Conversation"


def test_conversation_update_route_rejects_reviewer_role(monkeypatch) -> None:
    class FakeChatService:
        async def update_conversation(self, *, conversation_id, tenant_id, request):
            raise AssertionError("update_conversation should not be called for reviewer role.")

    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.patch(
        f"/api/v1/chat/conversations/{uuid4()}",
        params={"tenant_id": str(uuid4())},
        json={"title": "Reviewer should be blocked"},
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_conversation_delete_route_forwards_scope(monkeypatch) -> None:
    captured: dict[str, object] = {}
    conversation_id = uuid4()
    tenant_id = uuid4()

    class FakeChatService:
        async def delete_conversation(self, *, conversation_id, tenant_id):
            captured.update(
                {
                    "conversation_id": conversation_id,
                    "tenant_id": tenant_id,
                }
            )

    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.delete(
        f"/api/v1/chat/conversations/{conversation_id}",
        params={"tenant_id": str(tenant_id)},
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 204
    assert captured == {
        "conversation_id": conversation_id,
        "tenant_id": tenant_id,
    }


def test_conversation_delete_route_rejects_reviewer_role(monkeypatch) -> None:
    class FakeChatService:
        async def delete_conversation(self, *, conversation_id, tenant_id):
            raise AssertionError("delete_conversation should not be called for reviewer role.")

    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.delete(
        f"/api/v1/chat/conversations/{uuid4()}",
        params={"tenant_id": str(uuid4())},
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_message_list_route_returns_enriched_citations(monkeypatch) -> None:
    captured: dict[str, object] = {}
    tenant_id = uuid4()
    conversation_id = uuid4()
    message_id = uuid4()
    document_chunk_id = uuid4()
    document_id = uuid4()
    document_version_id = uuid4()
    knowledge_base_id = uuid4()

    class FakeChatService:
        async def list_messages(self, *, tenant_id, conversation_id):
            captured.update(
                {
                    "tenant_id": tenant_id,
                    "conversation_id": conversation_id,
                }
            )
            return [
                {
                    "id": str(message_id),
                    "tenant_id": str(tenant_id),
                    "conversation_id": str(conversation_id),
                    "role": "assistant",
                    "content": "Temporal powers durable ingestion workflows.",
                    "model_name": "test-model",
                    "usage_json": {},
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "citations": [
                        {
                            "id": str(uuid4()),
                            "document_chunk_id": str(document_chunk_id),
                            "document_id": str(document_id),
                            "document_title": "RAGPilot Handbook",
                            "document_version_id": str(document_version_id),
                            "knowledge_base_id": str(knowledge_base_id),
                            "chunk_index": 3,
                            "rank": 1,
                            "score": 0.991231,
                            "retrieval_method": "hybrid",
                            "vector_score": 0.91,
                            "lexical_score": 3.0,
                            "lexical_normalized_score": 1.0,
                            "quote": "RAGPilot uses Temporal for durable ingestion workflows.",
                        }
                    ],
                }
            ]

    monkeypatch.setattr(chat_routes, "build_chat_service", lambda session: FakeChatService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/chat/messages",
        params={"tenant_id": str(tenant_id), "conversation_id": str(conversation_id)},
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "tenant_id": tenant_id,
        "conversation_id": conversation_id,
    }
    payload = response.json()
    assert payload[0]["citations"][0]["document_title"] == "RAGPilot Handbook"
    assert payload[0]["citations"][0]["chunk_index"] == 3
    assert payload[0]["citations"][0]["retrieval_method"] == "hybrid"
