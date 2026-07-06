import pytest

from ragpilot_api.presentation.http import request_actor
from ragpilot_api.shared.settings import Settings


@pytest.fixture(autouse=True)
def enable_legacy_actor_headers_in_route_tests(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        request_actor,
        "get_settings",
        lambda: Settings(allow_legacy_actor_headers=True),
    )
