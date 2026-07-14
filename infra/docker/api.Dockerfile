FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
COPY apps/api/pyproject.toml apps/api/README.md /app/

ARG API_OPTIONAL_EXTRAS=""

RUN mkdir -p ragpilot_api && touch ragpilot_api/__init__.py && if [ -n "$API_OPTIONAL_EXTRAS" ]; then \
      pip install --no-cache-dir -e ".[${API_OPTIONAL_EXTRAS}]"; \
    else \
      pip install --no-cache-dir -e .; \
    fi

COPY apps/api /app
RUN pip install --no-cache-dir --no-deps -e .

RUN useradd --create-home --shell /usr/sbin/nologin ragpilot && chown -R ragpilot:ragpilot /app

USER ragpilot

EXPOSE 8000

CMD ["uvicorn", "ragpilot_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
