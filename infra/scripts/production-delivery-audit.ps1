$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
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
  @{ Path = "infra/k8s/README.md"; Description = "Kubernetes deployment guide" },
  @{ Path = "infra/k8s/kustomization.yaml"; Description = "Kubernetes kustomization" },
  @{ Path = "infra/k8s/namespace.yaml"; Description = "Kubernetes namespace manifest" },
  @{ Path = "infra/k8s/configmap.yaml"; Description = "Kubernetes config map manifest" },
  @{ Path = "infra/k8s/secret.example.yaml"; Description = "Kubernetes secret template" },
  @{ Path = "infra/k8s/api-deployment.yaml"; Description = "Kubernetes API deployment" },
  @{ Path = "infra/k8s/worker-deployment.yaml"; Description = "Kubernetes worker deployment" },
  @{ Path = "infra/k8s/web-deployment.yaml"; Description = "Kubernetes web deployment" },
  @{ Path = "infra/k8s/api-service.yaml"; Description = "Kubernetes API service" },
  @{ Path = "infra/k8s/web-service.yaml"; Description = "Kubernetes web service" },
  @{ Path = "infra/k8s/ingress.yaml"; Description = "Kubernetes ingress manifest" }
)

foreach ($requiredPath in $requiredPaths) {
  Assert-PathExists -Path $requiredPath.Path -Description $requiredPath.Description
}

$requiredTrackedPaths = @(
  ".env.production.example",
  "infra/k8s/README.md",
  "infra/k8s/kustomization.yaml",
  "infra/k8s/namespace.yaml",
  "infra/k8s/configmap.yaml",
  "infra/k8s/secret.example.yaml",
  "infra/k8s/api-deployment.yaml",
  "infra/k8s/worker-deployment.yaml",
  "infra/k8s/web-deployment.yaml",
  "infra/k8s/api-service.yaml",
  "infra/k8s/web-service.yaml",
  "infra/k8s/ingress.yaml"
)

foreach ($trackedPath in $requiredTrackedPaths) {
  & git ls-files --error-unmatch $trackedPath *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Required public delivery asset '$trackedPath' exists locally but is not tracked by Git."
  }
}

$webDockerfile = Get-Content "infra/docker/web.Dockerfile" -Raw
if ($webDockerfile -match "next dev") {
  throw "infra/docker/web.Dockerfile still contains a development server command."
}
if ($webDockerfile -notmatch 'next", "start' -and $webDockerfile -notmatch "next start") {
  throw "infra/docker/web.Dockerfile does not appear to start a production Next.js server."
}

$readmeContent = Get-Content "README.md" -Raw
if ($readmeContent -notmatch "Production Deployment") {
  throw "README.md is missing the Production Deployment section."
}
if ($readmeContent -notmatch "Release Workflow") {
  throw "README.md is missing the Release Workflow section."
}

$ciWorkflowContent = Get-Content ".github/workflows/ci.yml" -Raw
if (
  $ciWorkflowContent -notmatch "release:delivery-audit" -and
  $ciWorkflowContent -notmatch "production-delivery-audit\.ps1"
) {
  throw "CI workflow is not running the production delivery audit."
}

Write-Host "Production delivery assets are present and wired for public release." -ForegroundColor Green
