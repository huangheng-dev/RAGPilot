FROM python:3.11-slim@sha256:f9fa7f851e38bfb19c9de3afbc4b86ae7176ea7aaf94535c31df5458d5849457

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-eng tesseract-ocr-chi-sim \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY apps/worker/requirements.lock /app/requirements.lock
RUN python -m pip install --no-cache-dir --requirement /app/requirements.lock
COPY apps/worker /app
RUN python -m pip install --no-cache-dir --no-deps -e .

RUN useradd --create-home --shell /usr/sbin/nologin ragpilot && chown -R ragpilot:ragpilot /app
USER ragpilot
CMD ["python", "-m", "ragpilot_worker.main"]
