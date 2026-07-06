from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.documents.document_service import DocumentService
from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.contracts.http.document_contracts import (
    DocumentActivityResponse,
    DocumentCreateRequest,
    DocumentDeleteResponse,
    DocumentDetailResponse,
    DocumentMetricsResponse,
    DocumentResponse,
    DocumentRestoreResponse,
    DocumentUploadResponse,
    DocumentWorkflowActionResponse,
    WebPageImportRequest,
)
from ragpilot_api.infrastructure.database.repositories.document_repository import DocumentRepository
from ragpilot_api.infrastructure.database.repositories.knowledge_base_repository import KnowledgeBaseRepository
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.workflow_repository import WorkflowRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    get_request_actor,
    require_actor_capability_from_policy,
    require_authenticated_actor,
    require_actor_knowledge_base_access,
)


router = APIRouter()


def build_document_service(session: AsyncSession) -> DocumentService:
    return DocumentService(
        DocumentRepository(session),
        workflow_repository=WorkflowRepository(session),
    )


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    request: DocumentCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> DocumentResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_documents",
        RolePermissionRepository(session),
    )
    resolved_tenant_id = await require_actor_knowledge_base_access(
        actor,
        request.knowledge_base_id,
        KnowledgeBaseRepository(session),
    )
    if resolved_tenant_id is not None and resolved_tenant_id != request.tenant_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tenant and knowledge base scope do not match.")
    try:
        return await build_document_service(session).create_document(request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    response: Response,
    knowledge_base_id: UUID = Query(...),
    query: str | None = Query(default=None, min_length=1, max_length=240),
    status_filter: str | None = Query(default=None, alias="status"),
    source_kind_filter: Literal["all", "file", "web", "other"] = Query(default="all", alias="source_kind"),
    lifecycle_filter: Literal["active", "deleted", "all"] = Query(default="active", alias="lifecycle"),
    sort_order: Literal[
        "updated-desc",
        "created-desc",
        "created-asc",
        "title-asc",
        "title-desc",
        "status-priority",
    ] = Query(default="created-desc", alias="sort"),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[DocumentResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_documents",
        RolePermissionRepository(session),
    )
    await require_actor_knowledge_base_access(actor, knowledge_base_id, KnowledgeBaseRepository(session))
    documents, total_count = await build_document_service(session).list_documents(
        knowledge_base_id=knowledge_base_id,
        query=query,
        status_filter=status_filter,
        source_kind_filter=source_kind_filter,
        lifecycle_filter=lifecycle_filter,
        sort_order=sort_order,
        limit=limit,
        offset=offset,
    )
    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Limit"] = str(limit)
    response.headers["X-Offset"] = str(offset)
    response.headers["X-Result-Count"] = str(len(documents))
    return documents


@router.get("/metrics", response_model=DocumentMetricsResponse)
async def get_document_metrics(
    knowledge_base_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> DocumentMetricsResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_documents",
        RolePermissionRepository(session),
    )
    await require_actor_knowledge_base_access(actor, knowledge_base_id, KnowledgeBaseRepository(session))
    return await build_document_service(session).get_document_metrics(knowledge_base_id=knowledge_base_id)


@router.get("/{document_id}", response_model=DocumentDetailResponse)
async def get_document_detail(
    document_id: UUID,
    knowledge_base_id: UUID = Query(...),
    document_version_id: UUID | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> DocumentDetailResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_documents",
        RolePermissionRepository(session),
    )
    await require_actor_knowledge_base_access(actor, knowledge_base_id, KnowledgeBaseRepository(session))
    detail = await build_document_service(session).get_document_detail(
        document_id=document_id,
        knowledge_base_id=knowledge_base_id,
        document_version_id=document_version_id,
        include_deleted=include_deleted,
    )
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return detail


@router.get("/{document_id}/activity", response_model=DocumentActivityResponse)
async def get_document_activity(
    document_id: UUID,
    knowledge_base_id: UUID = Query(...),
    include_deleted: bool = Query(default=False),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> DocumentActivityResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_documents",
        RolePermissionRepository(session),
    )
    await require_actor_knowledge_base_access(actor, knowledge_base_id, KnowledgeBaseRepository(session))
    activity = await build_document_service(session).get_document_activity(
        document_id=document_id,
        knowledge_base_id=knowledge_base_id,
        include_deleted=include_deleted,
    )
    if activity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return activity


@router.post("/{document_id}/reindex", response_model=DocumentWorkflowActionResponse)
async def reindex_document(
    document_id: UUID,
    knowledge_base_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> DocumentWorkflowActionResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_documents",
        RolePermissionRepository(session),
    )
    await require_actor_knowledge_base_access(actor, knowledge_base_id, KnowledgeBaseRepository(session))
    try:
        return await build_document_service(session).reindex_document(
            document_id=document_id,
            knowledge_base_id=knowledge_base_id,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.delete("/{document_id}", response_model=DocumentDeleteResponse)
async def delete_document(
    document_id: UUID,
    knowledge_base_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> DocumentDeleteResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_documents",
        RolePermissionRepository(session),
    )
    await require_actor_knowledge_base_access(actor, knowledge_base_id, KnowledgeBaseRepository(session))
    try:
        return await build_document_service(session).delete_document(
            document_id=document_id,
            knowledge_base_id=knowledge_base_id,
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/{document_id}/restore", response_model=DocumentRestoreResponse)
async def restore_document(
    document_id: UUID,
    knowledge_base_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> DocumentRestoreResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_documents",
        RolePermissionRepository(session),
    )
    await require_actor_knowledge_base_access(actor, knowledge_base_id, KnowledgeBaseRepository(session))
    try:
        return await build_document_service(session).restore_document(
            document_id=document_id,
            knowledge_base_id=knowledge_base_id,
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    tenant_id: UUID = Form(...),
    knowledge_base_id: UUID = Form(...),
    title: str = Form(...),
    file: UploadFile = File(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> DocumentUploadResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_documents",
        RolePermissionRepository(session),
    )
    try:
        resolved_tenant_id = await require_actor_knowledge_base_access(
            actor,
            knowledge_base_id,
            KnowledgeBaseRepository(session),
        )
        if resolved_tenant_id is not None and resolved_tenant_id != tenant_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tenant and knowledge base scope do not match.")
        content = await file.read()
        return await build_document_service(session).upload_document(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            title=title,
            file_name=file.filename or "document",
            content_type=file.content_type,
            content=content,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.post("/import-webpage", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def import_webpage_document(
    request: WebPageImportRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> DocumentUploadResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_documents",
        RolePermissionRepository(session),
    )
    try:
        resolved_tenant_id = await require_actor_knowledge_base_access(
            actor,
            request.knowledge_base_id,
            KnowledgeBaseRepository(session),
        )
        if resolved_tenant_id is not None and resolved_tenant_id != request.tenant_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tenant and knowledge base scope do not match.")
        return await build_document_service(session).import_web_page(request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
