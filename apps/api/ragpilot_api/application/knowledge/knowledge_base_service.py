from uuid import UUID

from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.contracts.http.knowledge_base_contracts import (
    KnowledgeBaseCreateRequest,
    KnowledgeBasePublicationRequest,
    KnowledgeBaseResponse,
    KnowledgeBaseUpdateRequest,
)
from ragpilot_api.infrastructure.database.models import KnowledgeBase
from ragpilot_api.infrastructure.database.repositories.knowledge_base_repository import KnowledgeBaseRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_profile_repository import RetrievalProfileRepository


class KnowledgeBaseService:
    def __init__(
        self,
        knowledge_base_repository: KnowledgeBaseRepository,
        retrieval_profile_repository: RetrievalProfileRepository,
    ) -> None:
        self.knowledge_base_repository = knowledge_base_repository
        self.retrieval_profile_repository = retrieval_profile_repository

    async def create_knowledge_base(self, request: KnowledgeBaseCreateRequest) -> KnowledgeBaseResponse:
        retrieval_profile = await self._resolve_retrieval_profile(request.retrieval_profile_id)
        knowledge_base = await self.knowledge_base_repository.create_knowledge_base(
            tenant_id=request.tenant_id,
            workspace_id=request.workspace_id,
            name=request.name,
            slug=request.slug,
            description=request.description,
            retrieval_profile_id=retrieval_profile.id if retrieval_profile is not None else None,
        )
        return build_knowledge_base_response(knowledge_base, retrieval_profile_name=retrieval_profile.name if retrieval_profile else None)

    async def list_knowledge_bases(
        self,
        workspace_id: UUID,
        *,
        publication_status: str | None = None,
    ) -> list[KnowledgeBaseResponse]:
        knowledge_bases = await self.knowledge_base_repository.list_knowledge_bases_with_filters(
            workspace_id=workspace_id,
            publication_status=publication_status,
        )
        retrieval_profile_map = await self._build_retrieval_profile_name_map(knowledge_bases)
        return [
            build_knowledge_base_response(
                knowledge_base,
                retrieval_profile_name=retrieval_profile_map.get(str(knowledge_base.retrieval_profile_id)),
            )
            for knowledge_base in knowledge_bases
        ]

    async def update_knowledge_base(
        self,
        *,
        knowledge_base_id: UUID,
        workspace_id: UUID,
        request: KnowledgeBaseUpdateRequest,
    ) -> KnowledgeBaseResponse | None:
        retrieval_profile = await self._resolve_retrieval_profile(request.retrieval_profile_id)
        knowledge_base = await self.knowledge_base_repository.update_knowledge_base(
            knowledge_base_id=knowledge_base_id,
            workspace_id=workspace_id,
            name=request.name,
            slug=request.slug,
            description=request.description,
            retrieval_profile_id=retrieval_profile.id if retrieval_profile is not None else None,
        )
        if knowledge_base is None:
            return None
        return build_knowledge_base_response(knowledge_base, retrieval_profile_name=retrieval_profile.name if retrieval_profile else None)

    async def set_publication_status(
        self,
        *,
        knowledge_base_id: UUID,
        workspace_id: UUID,
        request: KnowledgeBasePublicationRequest,
    ) -> KnowledgeBaseResponse | None:
        knowledge_base = await self.knowledge_base_repository.set_publication_status(
            knowledge_base_id=knowledge_base_id,
            workspace_id=workspace_id,
            publication_status=request.publication_status,
        )
        if knowledge_base is None:
            return None
        retrieval_profile_name = None
        if knowledge_base.retrieval_profile_id is not None:
            retrieval_profile = await self.retrieval_profile_repository.get_retrieval_profile(
                retrieval_profile_id=knowledge_base.retrieval_profile_id
            )
            retrieval_profile_name = retrieval_profile.name if retrieval_profile is not None else None
        return build_knowledge_base_response(knowledge_base, retrieval_profile_name=retrieval_profile_name)

    async def _resolve_retrieval_profile(self, retrieval_profile_id: UUID | None):
        if retrieval_profile_id is not None:
            retrieval_profile = await self.retrieval_profile_repository.get_retrieval_profile(
                retrieval_profile_id=retrieval_profile_id
            )
            if retrieval_profile is None:
                raise ResourceNotFoundError("Retrieval profile not found.")
            if not retrieval_profile.is_enabled:
                raise ResourceConflictError("Retrieval profile must be enabled before it can be assigned to a knowledge base.")
            return retrieval_profile

        return await self.retrieval_profile_repository.get_default_enabled_retrieval_profile()

    async def _build_retrieval_profile_name_map(self, knowledge_bases: list[KnowledgeBase]) -> dict[str, str]:
        retrieval_profile_ids = [
            knowledge_base.retrieval_profile_id
            for knowledge_base in knowledge_bases
            if knowledge_base.retrieval_profile_id is not None
        ]
        retrieval_profiles = await self.retrieval_profile_repository.list_retrieval_profiles_by_ids(
            retrieval_profile_ids=retrieval_profile_ids
        )
        return {str(retrieval_profile.id): retrieval_profile.name for retrieval_profile in retrieval_profiles}


def build_knowledge_base_response(
    knowledge_base: KnowledgeBase,
    *,
    retrieval_profile_name: str | None = None,
) -> KnowledgeBaseResponse:
    return KnowledgeBaseResponse(
        id=knowledge_base.id,
        tenant_id=knowledge_base.tenant_id,
        workspace_id=knowledge_base.workspace_id,
        name=knowledge_base.name,
        slug=knowledge_base.slug,
        description=knowledge_base.description,
        retrieval_profile_id=knowledge_base.retrieval_profile_id,
        retrieval_profile_name=retrieval_profile_name,
        publication_status=knowledge_base.publication_status,
        created_at=knowledge_base.created_at,
        updated_at=knowledge_base.updated_at,
    )
