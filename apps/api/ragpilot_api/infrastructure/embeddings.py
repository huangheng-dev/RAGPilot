from __future__ import annotations

import hashlib
import math
import re


def build_deterministic_embedding(*, text: str, dimension: int) -> list[float]:
    tokens = re.findall(r"\w+|[^\w\s]", text.lower())
    vector = [0.0] * dimension

    if not tokens:
        vector[0] = 1.0
        return vector

    for index, token in enumerate(tokens):
        digest = hashlib.sha256(f"{index}:{token}".encode("utf-8")).digest()
        primary_bucket = int.from_bytes(digest[:4], "big") % dimension
        secondary_bucket = int.from_bytes(digest[4:8], "big") % dimension
        primary_sign = 1.0 if digest[8] % 2 == 0 else -1.0
        secondary_sign = 1.0 if digest[9] % 2 == 0 else -1.0
        weight = 1.0 + min(len(token), 24) / 24.0

        vector[primary_bucket] += primary_sign * weight
        vector[secondary_bucket] += secondary_sign * (weight / 2.0)

    magnitude = math.sqrt(sum(value * value for value in vector))
    if magnitude == 0:
        vector[0] = 1.0
        return vector

    return [value / magnitude for value in vector]


def format_vector_literal(values: list[float]) -> str:
    return "[" + ",".join(f"{value:.12f}" for value in values) + "]"
