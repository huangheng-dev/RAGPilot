FROM python:3.11-slim

WORKDIR /app

COPY apps/worker /app

RUN pip install --no-cache-dir -e .

CMD ["python", "-m", "ragpilot_worker.main"]
