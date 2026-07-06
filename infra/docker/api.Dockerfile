FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

COPY apps/api /app

ARG API_OPTIONAL_EXTRAS=""

RUN if [ -n "$API_OPTIONAL_EXTRAS" ]; then \
      pip install --no-cache-dir -e ".[${API_OPTIONAL_EXTRAS}]"; \
    else \
      pip install --no-cache-dir -e .; \
    fi

RUN useradd --create-home --shell /usr/sbin/nologin ragpilot && chown -R ragpilot:ragpilot /app

USER ragpilot

EXPOSE 8000

CMD ["uvicorn", "ragpilot_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
