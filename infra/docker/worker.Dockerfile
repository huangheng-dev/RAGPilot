FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

COPY apps/worker /app

RUN pip install --no-cache-dir -e .

RUN useradd --create-home --shell /usr/sbin/nologin ragpilot && chown -R ragpilot:ragpilot /app

USER ragpilot

CMD ["python", "-m", "ragpilot_worker.main"]
