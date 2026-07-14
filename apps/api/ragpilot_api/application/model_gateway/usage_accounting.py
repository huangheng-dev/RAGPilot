from __future__ import annotations

from typing import Any


def account_model_usage(usage_json: dict[str, Any], *, latency_ms: float,
                        input_cost_per_1k_tokens_usd: float,
                        output_cost_per_1k_tokens_usd: float) -> dict[str, Any]:
    raw = usage_json.get("usage") if isinstance(usage_json.get("usage"), dict) else usage_json
    input_tokens = _read_int(raw, "prompt_tokens", "input_tokens", "prompt_eval_count")
    output_tokens = _read_int(raw, "completion_tokens", "output_tokens", "eval_count")
    total_tokens = _read_int(raw, "total_tokens") or input_tokens + output_tokens
    estimated_cost = round(
        input_tokens / 1000 * max(input_cost_per_1k_tokens_usd, 0)
        + output_tokens / 1000 * max(output_cost_per_1k_tokens_usd, 0),
        8,
    )
    return {
        **usage_json,
        "accounting": {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "latency_ms": round(max(latency_ms, 0), 2),
            "estimated_cost_usd": estimated_cost,
            "currency": "USD",
        },
    }


def _read_int(payload: dict[str, Any], *keys: str) -> int:
    for key in keys:
        if key not in payload or payload.get(key) is None:
            continue
        try:
            return max(int(payload.get(key) or 0), 0)
        except (TypeError, ValueError):
            continue
    return 0
