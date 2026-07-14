FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng tesseract-ocr-chi-sim && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
COPY apps/worker/pyproject.toml apps/worker/README.md /app/
RUN mkdir -p ragpilot_worker && touch ragpilot_worker/__init__.py && pip install --no-cache-dir -e .
COPY apps/worker /app
RUN pip install --no-cache-dir --no-deps -e .

RUN useradd --create-home --shell /usr/sbin/nologin ragpilot && chown -R ragpilot:ragpilot /app

USER ragpilot

CMD ["python", "-m", "ragpilot_worker.main"]
