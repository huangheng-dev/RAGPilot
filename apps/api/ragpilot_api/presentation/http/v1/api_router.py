from fastapi import APIRouter

from ragpilot_api.presentation.http.v1.agent_routes import router as agent_router
from ragpilot_api.presentation.http.v1.access_control_routes import router as access_control_router
from ragpilot_api.presentation.http.v1.api_key_routes import router as api_key_router
from ragpilot_api.presentation.http.v1.chat_routes import router as chat_router
from ragpilot_api.presentation.http.v1.document_routes import router as document_router
from ragpilot_api.presentation.http.v1.data_source_routes import router as data_source_router
from ragpilot_api.presentation.http.v1.health_routes import router as health_router
from ragpilot_api.presentation.http.v1.knowledge_base_routes import router as knowledge_base_router
from ragpilot_api.presentation.http.v1.model_endpoint_routes import router as model_endpoint_router
from ragpilot_api.presentation.http.v1.mcp_connector_routes import router as mcp_connector_router
from ragpilot_api.presentation.http.v1.retrieval_profile_routes import router as retrieval_profile_router
from ragpilot_api.presentation.http.v1.retrieval_routes import router as retrieval_router
from ragpilot_api.presentation.http.v1.runtime_governance_event_routes import router as runtime_governance_event_router
from ragpilot_api.presentation.http.v1.tenant_routes import router as tenant_router
from ragpilot_api.presentation.http.v1.tool_registration_routes import router as tool_registration_router
from ragpilot_api.presentation.http.v1.user_routes import router as user_router
from ragpilot_api.presentation.http.v1.workflow_routes import router as workflow_router
from ragpilot_api.presentation.http.v1.workspace_routes import router as workspace_router


api_router = APIRouter()
api_router.include_router(health_router, prefix="/health", tags=["health"])
api_router.include_router(tenant_router, prefix="/tenants", tags=["tenants"])
api_router.include_router(user_router, prefix="/users", tags=["users"])
api_router.include_router(workspace_router, prefix="/workspaces", tags=["workspaces"])
api_router.include_router(knowledge_base_router, prefix="/knowledge-bases", tags=["knowledge-bases"])
api_router.include_router(retrieval_profile_router, prefix="/retrieval-profiles", tags=["retrieval-profiles"])
api_router.include_router(runtime_governance_event_router, prefix="/runtime-governance", tags=["runtime-governance"])
api_router.include_router(document_router, prefix="/documents", tags=["documents"])
api_router.include_router(access_control_router, prefix="/access-control", tags=["access-control"])
api_router.include_router(data_source_router, prefix="/data-sources", tags=["data-sources"])
api_router.include_router(retrieval_router, prefix="/retrieve", tags=["retrieval"])
api_router.include_router(chat_router, prefix="/chat", tags=["chat"])
api_router.include_router(workflow_router, prefix="/workflow-runs", tags=["workflow-runs"])
api_router.include_router(agent_router, prefix="/agents", tags=["agents"])
api_router.include_router(api_key_router, prefix="/api-keys", tags=["api-keys"])
api_router.include_router(model_endpoint_router, prefix="/model-endpoints", tags=["model-endpoints"])
api_router.include_router(mcp_connector_router, prefix="/mcp-connectors", tags=["mcp-connectors"])
api_router.include_router(tool_registration_router, prefix="/tool-registrations", tags=["tool-registrations"])
