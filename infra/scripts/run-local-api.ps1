$ErrorActionPreference = "Stop"

$env:POSTGRES_HOST = "localhost"
$env:POSTGRES_PORT = "5433"
$env:POSTGRES_DB = "ragpilot"
$env:POSTGRES_USER = "ragpilot"
$env:POSTGRES_PASSWORD = "ragpilot"

$env:REDIS_URL = "redis://localhost:6380/0"
$env:TEMPORAL_ADDRESS = "localhost:7234"
$env:TEMPORAL_NAMESPACE = "default"
$env:TEMPORAL_TASK_QUEUE = "ragpilot-ingestion"

$env:MINIO_ENDPOINT = "http://localhost:9002"
$env:MINIO_ROOT_USER = "ragpilot"
$env:MINIO_ROOT_PASSWORD = "ragpilot123"
$env:MINIO_BUCKET = "ragpilot-documents"

$env:RETRIEVAL_ENGINE = "native"
$env:CHAT_MODEL_PROVIDER = "deterministic"
$env:CHAT_MODEL_NAME = "ragpilot-grounded-template"

$env:AUTH_PRIMARY_MODE = "directory_local"
$env:ALLOW_LEGACY_ACTOR_HEADERS = "false"
$env:CORS_ALLOWED_ORIGINS = "http://127.0.0.1:3001,http://localhost:3001"

Set-Location "$PSScriptRoot\..\..\apps\api"
.\.venv\Scripts\python.exe -m uvicorn ragpilot_api.main:app --host 0.0.0.0 --port 18000
