from ragpilot_api.application.system.runtime_readiness import (
    build_runtime_readiness_snapshot,
    is_module_available,
)


def test_is_module_available_checks_import_spec(monkeypatch) -> None:
    monkeypatch.setattr(
        "ragpilot_api.application.system.runtime_readiness.importlib.util.find_spec",
        lambda module_name: object() if module_name == "langgraph.graph" else None,
    )

    assert is_module_available("langgraph.graph") is True
    assert is_module_available("llama_index.core") is False


def test_build_runtime_readiness_snapshot_reports_optional_runtime_flags(monkeypatch) -> None:
    monkeypatch.setattr(
        "ragpilot_api.application.system.runtime_readiness.is_module_available",
        lambda module_name: module_name == "llama_index.core",
    )

    snapshot = build_runtime_readiness_snapshot()

    assert snapshot.llamaindex_pilot_ready is True
    assert snapshot.langgraph_pilot_ready is False
