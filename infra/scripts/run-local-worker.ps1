$ErrorActionPreference = "Stop"

$env:TEMPORAL_ADDRESS = "localhost:7233"
$env:TEMPORAL_NAMESPACE = "default"
$env:TEMPORAL_TASK_QUEUE = "ragpilot-ingestion"
$env:TEMPORAL_CONNECT_MAX_ATTEMPTS = "30"
$env:TEMPORAL_CONNECT_RETRY_SECONDS = "5"

$env:POSTGRES_HOST = "localhost"
$env:POSTGRES_PORT = "5432"
$env:POSTGRES_DB = "ragpilot"
$env:POSTGRES_USER = "ragpilot"
$env:POSTGRES_PASSWORD = "ragpilot"

$env:MINIO_ENDPOINT = "http://localhost:9000"
$env:MINIO_ROOT_USER = "ragpilot"
$env:MINIO_ROOT_PASSWORD = "ragpilot123"
$env:MINIO_BUCKET = "ragpilot-documents"

$env:EMBEDDING_PROVIDER = "deterministic"
$env:EMBEDDING_MODEL = "ragpilot-dev-1536"
$env:EMBEDDING_DIMENSION = "1536"

Set-Location "$PSScriptRoot\..\..\apps\worker"
.\.venv\Scripts\python.exe -m pip install -e . | Out-Null
.\.venv\Scripts\python.exe -m ragpilot_worker.main
