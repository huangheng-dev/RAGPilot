FROM python:3.11-slim@sha256:f9fa7f851e38bfb19c9de3afbc4b86ae7176ea7aaf94535c31df5458d5849457

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY apps/api/requirements-core.lock apps/api/requirements-agent.lock apps/api/requirements.lock /app/
ARG API_OPTIONAL_EXTRAS=""
RUN case "$API_OPTIONAL_EXTRAS" in \
      "") lock_file=requirements-core.lock ;; \
      "agent-langgraph") lock_file=requirements-agent.lock ;; \
      "retrieval-llamaindex,agent-langgraph"|"agent-langgraph,retrieval-llamaindex") \
        lock_file=requirements.lock ;; \
      *) echo "Unsupported API_OPTIONAL_EXTRAS profile: $API_OPTIONAL_EXTRAS" >&2; exit 2 ;; \
    esac && python -m pip install --no-cache-dir --requirement "/app/$lock_file"

COPY apps/api /app
RUN python -m pip install --no-cache-dir --no-deps -e .

RUN useradd --create-home --shell /usr/sbin/nologin ragpilot && chown -R ragpilot:ragpilot /app
USER ragpilot
EXPOSE 8000
CMD ["uvicorn", "ragpilot_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
