from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.infrastructure.database.repositories.conversation_repository import ConversationRepository


@pytest.mark.anyio
async def test_delete_conversation_removes_message_dependents_before_messages() -> None:
    tenant_id = uuid4()
    conversation_id = uuid4()
    session = SimpleNamespace(
        scalar=AsyncMock(return_value=SimpleNamespace(id=conversation_id)),
        execute=AsyncMock(),
        commit=AsyncMock(),
    )

    deleted = await ConversationRepository(session).delete_conversation(
        conversation_id=conversation_id,
        tenant_id=tenant_id,
    )

    assert deleted is True
    executed_statements = [str(call.args[0]) for call in session.execute.await_args_list]
    assert len(executed_statements) == 4
    assert executed_statements[0].startswith("DELETE FROM message_feedback_entries")
    assert executed_statements[1].startswith("DELETE FROM message_citations")
    assert executed_statements[2].startswith("DELETE FROM messages")
    assert executed_statements[3].startswith("DELETE FROM conversations")
    session.commit.assert_awaited_once()
