from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.chat.chat_service import ChatService
from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.contracts.http.chat_contracts import (
    ChatAskRequest,
    ChatAskResponse,
    ConversationCreateRequest,
    ConversationMetricsResponse,
    ConversationResponse,
    ConversationUpdateRequest,
    MessageFeedbackCreateRequest,
    MessageFeedbackResponse,
    MessageFeedbackSummaryResponse,
    MessageResponse,
)
from ragpilot_api.infrastructure.database.repositories.agent_repository import AgentRepository
from ragpilot_api.infrastructure.database.repositories.conversation_repository import ConversationRepository
from ragpilot_api.infrastructure.database.repositories.knowledge_base_repository import KnowledgeBaseRepository
from ragpilot_api.infrastructure.database.repositories.model_endpoint_repository import ModelEndpointRepository
from ragpilot_api.infrastructure.database.repositories.message_repository import MessageRepository
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_evaluation_repository import RetrievalEvaluationRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_profile_repository import RetrievalProfileRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_repository import RetrievalRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    get_request_actor,
    require_authenticated_actor,
    require_actor_capability_from_policy,
    require_actor_tenant_access,
)
from ragpilot_api.shared.settings import get_settings


router = APIRouter()


def build_chat_service(session: AsyncSession) -> ChatService:
    return ChatService(
        agent_repository=AgentRepository(session),
        conversation_repository=ConversationRepository(session),
        message_repository=MessageRepository(session),
        retrieval_repository=RetrievalRepository(session),
        settings=get_settings(),
        model_endpoint_repository=ModelEndpointRepository(session),
        knowledge_base_repository=KnowledgeBaseRepository(session),
        retrieval_profile_repository=RetrievalProfileRepository(session),
        retrieval_evaluation_repository=RetrievalEvaluationRepository(session),
    )


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    request: ConversationCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ConversationResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "send_chat_messages",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, request.tenant_id)
    return await build_chat_service(session).create_conversation(
        request.model_copy(update={"created_by_user_id": actor.user_id})
    )


@router.post("/messages", response_model=ChatAskResponse, status_code=status.HTTP_200_OK)
async def ask_question(
    request: ChatAskRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ChatAskResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "send_chat_messages",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, request.tenant_id)
    try:
        return await build_chat_service(session).ask_question(
            request.model_copy(update={"created_by_user_id": actor.user_id})
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except httpx.ReadTimeout as error:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="The configured chat model did not respond before the request timeout.",
        ) from error
    except httpx.RequestError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The configured chat model is currently unavailable.",
        ) from error


@router.get("/conversations", response_model=list[ConversationResponse], status_code=status.HTTP_200_OK)
async def list_conversations(
    tenant_id: UUID = Query(...),
    workspace_id: UUID = Query(...),
    query: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[ConversationResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_chat",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    return await build_chat_service(session).list_conversations(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        query=query,
        limit=limit,
    )


@router.get("/conversations/metrics", response_model=ConversationMetricsResponse, status_code=status.HTTP_200_OK)
async def get_conversation_metrics(
    tenant_id: UUID = Query(...),
    workspace_id: UUID | None = Query(default=None),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ConversationMetricsResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_chat",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    return await build_chat_service(session).get_conversation_metrics(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
    )


@router.patch("/conversations/{conversation_id}", response_model=ConversationResponse, status_code=status.HTTP_200_OK)
async def update_conversation(
    conversation_id: UUID,
    request: ConversationUpdateRequest,
    tenant_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ConversationResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "send_chat_messages",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    return await build_chat_service(session).update_conversation(
        conversation_id=conversation_id,
        tenant_id=tenant_id,
        request=request,
    )


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: UUID,
    tenant_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> None:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "send_chat_messages",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    await build_chat_service(session).delete_conversation(
        conversation_id=conversation_id,
        tenant_id=tenant_id,
    )


@router.get("/messages", response_model=list[MessageResponse], status_code=status.HTTP_200_OK)
async def list_messages(
    tenant_id: UUID = Query(...),
    conversation_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[MessageResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_chat",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    return await build_chat_service(session).list_messages(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )


@router.post("/messages/{message_id}/feedback", response_model=MessageFeedbackResponse, status_code=status.HTTP_200_OK)
async def submit_message_feedback(
    message_id: UUID,
    request: MessageFeedbackCreateRequest,
    tenant_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> MessageFeedbackResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_chat",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    try:
        return await build_chat_service(session).submit_message_feedback(
            tenant_id=tenant_id,
            message_id=message_id,
            submitted_by_user_id=actor.user_id,
            request=request,
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get("/feedback/summary", response_model=MessageFeedbackSummaryResponse, status_code=status.HTTP_200_OK)
async def get_message_feedback_summary(
    tenant_id: UUID = Query(...),
    workspace_id: UUID = Query(...),
    knowledge_base_id: UUID | None = Query(default=None),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> MessageFeedbackSummaryResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_chat",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    return await build_chat_service(session).get_message_feedback_summary(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        knowledge_base_id=knowledge_base_id,
    )
