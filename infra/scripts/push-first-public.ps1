param(
  [string]$RemoteName = "origin",
  [string]$Branch = "main",
  [switch]$SkipPreflight
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

if (-not (Test-Path ".git")) {
  throw "The repository is not initialized as Git."
}

$licensePresent = (Test-Path "LICENSE") -or (Test-Path "LICENSE.md")
if (-not $licensePresent) {
  throw "No LICENSE file is present. Public push should wait until the final license is chosen."
}

$statusBranchOutput = @(& git status --short --branch)
$hasCommit = -not ($statusBranchOutput | Where-Object { $_ -like "## No commits yet on *" })
if (-not $hasCommit) {
  throw "No baseline commit is present yet. Create the first commit before the public push."
}

$existingRemotes = @(& git remote)
if (-not ($existingRemotes -contains $RemoteName)) {
  throw "Remote '$RemoteName' is not configured."
}

if (-not $SkipPreflight) {
  Write-Host "Running release preflight before first push..." -ForegroundColor Cyan
  & powershell -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/release-preflight.ps1"
  if ($LASTEXITCODE -ne 0) {
    throw "Release preflight failed."
  }
}

Write-Host "Pushing '$Branch' to '$RemoteName'..." -ForegroundColor Cyan
& git push -u $RemoteName $Branch
if ($LASTEXITCODE -ne 0) {
  throw "First public push failed."
}

Write-Host "First public push completed successfully." -ForegroundColor Green
