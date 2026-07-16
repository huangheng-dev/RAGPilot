from __future__ import annotations

import time
import logging
from functools import wraps

from fastapi import FastAPI, Request
from opentelemetry import metrics, trace
from opentelemetry.propagate import extract, inject
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.sampling import ParentBased, TraceIdRatioBased
from opentelemetry.trace import SpanKind

from ragpilot_api.infrastructure.structured_logging import configure_otel_log_export, configure_structured_logging


_operation_meter = metrics.get_meter("ragpilot.api.operations")
_operation_calls = _operation_meter.create_counter("ragpilot.operation.calls")
_operation_errors = _operation_meter.create_counter("ragpilot.operation.errors")
_operation_duration = _operation_meter.create_histogram("ragpilot.operation.duration", unit="ms")
_model_tokens = _operation_meter.create_counter("ragpilot.model.tokens")
_logger = logging.getLogger("ragpilot.api.http")


def configure_observability(app: FastAPI, settings) -> None:
    configure_structured_logging(service_name=settings.service_name, environment=settings.environment)
    if not bool(getattr(settings, "otel_enabled", False)):
        return
    resource = Resource.create({"service.name": settings.service_name, "deployment.environment": settings.environment})
    configure_otel_log_export(endpoint=settings.otel_exporter_otlp_endpoint, resource=resource)
    tracer_provider = TracerProvider(resource=resource, sampler=ParentBased(TraceIdRatioBased(settings.otel_trace_sample_ratio)))
    tracer_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint, insecure=True)))
    trace.set_tracer_provider(tracer_provider)
    metrics.set_meter_provider(MeterProvider(resource=resource, metric_readers=[PeriodicExportingMetricReader(OTLPMetricExporter(endpoint=settings.otel_exporter_otlp_endpoint, insecure=True))]))
    meter = metrics.get_meter("ragpilot.api")
    request_count = meter.create_counter("ragpilot.http.server.requests")
    duration = meter.create_histogram("ragpilot.http.server.duration", unit="ms")

    @app.middleware("http")
    async def telemetry_middleware(request: Request, call_next):
        route = request.scope.get("route")
        route_name = getattr(route, "path", request.url.path)
        started = time.perf_counter()
        status_code = 500
        parent_context = extract(dict(request.headers))
        with trace.get_tracer("ragpilot.api").start_as_current_span(
            f"HTTP {request.method}", context=parent_context, kind=SpanKind.SERVER,
        ) as span:
            span.set_attribute("http.request.method", request.method)
            span.set_attribute("url.path", route_name)
            try:
                response = await call_next(request)
                status_code = response.status_code
            except Exception as exc:
                span.record_exception(exc)
                span.set_status(trace.Status(trace.StatusCode.ERROR))
                status_code = 500
                raise
            finally:
                attributes = {"http.request.method": request.method, "http.route": route_name, "http.response.status_code": status_code}
                request_count.add(1, attributes)
                elapsed_ms = (time.perf_counter() - started) * 1000
                duration.record(elapsed_ms, attributes)
                _logger.info(
                    "HTTP request completed",
                    extra={
                        "event": "http.request.completed",
                        "operation": f"HTTP {request.method}",
                        "status_code": status_code,
                        "duration_ms": round(elapsed_ms, 3),
                    },
                )
            span_context = span.get_span_context()
            trace_flags = int(span_context.trace_flags)
            response.headers["traceparent"] = f"00-{span_context.trace_id:032x}-{span_context.span_id:016x}-{trace_flags:02x}"
            return response


def inject_trace_headers(headers: dict[str, str] | None = None) -> dict[str, str]:
    carrier = dict(headers or {})
    inject(carrier)
    return carrier


def traced(name: str):
    def decorator(function):
        @wraps(function)
        async def wrapper(*args, **kwargs):
            started = time.perf_counter()
            attributes = {"ragpilot.operation": name}
            _operation_calls.add(1, attributes)
            with trace.get_tracer("ragpilot.api").start_as_current_span(name) as span:
                try:
                    result = await function(*args, **kwargs)
                    usage = getattr(result, "usage_json", None)
                    if isinstance(usage, dict):
                        token_count = sum(int(usage.get(key) or 0) for key in ("prompt_tokens", "completion_tokens", "input_tokens", "output_tokens", "eval_count", "prompt_eval_count"))
                        if token_count:
                            _model_tokens.add(token_count, attributes)
                    return result
                except Exception as exc:
                    _operation_errors.add(1, attributes)
                    span.record_exception(exc)
                    raise
                finally:
                    _operation_duration.record((time.perf_counter() - started) * 1000, attributes)
        return wrapper
    return decorator
