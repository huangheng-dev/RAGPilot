from datetime import timedelta

from temporalio import workflow


@workflow.defn(name="AgentExecutionWorkflow")
class AgentExecutionWorkflow:
    @workflow.run
    async def run(self, payload: dict[str, str | None]) -> dict[str, str]:
        return await workflow.execute_activity(
            "execute_agent_execution",
            payload,
            start_to_close_timeout=timedelta(minutes=30),
        )
