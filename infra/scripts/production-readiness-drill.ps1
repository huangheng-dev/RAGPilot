$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Push-Location (Join-Path $root "apps\api")
try {
  uv run pytest tests/test_user_service.py tests/test_user_routes.py tests/test_request_actor.py tests/test_actor_authorization_routes.py tests/test_runtime_credentials.py -q
} finally { Pop-Location }
Push-Location (Join-Path $root "apps\worker")
try { uv run pytest tests/test_chunking.py tests/test_document_ingestion_activity.py -q } finally { Pop-Location }
docker compose -f (Join-Path $root "infra\docker\compose.yaml") config --quiet
Write-Host "Production readiness validation passed: auth/session/membership/RBAC, secret rotation, OCR lifecycle, Compose"
