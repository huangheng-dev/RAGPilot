from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from opentelemetry import trace


_SAFE_EXTRA_FIELDS = {
    "event",
    "operation",
    "tenant_id",
    "workspace_id",
    "knowledge_base_id",
    "resource_type",
    "resource_id",
    "status",
    "status_code",
    "duration_ms",
    "attempt",
    "error_type",
}


class JsonLogFormatter(logging.Formatter):
    def __init__(self, *, service_name: str, environment: str) -> None:
        super().__init__()
        self.service_name = service_name
        self.environment = environment

    def format(self, record: logging.LogRecord) -> str:
        span_context = trace.get_current_span().get_span_context()
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "severity": record.levelname,
            "service": self.service_name,
            "environment": self.environment,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if span_context.is_valid:
            payload["trace_id"] = f"{span_context.trace_id:032x}"
            payload["span_id"] = f"{span_context.span_id:016x}"
            payload["trace_sampled"] = span_context.trace_flags.sampled
        for field in _SAFE_EXTRA_FIELDS:
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        if record.exc_info:
            payload["error_type"] = record.exc_info[0].__name__
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_structured_logging(*, service_name: str, environment: str) -> None:
    root_logger = logging.getLogger()
    for handler in root_logger.handlers:
        if getattr(handler, "ragpilot_structured", False):
            handler.setFormatter(JsonLogFormatter(service_name=service_name, environment=environment))
            return
    handler = logging.StreamHandler(sys.stdout)
    handler.ragpilot_structured = True  # type: ignore[attr-defined]
    handler.setFormatter(JsonLogFormatter(service_name=service_name, environment=environment))
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)


def configure_otel_log_export(*, endpoint: str, resource) -> None:
    root_logger = logging.getLogger()
    if any(getattr(handler, "ragpilot_otel", False) for handler in root_logger.handlers):
        return
    from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
    from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
    from opentelemetry.sdk._logs.export import BatchLogRecordProcessor

    provider = LoggerProvider(resource=resource)
    provider.add_log_record_processor(
        BatchLogRecordProcessor(OTLPLogExporter(endpoint=endpoint, insecure=True))
    )
    handler = LoggingHandler(level=logging.INFO, logger_provider=provider)
    handler.ragpilot_otel = True  # type: ignore[attr-defined]
    root_logger.addHandler(handler)
