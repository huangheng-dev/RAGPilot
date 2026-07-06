from decimal import Decimal
from uuid import UUID

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.contracts.http.retrieval_profile_contracts import (
    RetrievalProfileGovernanceActionResponse,
    RetrievalProfileCreateRequest,
    RetrievalProfileResponse,
    RetrievalProfileUpdateRequest,
)
from ragpilot_api.infrastructure.database.models import RetrievalProfile
from ragpilot_api.infrastructure.database.repositories.retrieval_profile_repository import RetrievalProfileRepository


class RetrievalProfileRegistryService:
    def __init__(self, retrieval_profile_repository: RetrievalProfileRepository) -> None:
        self.retrieval_profile_repository = retrieval_profile_repository

    async def create_retrieval_profile(self, request: RetrievalProfileCreateRequest) -> RetrievalProfileResponse:
        retrieval_profile = await self.retrieval_profile_repository.create_retrieval_profile(
            name=request.name,
            slug=request.slug,
            retrieval_mode=request.retrieval_mode,
            top_k=request.top_k,
            vector_weight=Decimal(str(request.vector_weight)),
            lexical_weight=Decimal(str(request.lexical_weight)),
            hybrid_overlap_bonus=Decimal(str(request.hybrid_overlap_bonus)),
            is_enabled=request.is_enabled,
            is_default=request.is_default,
            notes=request.notes,
        )
        return build_retrieval_profile_response(retrieval_profile)

    async def list_retrieval_profiles(
        self,
        *,
        retrieval_mode: str | None = None,
        is_enabled: bool | None = None,
        query: str | None = None,
    ) -> list[RetrievalProfileResponse]:
        retrieval_profiles = await self.retrieval_profile_repository.list_retrieval_profiles(
            retrieval_mode=retrieval_mode,
            is_enabled=is_enabled,
            query=query,
        )
        binding_counts = await self.retrieval_profile_repository.list_retrieval_profile_binding_counts()
        return [
            build_retrieval_profile_response(
                retrieval_profile,
                bound_knowledge_base_count=binding_counts.get(str(retrieval_profile.id), 0),
            )
            for retrieval_profile in retrieval_profiles
        ]

    async def update_retrieval_profile(
        self,
        *,
        retrieval_profile_id: UUID,
        request: RetrievalProfileUpdateRequest,
    ) -> RetrievalProfileResponse | None:
        retrieval_profile = await self.retrieval_profile_repository.update_retrieval_profile(
            retrieval_profile_id=retrieval_profile_id,
            name=request.name,
            slug=request.slug,
            retrieval_mode=request.retrieval_mode,
            top_k=request.top_k,
            vector_weight=Decimal(str(request.vector_weight)),
            lexical_weight=Decimal(str(request.lexical_weight)),
            hybrid_overlap_bonus=Decimal(str(request.hybrid_overlap_bonus)),
            is_enabled=request.is_enabled,
            is_default=request.is_default,
            notes=request.notes,
        )
        if retrieval_profile is None:
            return None
        bound_knowledge_base_count = await self.retrieval_profile_repository.count_knowledge_bases_using_retrieval_profile(
            retrieval_profile_id=retrieval_profile.id
        )
        return build_retrieval_profile_response(
            retrieval_profile,
            bound_knowledge_base_count=bound_knowledge_base_count,
        )

    async def delete_retrieval_profile(self, *, retrieval_profile_id: UUID) -> bool:
        bound_knowledge_base_count = await self.retrieval_profile_repository.count_knowledge_bases_using_retrieval_profile(
            retrieval_profile_id=retrieval_profile_id
        )
        if bound_knowledge_base_count > 0:
            noun = "knowledge base" if bound_knowledge_base_count == 1 else "knowledge bases"
            raise ResourceConflictError(
                f"Retrieval profile is still assigned to {bound_knowledge_base_count} {noun}. Reassign those knowledge bases before deleting it."
            )
        return await self.retrieval_profile_repository.delete_retrieval_profile(
            retrieval_profile_id=retrieval_profile_id
        )

    async def apply_retrieval_profile_governance_action(
        self,
        *,
        retrieval_profile_id: UUID,
        action_type: str,
    ) -> RetrievalProfileGovernanceActionResponse | None:
        retrieval_profile = await self.retrieval_profile_repository.get_retrieval_profile(
            retrieval_profile_id=retrieval_profile_id
        )
        if retrieval_profile is None:
            return None

        if action_type == "enable_profile":
            next_is_enabled = True
            next_is_default = retrieval_profile.is_default
            summary = (
                "Retrieval profile enabled for governed retrieval use."
                if not retrieval_profile.is_enabled
                else "Retrieval profile is already enabled."
            )
        elif action_type == "disable_profile":
            next_is_enabled = False
            next_is_default = retrieval_profile.is_default
            summary = (
                "Retrieval profile disabled until retrieval governance follow-up is complete."
                if retrieval_profile.is_enabled
                else "Retrieval profile is already disabled."
            )
        elif action_type == "promote_default":
            if not retrieval_profile.is_enabled:
                raise ResourceConflictError("Enable the retrieval profile before promoting it as the governed default.")
            next_is_enabled = retrieval_profile.is_enabled
            next_is_default = True
            summary = (
                "Retrieval profile promoted as the governed default."
                if not retrieval_profile.is_default
                else "Retrieval profile is already the governed default."
            )
        else:
            raise ResourceConflictError("Unsupported retrieval profile governance action.")

        updated_retrieval_profile = await self.retrieval_profile_repository.update_retrieval_profile(
            retrieval_profile_id=retrieval_profile_id,
            name=retrieval_profile.name,
            slug=retrieval_profile.slug,
            retrieval_mode=retrieval_profile.retrieval_mode,
            top_k=retrieval_profile.top_k,
            vector_weight=retrieval_profile.vector_weight,
            lexical_weight=retrieval_profile.lexical_weight,
            hybrid_overlap_bonus=retrieval_profile.hybrid_overlap_bonus,
            is_enabled=next_is_enabled,
            is_default=next_is_default,
            notes=retrieval_profile.notes,
        )
        if updated_retrieval_profile is None:
            return None

        bound_knowledge_base_count = await self.retrieval_profile_repository.count_knowledge_bases_using_retrieval_profile(
            retrieval_profile_id=updated_retrieval_profile.id
        )
        return RetrievalProfileGovernanceActionResponse(
            action_type=action_type,
            summary=summary,
            retrieval_profile=build_retrieval_profile_response(
                updated_retrieval_profile,
                bound_knowledge_base_count=bound_knowledge_base_count,
            ),
        )


def build_retrieval_profile_response(
    retrieval_profile: RetrievalProfile,
    *,
    bound_knowledge_base_count: int = 0,
) -> RetrievalProfileResponse:
    return RetrievalProfileResponse(
        id=retrieval_profile.id,
        name=retrieval_profile.name,
        slug=retrieval_profile.slug,
        retrieval_mode=retrieval_profile.retrieval_mode,
        top_k=retrieval_profile.top_k,
        vector_weight=float(retrieval_profile.vector_weight),
        lexical_weight=float(retrieval_profile.lexical_weight),
        hybrid_overlap_bonus=float(retrieval_profile.hybrid_overlap_bonus),
        is_enabled=retrieval_profile.is_enabled,
        is_default=retrieval_profile.is_default,
        notes=retrieval_profile.notes,
        bound_knowledge_base_count=bound_knowledge_base_count,
        created_at=retrieval_profile.created_at,
        updated_at=retrieval_profile.updated_at,
    )
