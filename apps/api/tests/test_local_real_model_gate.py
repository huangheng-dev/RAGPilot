from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest

from ragpilot_api.commands.local_real_model_gate import evaluate_real_model


@pytest.mark.anyio
async def test_real_model_gate_reports_sanitized_evidence_and_cleans_up() -> None:
    tenant_id = uuid4()
    conversation_id = uuid4()
    key_id = uuid4()
    calls: list[tuple[str, object]] = []

    class FakeApiKeyService:
        async def create(self, request, *, actor_user_id):
            calls.append(("create", request))
            return SimpleNamespace(id=key_id, secret="rpk_real_model_temporary")

        async def revoke(self, **kwargs):
            calls.append(("revoke", kwargs))

    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["X-API-Key"] == "rpk_real_model_temporary"
        if request.method == "POST":
            return httpx.Response(
                200,
                json={
                    "conversation": {"id": str(conversation_id)},
                    "assistant_message": {
                        "content": "Grounded answer",
                        "model_name": "qwen3.5:latest",
                        "usage_json": {
                            "provider": "ollama",
                            "retrieval_result_count": 3,
                        },
                        "citations": [{"rank": 1}],
                    },
                },
            )
        assert request.url.params["tenant_id"] == str(tenant_id)
        return httpx.Response(204)

    report = await evaluate_real_model(
        base_url="http://localhost:8000",
        tenant_id=tenant_id,
        workspace_id=uuid4(),
        knowledge_base_id=uuid4(),
        actor_user_id=uuid4(),
        question="What is the governed recovery process?",
        expected_model="qwen3.5:latest",
        api_key_service=FakeApiKeyService(),
        transport=httpx.MockTransport(handler),
    )

    assert report["promotion"]["passed"] is True
    assert report["citation_count"] == 1
    assert "Grounded answer" not in str(report)
    assert "rpk_real_model_temporary" not in str(report)
    assert [name for name, _ in calls] == ["create", "revoke"]
    assert calls[0][1].scopes == ["access_chat", "send_chat_messages"]


@pytest.mark.anyio
async def test_real_model_gate_rejects_remote_target_before_creating_key() -> None:
    class UnexpectedApiKeyService:
        async def create(self, request, *, actor_user_id):
            raise AssertionError("A local credential must not target a remote deployment.")

    with pytest.raises(ValueError, match="loopback"):
        await evaluate_real_model(
            base_url="https://staging.example.com",
            tenant_id=uuid4(),
            workspace_id=uuid4(),
            knowledge_base_id=uuid4(),
            actor_user_id=uuid4(),
            question="test",
            expected_model=None,
            api_key_service=UnexpectedApiKeyService(),
        )
