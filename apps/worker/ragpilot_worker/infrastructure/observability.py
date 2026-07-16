from contextlib import contextmanager
from functools import wraps

import time
from opentelemetry import context, metrics, trace
from temporalio import activity
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.propagate import extract, inject
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader

from ragpilot_worker.infrastructure.structured_logging import configure_otel_log_export, configure_structured_logging


_meter = metrics.get_meter("ragpilot.worker")
_activity_calls = _meter.create_counter("ragpilot.worker.activity.calls")
_activity_errors = _meter.create_counter("ragpilot.worker.activity.errors")
_activity_retries = _meter.create_counter("ragpilot.worker.activity.retries")
_activity_duration = _meter.create_histogram("ragpilot.worker.activity.duration", unit="ms")
_projection_chunks = _meter.create_counter("ragpilot.projection.chunks")


def configure_worker_observability(settings) -> None:
    configure_structured_logging(service_name="ragpilot-worker", environment=settings.environment)
    if not settings.otel_enabled:
        return
    resource = Resource.create({"service.name": "ragpilot-worker", "deployment.environment": settings.environment})
    configure_otel_log_export(endpoint=settings.otel_exporter_otlp_endpoint, resource=resource)
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint, insecure=True)))
    trace.set_tracer_provider(provider)
    metrics.set_meter_provider(MeterProvider(resource=provider.resource, metric_readers=[PeriodicExportingMetricReader(OTLPMetricExporter(endpoint=settings.otel_exporter_otlp_endpoint, insecure=True))]))


def inject_trace_headers(headers: dict[str, str] | None = None) -> dict[str, str]:
    carrier = dict(headers or {})
    inject(carrier)
    return carrier


@contextmanager
def activity_span(name: str, payload: dict):
    token = context.attach(extract(payload.get("trace_context", {})))
    try:
        with trace.get_tracer("ragpilot.worker").start_as_current_span(name) as span:
            yield span
    finally:
        context.detach(token)


def traced_activity(name: str):
    def decorator(function):
        @wraps(function)
        async def wrapper(payload):
            attrs = {"ragpilot.operation": name}
            _activity_calls.add(1, attrs)
            try:
                attempt = activity.info().attempt
            except RuntimeError:
                attempt = 1
            if attempt > 1:
                _activity_retries.add(1, attrs)
            started = time.perf_counter()
            with activity_span(name, payload) as span:
                try:
                    result = await function(payload)
                    if name == "worker.elasticsearch_projection":
                        _projection_chunks.add(int(result.get("projected_chunk_count", 0)), attrs)
                    return result
                except Exception as exc:
                    _activity_errors.add(1, attrs)
                    span.record_exception(exc)
                    raise
                finally:
                    _activity_duration.record((time.perf_counter() - started) * 1000, attrs)
        return wrapper
    return decorator
