from datetime import timedelta

from temporalio import workflow


@workflow.defn(name="SearchProjectionWorkflow")
class SearchProjectionWorkflow:
    @workflow.run
    async def run(self, payload: dict[str, str]) -> dict[str, object]:
        return await workflow.execute_activity(
            "project_document_version_to_elasticsearch",
            payload,
            schedule_to_close_timeout=timedelta(minutes=10),
        )
