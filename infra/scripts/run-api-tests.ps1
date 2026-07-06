$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

$apiRoot = Join-Path $repoRoot "apps\api"
$venvRoot = Join-Path $apiRoot ".venv"
$venvPython = Join-Path $venvRoot "Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
  Write-Host "Creating API virtual environment..." -ForegroundColor Cyan
  & python -m venv $venvRoot
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create API virtual environment."
  }
}

$pythonCommand = $venvPython
$apiInstallTarget = "$apiRoot[retrieval-llamaindex,agent-langgraph]"

Write-Host "Installing RAGPilot API test dependencies..." -ForegroundColor Cyan
& $pythonCommand -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) {
  throw "Failed to upgrade pip."
}

& $pythonCommand -m pip install -e $apiInstallTarget
if ($LASTEXITCODE -ne 0) {
  throw "Failed to install API package."
}

& $pythonCommand -m pip install pytest
if ($LASTEXITCODE -ne 0) {
  throw "Failed to install pytest."
}

Write-Host "Running RAGPilot API tests..." -ForegroundColor Cyan
Write-Host "Python runtime: $pythonCommand"

& $pythonCommand -m pytest apps/api/tests
exit $LASTEXITCODE
