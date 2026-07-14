from ragpilot_api.application.model_gateway.usage_accounting import account_model_usage


def test_model_usage_accounting_normalizes_tokens_latency_and_cost() -> None:
    usage = account_model_usage(
        {"provider": "openai_compatible", "usage": {
            "prompt_tokens": 1200, "completion_tokens": 300, "total_tokens": 1500,
        }},
        latency_ms=245.678,
        input_cost_per_1k_tokens_usd=0.002,
        output_cost_per_1k_tokens_usd=0.006,
    )

    assert usage["accounting"] == {
        "input_tokens": 1200,
        "output_tokens": 300,
        "total_tokens": 1500,
        "latency_ms": 245.68,
        "estimated_cost_usd": 0.0042,
        "currency": "USD",
    }


def test_model_usage_accounting_supports_ollama_counters() -> None:
    usage = account_model_usage(
        {"usage": {"prompt_eval_count": 10, "eval_count": 5}}, latency_ms=1,
        input_cost_per_1k_tokens_usd=0, output_cost_per_1k_tokens_usd=0,
    )

    assert usage["accounting"]["total_tokens"] == 15
