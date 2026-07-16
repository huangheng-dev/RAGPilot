$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $repoRoot

function Assert-PathExists {
  param(
    [string]$Path,
    [string]$Description
  )

  if (-not (Test-Path $Path)) {
    throw "Missing required $Description at '$Path'."
  }
}

Write-Host "Auditing RAGPilot production delivery assets..." -ForegroundColor Cyan

$requiredPaths = @(
  @{ Path = ".env.production.example"; Description = "production environment template" },
  @{ Path = "infra/docker/web.Dockerfile"; Description = "web container image" },
  @{ Path = "infra/docker/api.Dockerfile"; Description = "api container image" },
  @{ Path = "infra/docker/worker.Dockerfile"; Description = "worker container image" },
  @{ Path = ".github/workflows/release-images.yml"; Description = "signed image release workflow" },
  @{ Path = "infra/scripts/dependency-lock-audit.ps1"; Description = "dependency lock audit" },
  @{ Path = "apps/api/uv.lock"; Description = "API dependency resolution" },
  @{ Path = "apps/api/requirements-core.lock"; Description = "API core container dependency lock" },
  @{ Path = "apps/api/requirements-agent.lock"; Description = "API Agent container dependency lock" },
  @{ Path = "apps/api/requirements.lock"; Description = "API full container dependency lock" },
  @{ Path = "apps/worker/uv.lock"; Description = "Worker dependency resolution" },
  @{ Path = "apps/worker/requirements.lock"; Description = "Worker container dependency lock" },
  @{ Path = "packages/evals/staging/capacity-contract-v1.json"; Description = "staging capacity contract" },
  @{ Path = "infra/k8s/README.md"; Description = "Kubernetes deployment guide" },
  @{ Path = "infra/k8s/kustomization.yaml"; Description = "Kubernetes kustomization" },
  @{ Path = "infra/k8s/namespace.yaml"; Description = "Kubernetes namespace manifest" },
  @{ Path = "infra/k8s/configmap.yaml"; Description = "Kubernetes config map manifest" },
  @{ Path = "infra/k8s/secret.example.yaml"; Description = "Kubernetes secret template" },
  @{ Path = "infra/k8s/migration-job.yaml"; Description = "Kubernetes database migration job" },
  @{ Path = "infra/k8s/api-deployment.yaml"; Description = "Kubernetes API deployment" },
  @{ Path = "infra/k8s/worker-deployment.yaml"; Description = "Kubernetes worker deployment" },
  @{ Path = "infra/k8s/agent-worker-deployment.yaml"; Description = "Kubernetes Agent Worker deployment" },
  @{ Path = "infra/k8s/web-deployment.yaml"; Description = "Kubernetes web deployment" },
  @{ Path = "infra/k8s/api-service.yaml"; Description = "Kubernetes API service" },
  @{ Path = "infra/k8s/web-service.yaml"; Description = "Kubernetes web service" },
  @{ Path = "infra/k8s/ingress.yaml"; Description = "Kubernetes ingress manifest" },
  @{ Path = "infra/k8s/production-reliability.yaml"; Description = "Kubernetes reliability baseline" }
)

foreach ($requiredPath in $requiredPaths) {
  Assert-PathExists -Path $requiredPath.Path -Description $requiredPath.Description
}

$requiredTrackedPaths = @(
  ".env.production.example",
  ".github/workflows/release-images.yml",
  "infra/scripts/dependency-lock-audit.ps1",
  "apps/api/uv.lock",
  "apps/api/requirements-core.lock",
  "apps/api/requirements-agent.lock",
  "apps/api/requirements.lock",
  "apps/worker/uv.lock",
  "apps/worker/requirements.lock",
  "packages/evals/staging/capacity-contract-v1.json",
  "infra/k8s/README.md",
  "infra/k8s/kustomization.yaml",
  "infra/k8s/namespace.yaml",
  "infra/k8s/configmap.yaml",
  "infra/k8s/secret.example.yaml",
  "infra/k8s/migration-job.yaml",
  "infra/k8s/api-deployment.yaml",
  "infra/k8s/worker-deployment.yaml",
  "infra/k8s/agent-worker-deployment.yaml",
  "infra/k8s/web-deployment.yaml",
  "infra/k8s/api-service.yaml",
  "infra/k8s/web-service.yaml",
  "infra/k8s/ingress.yaml",
  "infra/k8s/production-reliability.yaml"
)

foreach ($trackedPath in $requiredTrackedPaths) {
  & git ls-files --error-unmatch $trackedPath *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Required public delivery asset '$trackedPath' exists locally but is not tracked by Git."
  }
}

$productionEnvironment = @{}
foreach ($line in Get-Content ".env.production.example") {
  if ($line -match '^([A-Z0-9_]+)=(.*)$') {
    $productionEnvironment[$Matches[1]] = $Matches[2]
  }
}
if (
  $productionEnvironment["RAGPILOT_API_OPTIONAL_EXTRAS"] -ne
  $productionEnvironment["RAGPILOT_AGENT_WORKER_OPTIONAL_EXTRAS"]
) {
  throw "Production API and Agent Worker optional framework extras must remain aligned."
}
if (
  $productionEnvironment["EMBEDDING_MODEL"] -ne
  $productionEnvironment["RETRIEVAL_EMBEDDING_MODEL"]
) {
  throw "Production ingestion and retrieval embedding model identifiers must remain aligned."
}

$configMapContent = Get-Content "infra/k8s/configmap.yaml" -Raw
$ingestionEmbeddingModel = [regex]::Match(
  $configMapContent, '(?m)^\s{2}EMBEDDING_MODEL:\s*([^\r\n]+)$'
).Groups[1].Value.Trim(' ', '"')
$retrievalEmbeddingModel = [regex]::Match(
  $configMapContent, '(?m)^\s{2}RETRIEVAL_EMBEDDING_MODEL:\s*([^\r\n]+)$'
).Groups[1].Value.Trim(' ', '"')
if (-not $ingestionEmbeddingModel -or $ingestionEmbeddingModel -ne $retrievalEmbeddingModel) {
  throw "Kubernetes ingestion and retrieval embedding model identifiers must remain aligned."
}

& docker compose --env-file ".env.production.example" -f "infra/docker/compose.yaml" config --quiet
if ($LASTEXITCODE -ne 0) {
  throw "Production Compose profile does not render successfully."
}

$kubectl = Get-Command kubectl -ErrorAction SilentlyContinue
if ($kubectl) {
  & $kubectl.Source kustomize "infra/k8s" *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Kubernetes production baseline does not render successfully."
  }
} else {
  Write-Warning "kubectl is unavailable; Kubernetes render validation was skipped on this host."
}

$webDockerfile = Get-Content "infra/docker/web.Dockerfile" -Raw
$apiDockerfile = Get-Content "infra/docker/api.Dockerfile" -Raw
$workerDockerfile = Get-Content "infra/docker/worker.Dockerfile" -Raw
foreach ($dockerfile in @(
  @{ Path = "infra/docker/web.Dockerfile"; Content = $webDockerfile },
  @{ Path = "infra/docker/api.Dockerfile"; Content = $apiDockerfile },
  @{ Path = "infra/docker/worker.Dockerfile"; Content = $workerDockerfile }
)) {
  if ($dockerfile.Content -notmatch '(?m)^FROM\s+\S+@sha256:[a-f0-9]{64}') {
    throw "$($dockerfile.Path) does not pin its runtime base image by digest."
  }
}
if ($webDockerfile -match "next dev") {
  throw "infra/docker/web.Dockerfile still contains a development server command."
}
if ($webDockerfile -notmatch 'next", "start' -and $webDockerfile -notmatch "next start") {
  throw "infra/docker/web.Dockerfile does not appear to start a production Next.js server."
}
if ($webDockerfile -notmatch '(?m)^RUN npm ci\b' -or $webDockerfile -match '(?m)^RUN npm install\b') {
  throw "infra/docker/web.Dockerfile must use the committed npm lock through npm ci."
}
if ($apiDockerfile -notmatch 'requirements-core\.lock' -or $apiDockerfile -notmatch 'requirements\.lock') {
  throw "infra/docker/api.Dockerfile is not consuming the committed dependency profiles."
}
if ($workerDockerfile -notmatch 'requirements\.lock') {
  throw "infra/docker/worker.Dockerfile is not consuming its committed dependency lock."
}

$releaseImageWorkflow = Get-Content ".github/workflows/release-images.yml" -Raw
$requiredReleaseImageContracts = @(
  @{ Pattern = 'platforms:\s*linux/amd64,linux/arm64'; Description = "multi-architecture image publication" },
  @{ Pattern = 'provenance:\s*mode=max'; Description = "maximum build provenance" },
  @{ Pattern = 'sbom:\s*true'; Description = "SBOM generation" },
  @{ Pattern = 'attest-build-provenance@'; Description = "registry provenance attestation" },
  @{ Pattern = 'cosign sign'; Description = "keyless digest signing" }
)
foreach ($contract in $requiredReleaseImageContracts) {
  if ($releaseImageWorkflow -notmatch $contract.Pattern) {
    throw "Image release workflow is missing $($contract.Description)."
  }
}

$ciWorkflowContent = Get-Content ".github/workflows/ci.yml" -Raw
if ($ciWorkflowContent -notmatch 'docker/build-push-action@' -or $ciWorkflowContent -notmatch 'push:\s*false') {
  throw "CI workflow is not smoke-building the release container profiles."
}

$workloadPaths = @(
  "infra/k8s/api-deployment.yaml",
  "infra/k8s/worker-deployment.yaml",
  "infra/k8s/agent-worker-deployment.yaml",
  "infra/k8s/web-deployment.yaml",
  "infra/k8s/migration-job.yaml"
)
foreach ($workloadPath in $workloadPaths) {
  $workload = Get-Content $workloadPath -Raw
  if ($workload -notmatch 'automountServiceAccountToken:\s*false') {
    throw "$workloadPath must disable automatic service-account token mounting."
  }
}
foreach ($deploymentPath in $workloadPaths[0..3]) {
  $deployment = Get-Content $deploymentPath -Raw
  if ($deployment -notmatch 'topologySpreadConstraints:') {
    throw "$deploymentPath is missing topology-spread policy."
  }
}

$readmeContent = Get-Content "README.md" -Raw
if ($readmeContent -notmatch "Production Deployment") {
  throw "README.md is missing the Production Deployment section."
}
if ($readmeContent -notmatch "Release Workflow") {
  throw "README.md is missing the Release Workflow section."
}

if (
  $ciWorkflowContent -notmatch "release:delivery-audit" -and
  $ciWorkflowContent -notmatch "production-delivery-audit\.ps1"
) {
  throw "CI workflow is not running the production delivery audit."
}

Write-Host "Production delivery assets are present and wired for public release." -ForegroundColor Green
