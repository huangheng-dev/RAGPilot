FROM python:3.11-slim

WORKDIR /app

COPY apps/api /app

ARG API_OPTIONAL_EXTRAS=""

RUN if [ -n "$API_OPTIONAL_EXTRAS" ]; then \
      pip install --no-cache-dir -e ".[${API_OPTIONAL_EXTRAS}]"; \
    else \
      pip install --no-cache-dir -e .; \
    fi

EXPOSE 8000

CMD ["uvicorn", "ragpilot_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
