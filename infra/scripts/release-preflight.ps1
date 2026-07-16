$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $repoRoot

$powerShellHost = if ($PSVersionTable.PSEdition -eq "Core") { "pwsh" } else { "powershell" }

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
Write-Host "1/12 Auditing public documentation..." -ForegroundColor Cyan
& $powerShellHost -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/public-docs-audit.ps1"
if ($LASTEXITCODE -ne 0) {
  throw "Public documentation audit failed."
}

Write-Host ""
Write-Host "2/12 Auditing public markdown links..." -ForegroundColor Cyan
& $powerShellHost -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/public-links-audit.ps1"
if ($LASTEXITCODE -ne 0) {
  throw "Public markdown link audit failed."
}

Write-Host ""
Write-Host "3/12 Linting web..." -ForegroundColor Cyan
& npm run web:lint
if ($LASTEXITCODE -ne 0) {
  throw "Web lint failed."
}

Write-Host ""
Write-Host "4/12 Building web..." -ForegroundColor Cyan
& npm run web:check
if ($LASTEXITCODE -ne 0) {
  throw "Web build failed."
}

Write-Host ""
Write-Host "5/12 Auditing production Node dependencies..." -ForegroundColor Cyan
& npm audit --omit=dev --audit-level=high
if ($LASTEXITCODE -ne 0) {
  throw "Production Node dependency audit failed."
}

Write-Host ""
Write-Host "6/12 Running API tests..." -ForegroundColor Cyan
& npm run api:test
if ($LASTEXITCODE -ne 0) {
  throw "API tests failed."
}

Write-Host ""
Write-Host "7/12 Running Worker tests..." -ForegroundColor Cyan
& npm run worker:test
if ($LASTEXITCODE -ne 0) {
  throw "Worker tests failed."
}

Write-Host ""
Write-Host "8/12 Building and testing the MCP server..." -ForegroundColor Cyan
& npm run mcp:build
if ($LASTEXITCODE -ne 0) {
  throw "MCP server build failed."
}
& npm run mcp:test
if ($LASTEXITCODE -ne 0) {
  throw "MCP server tests failed."
}

Write-Host ""
Write-Host "9/12 Running isolated authenticated browser E2E tests..." -ForegroundColor Cyan
& npm run e2e:test
if ($LASTEXITCODE -ne 0) {
  throw "Authenticated browser E2E tests failed."
}

Write-Host ""
Write-Host "10/12 Auditing public candidate files..." -ForegroundColor Cyan
& $powerShellHost -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/release-candidate-audit.ps1"
if ($LASTEXITCODE -ne 0) {
  throw "Release candidate audit failed."
}

Write-Host ""
Write-Host "11/12 Auditing production delivery assets..." -ForegroundColor Cyan
& $powerShellHost -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/production-delivery-audit.ps1"
if ($LASTEXITCODE -ne 0) {
  throw "Production delivery audit failed."
}

Write-Host ""
Write-Host "12/12 Running secret scan..." -ForegroundColor Cyan
& $powerShellHost -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/secret-scan.ps1"
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
