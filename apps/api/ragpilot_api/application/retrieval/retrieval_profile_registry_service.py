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
from ragpilot_api.application.system.runtime_readiness import build_runtime_readiness_snapshot


class RetrievalProfileRegistryService:
    def __init__(self, retrieval_profile_repository: RetrievalProfileRepository) -> None:
        self.retrieval_profile_repository = retrieval_profile_repository

    async def create_retrieval_profile(self, request: RetrievalProfileCreateRequest) -> RetrievalProfileResponse:
        validate_retrieval_engine_policy(
            engine_name=request.engine_name,
            engine_version=request.engine_version,
            is_enabled=request.is_enabled,
        )
        retrieval_profile = await self.retrieval_profile_repository.create_retrieval_profile(
            name=request.name,
            slug=request.slug,
            retrieval_mode=request.retrieval_mode,
            engine_name=request.engine_name,
            engine_version=request.engine_version,
            top_k=request.top_k,
            vector_weight=Decimal(str(request.vector_weight)),
            lexical_weight=Decimal(str(request.lexical_weight)),
            hybrid_overlap_bonus=Decimal(str(request.hybrid_overlap_bonus)),
            llamaindex_similarity_cutoff=Decimal(str(request.llamaindex_similarity_cutoff)),
            llamaindex_long_context_reorder_enabled=request.llamaindex_long_context_reorder_enabled,
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
        existing_retrieval_profile = await self.retrieval_profile_repository.get_retrieval_profile(
            retrieval_profile_id=retrieval_profile_id
        )
        if existing_retrieval_profile is None:
            return None
        engine_name = request.engine_name or getattr(existing_retrieval_profile, "engine_name", "native")
        engine_version = request.engine_version or getattr(
            existing_retrieval_profile, "engine_version", "native_v1"
        )
        llamaindex_similarity_cutoff = (
            request.llamaindex_similarity_cutoff
            if request.llamaindex_similarity_cutoff is not None
            else float(getattr(existing_retrieval_profile, "llamaindex_similarity_cutoff", 0.0))
        )
        llamaindex_long_context_reorder_enabled = (
            request.llamaindex_long_context_reorder_enabled
            if request.llamaindex_long_context_reorder_enabled is not None
            else bool(
                getattr(
                    existing_retrieval_profile,
                    "llamaindex_long_context_reorder_enabled",
                    True,
                )
            )
        )
        validate_retrieval_engine_policy(
            engine_name=engine_name,
            engine_version=engine_version,
            is_enabled=request.is_enabled,
        )
        retrieval_profile = await self.retrieval_profile_repository.update_retrieval_profile(
            retrieval_profile_id=retrieval_profile_id,
            name=request.name,
            slug=request.slug,
            retrieval_mode=request.retrieval_mode,
            engine_name=engine_name,
            engine_version=engine_version,
            top_k=request.top_k,
            vector_weight=Decimal(str(request.vector_weight)),
            lexical_weight=Decimal(str(request.lexical_weight)),
            hybrid_overlap_bonus=Decimal(str(request.hybrid_overlap_bonus)),
            llamaindex_similarity_cutoff=Decimal(str(llamaindex_similarity_cutoff)),
            llamaindex_long_context_reorder_enabled=llamaindex_long_context_reorder_enabled,
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

        validate_retrieval_engine_policy(
            engine_name=getattr(retrieval_profile, "engine_name", "native"),
            engine_version=getattr(retrieval_profile, "engine_version", "native_v1"),
            is_enabled=next_is_enabled,
        )

        updated_retrieval_profile = await self.retrieval_profile_repository.update_retrieval_profile(
            retrieval_profile_id=retrieval_profile_id,
            name=retrieval_profile.name,
            slug=retrieval_profile.slug,
            retrieval_mode=retrieval_profile.retrieval_mode,
            engine_name=getattr(retrieval_profile, "engine_name", "native"),
            engine_version=getattr(retrieval_profile, "engine_version", "native_v1"),
            top_k=retrieval_profile.top_k,
            vector_weight=retrieval_profile.vector_weight,
            lexical_weight=retrieval_profile.lexical_weight,
            hybrid_overlap_bonus=retrieval_profile.hybrid_overlap_bonus,
            llamaindex_similarity_cutoff=getattr(
                retrieval_profile, "llamaindex_similarity_cutoff", Decimal("0")
            ),
            llamaindex_long_context_reorder_enabled=getattr(
                retrieval_profile, "llamaindex_long_context_reorder_enabled", True
            ),
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
    engine_name = getattr(retrieval_profile, "engine_name", "native")
    runtime_ready = (
        engine_name != "llamaindex_pilot"
        or build_runtime_readiness_snapshot().llamaindex_pilot_ready
    )
    return RetrievalProfileResponse(
        id=retrieval_profile.id,
        name=retrieval_profile.name,
        slug=retrieval_profile.slug,
        retrieval_mode=retrieval_profile.retrieval_mode,
        engine_name=engine_name,
        engine_version=getattr(retrieval_profile, "engine_version", "native_v1"),
        runtime_ready=runtime_ready,
        runtime_issue=None if runtime_ready else "engine_unavailable",
        top_k=retrieval_profile.top_k,
        vector_weight=float(retrieval_profile.vector_weight),
        lexical_weight=float(retrieval_profile.lexical_weight),
        hybrid_overlap_bonus=float(retrieval_profile.hybrid_overlap_bonus),
        llamaindex_similarity_cutoff=float(
            getattr(retrieval_profile, "llamaindex_similarity_cutoff", 0.0)
        ),
        llamaindex_long_context_reorder_enabled=bool(
            getattr(retrieval_profile, "llamaindex_long_context_reorder_enabled", True)
        ),
        is_enabled=retrieval_profile.is_enabled,
        is_default=retrieval_profile.is_default,
        notes=retrieval_profile.notes,
        bound_knowledge_base_count=bound_knowledge_base_count,
        created_at=retrieval_profile.created_at,
        updated_at=retrieval_profile.updated_at,
    )


def validate_retrieval_engine_policy(
    *, engine_name: str, engine_version: str, is_enabled: bool
) -> None:
    supported_versions = {
        "native": "native_v1",
        "llamaindex_pilot": "llamaindex_authorized_context_v1",
    }
    expected_version = supported_versions.get(engine_name)
    if expected_version is None or engine_version != expected_version:
        raise ResourceConflictError(
            f"Retrieval engine '{engine_name}' requires engine version "
            f"'{expected_version or 'a supported version'}'."
        )
    if (
        engine_name == "llamaindex_pilot"
        and is_enabled
        and not build_runtime_readiness_snapshot().llamaindex_pilot_ready
    ):
        raise ResourceConflictError(
            "Install the LlamaIndex retrieval deployment profile before enabling this policy."
        )
