$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

$venvPython = Join-Path $repoRoot "apps\api\.venv\Scripts\python.exe"
$pythonCommand = if (Test-Path $venvPython) { $venvPython } else { "python" }

Write-Host "Running RAGPilot API tests..." -ForegroundColor Cyan
Write-Host "Python runtime: $pythonCommand"

& $pythonCommand -m pytest apps/api/tests
exit $LASTEXITCODE
