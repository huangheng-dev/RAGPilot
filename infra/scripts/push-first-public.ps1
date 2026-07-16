param(
  [string]$RemoteName = "origin",
  [string]$Branch = "main",
  [switch]$SkipPreflight,
  [switch]$DryRun
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

$currentBranch = (& git branch --show-current).Trim()
if ([string]::IsNullOrWhiteSpace($currentBranch)) {
  throw "Git is not on a named branch. Check out the release branch before the first public push."
}

$workingTreeChanges = @(& git status --porcelain=v1)
if ($workingTreeChanges.Count -gt 0) {
  throw "Public release pushes require a clean working tree. Commit or remove all tracked and untracked changes first."
}

if ($currentBranch -ne $Branch) {
  throw "Public release branch '$Branch' must be checked out before pushing; current branch is '$currentBranch'."
}

& git rev-parse --verify "refs/heads/$Branch" *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Branch '$Branch' does not exist locally."
}

if ($DryRun) {
  Write-Host "Dry run: first public push validation passed." -ForegroundColor Yellow
  Write-Host "Dry run: would push branch '$Branch' to remote '$RemoteName'." -ForegroundColor Yellow
  exit 0
}

if (-not $SkipPreflight) {
  Write-Host "Running release preflight before first push..." -ForegroundColor Cyan
  & powershell -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/release-preflight.ps1"
  if ($LASTEXITCODE -ne 0) {
    throw "Release preflight failed."
  }
}

Write-Host "Pushing '$Branch' to '$RemoteName'..." -ForegroundColor Cyan
& git push -u $RemoteName "HEAD:refs/heads/$Branch"
if ($LASTEXITCODE -ne 0) {
  throw "First public push failed."
}

Write-Host "First public push completed successfully." -ForegroundColor Green
