from ragpilot_worker.domain.connectors import ConnectorAdapter
from ragpilot_worker.infrastructure.connectors.public_web import PublicWebConnector


def build_connector_registry() -> dict[str, ConnectorAdapter]:
    adapters: list[ConnectorAdapter] = [PublicWebConnector()]
    return {adapter.connector_kind: adapter for adapter in adapters}


def resolve_connector(kind: str) -> ConnectorAdapter:
    adapter = build_connector_registry().get(kind.strip().lower())
    if adapter is None:
        raise ValueError(f"Unsupported connector kind '{kind}'.")
    return adapter
