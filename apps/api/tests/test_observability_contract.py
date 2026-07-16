import json
import logging

from opentelemetry import trace
from opentelemetry.trace import NonRecordingSpan, SpanContext, TraceFlags

from ragpilot_api.infrastructure.observability import inject_trace_headers
from ragpilot_api.infrastructure.structured_logging import JsonLogFormatter


def test_structured_log_contains_active_trace_without_sensitive_payload_fields() -> None:
    span_context = SpanContext(
        trace_id=0x1234,
        span_id=0x5678,
        is_remote=False,
        trace_flags=TraceFlags(TraceFlags.SAMPLED),
    )
    formatter = JsonLogFormatter(service_name="ragpilot-api", environment="test")
    record = logging.LogRecord("ragpilot.test", logging.INFO, __file__, 1, "completed", (), None)
    record.operation = "model.chat"
    record.prompt = "must-not-export"
    with trace.use_span(NonRecordingSpan(span_context), end_on_exit=False):
        payload = json.loads(formatter.format(record))

    assert payload["trace_id"] == f"{span_context.trace_id:032x}"
    assert payload["span_id"] == f"{span_context.span_id:016x}"
    assert payload["operation"] == "model.chat"
    assert "prompt" not in payload


def test_outbound_trace_headers_preserve_existing_headers() -> None:
    span_context = SpanContext(
        trace_id=0x1234,
        span_id=0x5678,
        is_remote=False,
        trace_flags=TraceFlags(TraceFlags.SAMPLED),
    )
    with trace.use_span(NonRecordingSpan(span_context), end_on_exit=False):
        headers = inject_trace_headers({"Accept": "application/json"})

    assert headers["Accept"] == "application/json"
    assert headers["traceparent"] == f"00-{span_context.trace_id:032x}-{span_context.span_id:016x}-01"
