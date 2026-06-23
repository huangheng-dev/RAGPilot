from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.agents.agent_runtime_engines import normalize_agent_runtime_engine_name
from ragpilot_api.application.model_gateway.runtime_binding_resolver import RuntimeBindingResolver
from ragpilot_api.contracts.http.health_contracts import HealthResponse
from ragpilot_api.application.system.runtime_readiness import build_runtime_readiness_snapshot
from ragpilot_api.infrastructure.database.repositories.model_endpoint_repository import ModelEndpointRepository
from ragpilot_api.shared.settings import get_settings


async def build_health_response(session: AsyncSession) -> HealthResponse:
    settings = get_settings()
    runtime_readiness = build_runtime_readiness_snapshot()
    runtime_binding = await RuntimeBindingResolver(
        ModelEndpointRepository(session),
        settings,
    ).resolve_chat_runtime_binding(agent_definition=None)
    return HealthResponse(
        service=settings.service_name,
        status="ok",
        environment=settings.environment,
        version="0.1.0",
        retrieval_engine=settings.retrieval_engine,
        agent_runtime_engine=normalize_agent_runtime_engine_name(settings.agent_runtime_engine),
        llamaindex_pilot_ready=runtime_readiness.llamaindex_pilot_ready,
        langgraph_pilot_ready=runtime_readiness.langgraph_pilot_ready,
        chat_model_provider=settings.chat_model_provider,
        chat_model_name=settings.chat_model_name,
        effective_chat_model_provider=runtime_binding.provider_type,
        effective_chat_model_name=runtime_binding.model_name,
        effective_chat_model_source=runtime_binding.source,
        effective_chat_model_endpoint_name=runtime_binding.model_endpoint_name,
        effective_chat_model_api_base_url=runtime_binding.api_base_url,
    )
