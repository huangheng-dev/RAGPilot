from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.infrastructure.database.repositories.data_source_repository import (
    DataSourceRepository,
)


@pytest.mark.anyio
async def test_list_with_latest_run_filters_source_types_in_one_query() -> None:
    source = SimpleNamespace(id=uuid4())
    run = SimpleNamespace(id=uuid4(), data_source_id=source.id)
    result = SimpleNamespace(all=lambda: [(source, run, 2)])
    session = SimpleNamespace(execute=AsyncMock(return_value=result))

    items = await DataSourceRepository(session).list_with_latest_run(
        knowledge_base_id=uuid4(),
        source_types={"web", "connector"},
    )

    assert items == [(source, run, 2)]
    statement = str(session.execute.await_args.args[0])
    assert "LEFT OUTER JOIN data_source_sync_runs" in statement
    assert "data_sources.source_type IN" in statement
    assert "count(documents.id)" in statement
    assert "ORDER BY data_sources.updated_at DESC" in statement
