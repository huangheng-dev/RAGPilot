from __future__ import annotations

import importlib.util
from dataclasses import dataclass


@dataclass(frozen=True)
class RuntimeReadinessSnapshot:
    llamaindex_pilot_ready: bool
    langgraph_pilot_ready: bool


def is_module_available(module_name: str) -> bool:
    try:
        return importlib.util.find_spec(module_name) is not None
    except ModuleNotFoundError:
        return False


def build_runtime_readiness_snapshot() -> RuntimeReadinessSnapshot:
    return RuntimeReadinessSnapshot(
        llamaindex_pilot_ready=is_module_available("llama_index.core"),
        langgraph_pilot_ready=is_module_available("langgraph.graph"),
    )
