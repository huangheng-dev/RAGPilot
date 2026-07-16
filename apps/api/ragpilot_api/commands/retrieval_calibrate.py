from __future__ import annotations

import argparse, asyncio, json
from pathlib import Path
from uuid import UUID

from ragpilot_api.application.retrieval.fusion_calibrator import calibrate_fusion
from ragpilot_api.infrastructure.database.repositories.retrieval_repository import RetrievalRepository
from ragpilot_api.infrastructure.database.session import async_session_factory
from ragpilot_api.infrastructure.embeddings import build_deterministic_embedding, format_vector_literal
from ragpilot_api.infrastructure.search.elasticsearch_retrieval_repository import ElasticsearchRetrievalRepository
from ragpilot_api.shared.settings import get_settings


async def run(dataset: dict) -> dict:
    settings = get_settings()
    cases = []
    async with async_session_factory() as session:
        pg = RetrievalRepository(session)
        es = ElasticsearchRetrievalRepository(base_url=settings.elasticsearch_url, read_alias=f"{settings.elasticsearch_index_prefix}-read", timeout_seconds=settings.elasticsearch_request_timeout_seconds)
        for case in dataset["cases"]:
            tenant_id, kb_id = UUID(case["tenant_id"]), UUID(case["knowledge_base_id"])
            vector = await pg.search_vector_document_chunks(tenant_id=tenant_id, knowledge_base_id=kb_id, query_embedding=format_vector_literal(build_deterministic_embedding(text=case["query"], dimension=settings.retrieval_embedding_dimension)), embedding_model=settings.retrieval_embedding_model, top_k=12)
            lexical = await es.search_lexical_document_chunks(tenant_id=tenant_id, knowledge_base_id=kb_id, query_text=case["query"], top_k=12)
            cases.append({**case, "vector_rows": vector, "lexical_rows": lexical})
    return calibrate_fusion(cases=cases, top_k=dataset["top_k"], weight_grid=[.3, .4, .5, .6, .65, .7, .8], bonus_grid=[0, .05, .08, .1], current=(.65, .08))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset", type=Path); parser.add_argument("--output", type=Path)
    args = parser.parse_args(); dataset = json.loads(args.dataset.read_text(encoding="utf-8"))
    report = asyncio.run(run(dataset)); rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output: args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__": main()
