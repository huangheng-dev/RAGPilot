param(
  [string]$Message = "Initial RAGPilot open-source baseline",
  [switch]$SkipLicenseCheck
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

if (-not (Test-Path ".git")) {
  throw "The repository is not initialized as Git."
}

$licensePresent = (Test-Path "LICENSE") -or (Test-Path "LICENSE.md")
if (-not $licensePresent -and -not $SkipLicenseCheck) {
  throw "No LICENSE file is present. Add the final license first, or rerun with -SkipLicenseCheck if you intentionally want a local-only baseline commit before public release."
}

$statusLines = @(& git status --short)
if ($statusLines.Count -eq 0) {
  Write-Host "Working tree is already clean. Nothing to commit." -ForegroundColor Yellow
  exit 0
}

Write-Host "Creating RAGPilot baseline commit..." -ForegroundColor Cyan
& git add .
if ($LASTEXITCODE -ne 0) {
  throw "git add failed."
}

& git commit -m $Message
if ($LASTEXITCODE -ne 0) {
  throw "git commit failed."
}

Write-Host "Baseline commit created successfully." -ForegroundColor Green
