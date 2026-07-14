import asyncio
from datetime import timedelta

from temporalio import workflow


@workflow.defn(name="AgentExecutionWorkflow")
class AgentExecutionWorkflow:
    def __init__(self) -> None:
        self.approval_decision: dict[str, str] | None = None

    @workflow.signal
    async def decide_approval(self, decision: dict[str, str]) -> None:
        if self.approval_decision is None:
            self.approval_decision = decision

    @workflow.run
    async def run(self, payload: dict[str, str | None]) -> dict[str, str]:
        result = await workflow.execute_activity(
            "execute_agent_execution",
            payload,
            start_to_close_timeout=timedelta(minutes=30),
        )
        if result.get("execution_status") != "awaiting_approval":
            return result
        try:
            await workflow.wait_condition(
                lambda: self.approval_decision is not None,
                timeout=timedelta(seconds=int(result.get("approval_timeout_seconds") or "86400")),
            )
        except asyncio.TimeoutError:
            self.approval_decision = {"decision": "expired", "reason": "Approval request expired."}
        decision = self.approval_decision or {"decision": "expired"}
        if decision.get("decision") == "approved":
            resumed_payload = {
                **payload,
                "approved_tool_registration_ids": [result["tool_registration_id"]],
            }
            return await workflow.execute_activity(
                "execute_agent_execution",
                resumed_payload,
                start_to_close_timeout=timedelta(minutes=30),
            )
        return await workflow.execute_activity(
            "finalize_agent_approval",
            {**payload, **decision, "approval_request_id": result.get("approval_request_id", "")},
            start_to_close_timeout=timedelta(minutes=2),
        )
