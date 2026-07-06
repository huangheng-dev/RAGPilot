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

Write-Host "Running RAGPilot release preflight..." -ForegroundColor Cyan

$requiredFiles = @(
  @{ Path = "README.md"; Description = "README" },
  @{ Path = "CHANGELOG.md"; Description = "changelog" },
  @{ Path = "CONTRIBUTING.md"; Description = "contribution guide" },
  @{ Path = "SECURITY.md"; Description = "security policy" },
  @{ Path = ".github/workflows/ci.yml"; Description = "CI workflow" }
)

foreach ($requiredFile in $requiredFiles) {
  Assert-PathExists -Path $requiredFile.Path -Description $requiredFile.Description
}

$licensePresent = (Test-Path "LICENSE") -or (Test-Path "LICENSE.md")
if (-not $licensePresent) {
  Write-Warning "No LICENSE file is present yet. Public push should wait until the final license is chosen."
}

$gitDirectoryPresent = Test-Path ".git"
if (-not $gitDirectoryPresent) {
  throw "The repository is not initialized as Git."
}

$currentBranch = (& git branch --show-current).Trim()
$statusBranchOutput = @(& git status --short --branch)
$hasCommit = -not ($statusBranchOutput | Where-Object { $_ -like "## No commits yet on *" })

$remoteNames = @()
$remoteOutput = & git remote
if ($LASTEXITCODE -eq 0 -and $remoteOutput) {
  $remoteNames = @($remoteOutput)
}

Write-Host "Git branch: $currentBranch"
Write-Host "Git baseline commit present: $hasCommit"
Write-Host "Git remotes: $([string]::Join(', ', $remoteNames))"

Write-Host ""
Write-Host "1/7 Auditing public documentation..." -ForegroundColor Cyan
& powershell -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/public-docs-audit.ps1"
if ($LASTEXITCODE -ne 0) {
  throw "Public documentation audit failed."
}

Write-Host ""
Write-Host "2/7 Auditing public markdown links..." -ForegroundColor Cyan
& powershell -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/public-links-audit.ps1"
if ($LASTEXITCODE -ne 0) {
  throw "Public markdown link audit failed."
}

Write-Host ""
Write-Host "3/7 Building web..." -ForegroundColor Cyan
& npm run web:check
if ($LASTEXITCODE -ne 0) {
  throw "Web build failed."
}

Write-Host ""
Write-Host "4/7 Running API tests..." -ForegroundColor Cyan
& npm run api:test
if ($LASTEXITCODE -ne 0) {
  throw "API tests failed."
}

Write-Host ""
Write-Host "5/7 Auditing public candidate files..." -ForegroundColor Cyan
& powershell -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/release-candidate-audit.ps1"
if ($LASTEXITCODE -ne 0) {
  throw "Release candidate audit failed."
}

Write-Host ""
Write-Host "6/7 Auditing production delivery assets..." -ForegroundColor Cyan
& powershell -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/production-delivery-audit.ps1"
if ($LASTEXITCODE -ne 0) {
  throw "Production delivery audit failed."
}

Write-Host ""
Write-Host "7/7 Running secret scan..." -ForegroundColor Cyan
& powershell -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/secret-scan.ps1"
if ($LASTEXITCODE -ne 0) {
  throw "Secret scan failed."
}

Write-Host ""
Write-Host "Release preflight passed." -ForegroundColor Green

if (-not $hasCommit) {
  Write-Warning "The repository still has no baseline commit."
}

if ($remoteNames.Count -eq 0) {
  Write-Warning "No Git remote is configured yet."
}
