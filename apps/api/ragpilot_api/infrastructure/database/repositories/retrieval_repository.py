from __future__ import annotations

from uuid import UUID

from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession
from ragpilot_api.infrastructure.observability import traced


ACL_PREDICATE = """
AND (
    CAST(:acl_bypass AS boolean)
    OR (
        (
            COALESCE(documents.access_scope, 'tenant') = 'tenant'
            OR (
                CAST(:principal_user_id AS uuid) IS NOT NULL
                AND EXISTS (
                    SELECT 1
                    FROM document_access_grants
                    LEFT JOIN access_group_memberships
                      ON access_group_memberships.group_id = document_access_grants.group_id
                     AND access_group_memberships.tenant_id = document_access_grants.tenant_id
                     AND access_group_memberships.user_id = CAST(:principal_user_id AS uuid)
                    WHERE document_access_grants.document_id = documents.id
                      AND document_access_grants.tenant_id = :tenant_id
                      AND document_access_grants.permission = 'read'
                      AND (
                          document_access_grants.user_id = CAST(:principal_user_id AS uuid)
                          OR access_group_memberships.user_id IS NOT NULL
                      )
                )
            )
        )
        AND (
            COALESCE(document_chunks.access_scope, 'inherit') = 'inherit'
            OR (
                CAST(:principal_user_id AS uuid) IS NOT NULL
                AND EXISTS (
                    SELECT 1
                    FROM document_chunk_access_grants
                    LEFT JOIN access_group_memberships
                      ON access_group_memberships.group_id = document_chunk_access_grants.group_id
                     AND access_group_memberships.tenant_id = document_chunk_access_grants.tenant_id
                     AND access_group_memberships.user_id = CAST(:principal_user_id AS uuid)
                    WHERE document_chunk_access_grants.document_chunk_id = document_chunks.id
                      AND document_chunk_access_grants.tenant_id = :tenant_id
                      AND document_chunk_access_grants.permission = 'read'
                      AND (
                          document_chunk_access_grants.user_id = CAST(:principal_user_id AS uuid)
                          OR access_group_memberships.user_id IS NOT NULL
                      )
                )
            )
        )
    )
)
"""


class RetrievalRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @traced("retrieval.acl.authorize_candidates")
    async def filter_authorized_document_chunk_ids(
        self, *, tenant_id: UUID, knowledge_base_id: UUID, document_chunk_ids: list[UUID],
        principal_user_id: UUID | None = None, acl_bypass: bool = False,
    ) -> set[UUID]:
        if not document_chunk_ids:
            return set()
        statement = text(
            f"""
            SELECT document_chunks.id
            FROM document_chunks
            JOIN document_versions ON document_versions.id = document_chunks.document_version_id
            JOIN documents ON documents.id = document_versions.document_id
            WHERE document_chunks.id IN :document_chunk_ids
              AND document_chunks.tenant_id = :tenant_id
              AND documents.knowledge_base_id = :knowledge_base_id
              AND documents.deleted_at IS NULL
              AND document_versions.ingestion_status = 'completed'
              {ACL_PREDICATE}
            """
        ).bindparams(bindparam("document_chunk_ids", expanding=True))
        result = await self.session.execute(statement, {
            "document_chunk_ids": document_chunk_ids,
            "tenant_id": tenant_id,
            "knowledge_base_id": knowledge_base_id,
            "principal_user_id": principal_user_id,
            "acl_bypass": acl_bypass,
        })
        return {row[0] for row in result.all()}

    @traced("retrieval.pgvector.search")
    async def search_vector_document_chunks(
        self,
        *,
        tenant_id: UUID,
        knowledge_base_id: UUID,
        query_embedding: str,
        embedding_model: str,
        top_k: int,
        principal_user_id: UUID | None = None,
        acl_bypass: bool = False,
    ) -> list[dict]:
        result = await self.session.execute(
            text(
                f"""
                WITH latest_completed_versions AS (
                    SELECT
                        document_versions.document_id,
                        MAX(document_versions.version_number) AS latest_version_number
                    FROM document_versions
                    JOIN documents
                        ON documents.id = document_versions.document_id
                    WHERE documents.knowledge_base_id = :knowledge_base_id
                      AND documents.deleted_at IS NULL
                      AND document_versions.ingestion_status = 'completed'
                    GROUP BY document_versions.document_id
                )
                SELECT
                    document_chunks.id AS document_chunk_id,
                    documents.id AS document_id,
                    document_versions.id AS document_version_id,
                    documents.knowledge_base_id,
                    documents.title AS document_title,
                    document_chunks.chunk_index,
                    document_chunks.content,
                    document_chunks.token_count,
                    document_chunks.metadata_json,
                    document_chunks.created_at,
                    document_chunk_embeddings.embedding_model,
                    1 - (document_chunk_embeddings.embedding <=> CAST(:query_embedding AS vector)) AS score
                FROM document_chunk_embeddings
                JOIN document_chunks
                    ON document_chunks.id = document_chunk_embeddings.document_chunk_id
                JOIN document_versions
                    ON document_versions.id = document_chunks.document_version_id
                JOIN latest_completed_versions
                    ON latest_completed_versions.document_id = document_versions.document_id
                   AND latest_completed_versions.latest_version_number = document_versions.version_number
                JOIN documents
                    ON documents.id = document_versions.document_id
                WHERE document_chunk_embeddings.tenant_id = :tenant_id
                  AND documents.knowledge_base_id = :knowledge_base_id
                  AND documents.deleted_at IS NULL
                  AND document_chunk_embeddings.embedding_model = :embedding_model
                  {ACL_PREDICATE}
                ORDER BY document_chunk_embeddings.embedding <=> CAST(:query_embedding AS vector)
                LIMIT :top_k
                """
            ),
            {
                "tenant_id": tenant_id,
                "knowledge_base_id": knowledge_base_id,
                "query_embedding": query_embedding,
                "embedding_model": embedding_model,
                "top_k": top_k,
                "principal_user_id": principal_user_id,
                "acl_bypass": acl_bypass,
            },
        )
        return [dict(row) for row in result.mappings().all()]

    @traced("retrieval.postgresql_lexical.search")
    async def search_lexical_document_chunks(
        self,
        *,
        tenant_id: UUID,
        knowledge_base_id: UUID,
        normalized_query: str,
        query_terms_text: str,
        top_k: int,
        principal_user_id: UUID | None = None,
        acl_bypass: bool = False,
    ) -> list[dict]:
        result = await self.session.execute(
            text(
                f"""
                WITH latest_completed_versions AS (
                    SELECT
                        document_versions.document_id,
                        MAX(document_versions.version_number) AS latest_version_number
                    FROM document_versions
                    JOIN documents
                        ON documents.id = document_versions.document_id
                    WHERE documents.knowledge_base_id = :knowledge_base_id
                      AND documents.deleted_at IS NULL
                      AND document_versions.ingestion_status = 'completed'
                    GROUP BY document_versions.document_id
                ),
                lexical_candidates AS (
                    SELECT
                        document_chunks.id AS document_chunk_id,
                        documents.id AS document_id,
                        document_versions.id AS document_version_id,
                        documents.knowledge_base_id,
                        documents.title AS document_title,
                        document_chunks.chunk_index,
                        document_chunks.content,
                        document_chunks.token_count,
                        document_chunks.metadata_json,
                        document_chunks.created_at,
                        LOWER(documents.title) AS title_text,
                        LOWER(documents.title || ' ' || document_chunks.content) AS search_text
                    FROM document_chunks
                    JOIN document_versions
                        ON document_versions.id = document_chunks.document_version_id
                    JOIN latest_completed_versions
                        ON latest_completed_versions.document_id = document_versions.document_id
                       AND latest_completed_versions.latest_version_number = document_versions.version_number
                    JOIN documents
                        ON documents.id = document_versions.document_id
                    WHERE document_chunks.tenant_id = :tenant_id
                      AND documents.knowledge_base_id = :knowledge_base_id
                      AND documents.deleted_at IS NULL
                      {ACL_PREDICATE}
                )
                SELECT
                    lexical_candidates.document_chunk_id,
                    lexical_candidates.document_id,
                    lexical_candidates.document_version_id,
                    lexical_candidates.knowledge_base_id,
                    lexical_candidates.document_title,
                    lexical_candidates.chunk_index,
                    lexical_candidates.content,
                    lexical_candidates.token_count,
                    lexical_candidates.metadata_json,
                    lexical_candidates.created_at,
                    NULL::varchar AS embedding_model,
                    (
                        CASE
                            WHEN lexical_candidates.title_text LIKE '%%' || :normalized_query || '%%' THEN 5
                            ELSE 0
                        END
                        + CASE
                            WHEN lexical_candidates.search_text LIKE '%%' || :normalized_query || '%%' THEN 4
                            ELSE 0
                        END
                        + COALESCE(
                            (
                                SELECT COUNT(*) * 2
                                FROM regexp_split_to_table(:query_terms_text, E'[[:space:]]+') AS term
                                WHERE CHAR_LENGTH(term) >= 2
                                  AND lexical_candidates.title_text LIKE '%%' || term || '%%'
                            ),
                            0
                        )
                        + COALESCE(
                            (
                                SELECT COUNT(*)
                                FROM regexp_split_to_table(:query_terms_text, E'[[:space:]]+') AS term
                                WHERE CHAR_LENGTH(term) >= 2
                                  AND lexical_candidates.search_text LIKE '%%' || term || '%%'
                            ),
                            0
                        )
                    )::float AS lexical_score
                FROM lexical_candidates
                WHERE lexical_candidates.title_text LIKE '%%' || :normalized_query || '%%'
                   OR lexical_candidates.search_text LIKE '%%' || :normalized_query || '%%'
                   OR EXISTS (
                        SELECT 1
                        FROM regexp_split_to_table(:query_terms_text, E'[[:space:]]+') AS term
                        WHERE CHAR_LENGTH(term) >= 2
                          AND (
                              lexical_candidates.title_text LIKE '%%' || term || '%%'
                              OR lexical_candidates.search_text LIKE '%%' || term || '%%'
                          )
                   )
                ORDER BY lexical_score DESC, lexical_candidates.chunk_index ASC, CHAR_LENGTH(lexical_candidates.content) ASC
                LIMIT :top_k
                """
            ),
            {
                "tenant_id": tenant_id,
                "knowledge_base_id": knowledge_base_id,
                "normalized_query": normalized_query,
                "query_terms_text": query_terms_text,
                "top_k": top_k,
                "principal_user_id": principal_user_id,
                "acl_bypass": acl_bypass,
            },
        )
        return [dict(row) for row in result.mappings().all()]
