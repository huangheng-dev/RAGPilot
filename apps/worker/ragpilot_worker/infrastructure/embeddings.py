from __future__ import annotations

import hashlib
import math
import re
from dataclasses import dataclass
from typing import Protocol

import httpx

from ragpilot_worker.config import WorkerSettings
from ragpilot_worker.infrastructure.observability import inject_trace_headers


class EmbeddingProvider(Protocol):
    model_name: str
    dimension: int

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        ...


@dataclass(frozen=True)
class DeterministicEmbeddingProvider:
    model_name: str
    dimension: int

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_text(text) for text in texts]

    def _embed_text(self, text: str) -> list[float]:
        tokens = re.findall(r"\w+|[^\w\s]", text.lower())
        vector = [0.0] * self.dimension

        if not tokens:
            vector[0] = 1.0
            return vector

        for index, token in enumerate(tokens):
            digest = hashlib.sha256(f"{index}:{token}".encode("utf-8")).digest()
            primary_bucket = int.from_bytes(digest[:4], "big") % self.dimension
            secondary_bucket = int.from_bytes(digest[4:8], "big") % self.dimension
            sign = 1.0 if digest[8] % 2 == 0 else -1.0
            secondary_sign = 1.0 if digest[9] % 2 == 0 else -1.0
            weight = 1.0 + min(len(token), 24) / 24.0

            vector[primary_bucket] += sign * weight
            vector[secondary_bucket] += secondary_sign * (weight / 2.0)

        magnitude = math.sqrt(sum(value * value for value in vector))
        if magnitude == 0:
            vector[0] = 1.0
            return vector

        return [value / magnitude for value in vector]


class OpenAICompatibleEmbeddingProvider:
    def __init__(
        self,
        *,
        model_name: str,
        dimension: int,
        api_base_url: str,
        api_key: str | None,
        request_timeout_seconds: int,
    ) -> None:
        self.model_name = model_name
        self.dimension = dimension
        self.api_base_url = api_base_url.rstrip("/")
        self.api_key = api_key
        self.request_timeout_seconds = request_timeout_seconds

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        headers = inject_trace_headers(headers)

        async with httpx.AsyncClient(timeout=self.request_timeout_seconds) as client:
            response = await client.post(
                f"{self.api_base_url}/embeddings",
                headers=headers,
                json={
                    "model": self.model_name,
                    "input": texts,
                },
            )
            response.raise_for_status()

        payload = response.json()
        items = sorted(payload.get("data", []), key=lambda item: item["index"])
        embeddings = [item["embedding"] for item in items]

        if len(embeddings) != len(texts):
            raise ValueError("Embedding provider returned an unexpected number of vectors.")

        for embedding in embeddings:
            if len(embedding) != self.dimension:
                raise ValueError(
                    f"Embedding dimension mismatch. Expected {self.dimension}, got {len(embedding)}."
                )

        return embeddings


def build_embedding_provider(settings: WorkerSettings) -> EmbeddingProvider:
    if settings.embedding_dimension != 1536:
        raise ValueError(
            "The current schema stores vectors in document_chunk_embeddings.embedding as vector(1536)."
        )

    provider_name = settings.embedding_provider.strip().lower()

    if provider_name == "deterministic":
        return DeterministicEmbeddingProvider(
            model_name=settings.embedding_model,
            dimension=settings.embedding_dimension,
        )

    if provider_name == "openai_compatible":
        if not settings.embedding_api_base_url:
            raise ValueError("EMBEDDING_API_BASE_URL is required for the openai_compatible provider.")
        return OpenAICompatibleEmbeddingProvider(
            model_name=settings.embedding_model,
            dimension=settings.embedding_dimension,
            api_base_url=settings.embedding_api_base_url,
            api_key=settings.embedding_api_key,
            request_timeout_seconds=settings.embedding_request_timeout_seconds,
        )

    raise ValueError(f"Unsupported embedding provider: {settings.embedding_provider}")
