from pydantic import BaseModel


class HealthResponse(BaseModel):
    service: str
    status: str
    environment: str
    version: str
    retrieval_engine: str
    agent_runtime_engine: str
    llamaindex_pilot_ready: bool
    langgraph_pilot_ready: bool
    chat_model_provider: str
    chat_model_name: str
    effective_chat_model_provider: str
    effective_chat_model_name: str
    effective_chat_model_source: str
    effective_chat_model_endpoint_name: str | None = None
    effective_chat_model_api_base_url: str | None = None
