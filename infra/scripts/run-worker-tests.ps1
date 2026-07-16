$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $repoRoot

$workerRoot = Join-Path (Join-Path $repoRoot "apps") "worker"
$venvRoot = Join-Path $workerRoot ".venv"
$venvPython = if ($IsWindows -or $env:OS -eq "Windows_NT") {
  Join-Path $venvRoot "Scripts\python.exe"
} else {
  Join-Path $venvRoot "bin/python"
}

$pythonLauncherCommand = Get-Command python3 -ErrorAction SilentlyContinue
if (-not $pythonLauncherCommand) {
  $pythonLauncherCommand = Get-Command python -ErrorAction Stop
}

function Reset-WorkerRuntime {
  $resolvedWorkerRoot = [System.IO.Path]::GetFullPath($workerRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar)
  $resolvedVenvRoot = [System.IO.Path]::GetFullPath($venvRoot)
  if (-not $resolvedVenvRoot.StartsWith("$resolvedWorkerRoot$([System.IO.Path]::DirectorySeparatorChar)", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to reset a Worker runtime outside the Worker workspace."
  }
  if (Test-Path $venvRoot) {
    Remove-Item -LiteralPath $venvRoot -Recurse -Force
  }
  Write-Host "Creating Worker virtual environment..." -ForegroundColor Cyan
  & $pythonLauncherCommand.Source -m venv $venvRoot
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create Worker virtual environment."
  }
}

if (-not (Test-Path $venvPython)) {
  Reset-WorkerRuntime
}

Write-Host "Installing RAGPilot Worker test dependencies..." -ForegroundColor Cyan
& $venvPython -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) {
  throw "Failed to upgrade pip for the Worker test runtime."
}
$workerInstallArguments = @("-m", "pip", "install", "--timeout", "120", "--retries", "10", "-e", $workerRoot, "pytest")
& $venvPython @workerInstallArguments
if ($LASTEXITCODE -ne 0) {
  Write-Warning "The existing Worker runtime is inconsistent; recreating its managed virtual environment."
  Reset-WorkerRuntime
  & $venvPython -m pip install --upgrade pip
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to upgrade pip in the recreated Worker runtime."
  }
  & $venvPython @workerInstallArguments
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to install the Worker package and tests."
  }
}

Write-Host "Running RAGPilot Worker tests..." -ForegroundColor Cyan
& $venvPython -m pytest apps/worker/tests
exit $LASTEXITCODE
