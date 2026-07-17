from typing import get_type_hints

import pytest
from temporalio.converter import DataConverter

from ragpilot_api.infrastructure.workflows import temporal_client
from ragpilot_api.workflows.agent_execution import AgentExecutionWorkflow


@pytest.mark.anyio
async def test_agent_execution_contract_accepts_nested_trace_context() -> None:
    payload = {
        "agent_execution_id": "execution-1",
        "tenant_id": "tenant-1",
        "actor_user_id": None,
        "actor_role": "admin",
        "max_runtime_seconds": "900",
        "trace_context": {
            "traceparent": "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01",
        },
    }
    payload_type = get_type_hints(AgentExecutionWorkflow.run)["payload"]
    converter = DataConverter.default
    encoded = await converter.encode([payload])
    decoded = await converter.decode(encoded, [payload_type])
    assert decoded == [payload]


def test_trace_context_is_nested_without_flattening_workflow_fields(monkeypatch) -> None:
    carrier = {"traceparent": "00-trace-span-01", "tracestate": "vendor=value"}
    monkeypatch.setattr(temporal_client, "current_trace_context", lambda: carrier)

    payload = temporal_client.with_current_trace_context({"document_id": "document-1"})

    assert payload == {"document_id": "document-1", "trace_context": carrier}
