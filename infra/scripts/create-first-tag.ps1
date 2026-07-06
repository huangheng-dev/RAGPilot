param(
  [string]$Tag = "v0.1.0",
  [string]$Branch = "main",
  [string]$RemoteName = "origin",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

if (-not (Test-Path ".git")) {
  throw "The repository is not initialized as Git."
}

$statusBranchOutput = @(& git status --short --branch)
$hasCommit = -not ($statusBranchOutput | Where-Object { $_ -like "## No commits yet on *" })
if (-not $hasCommit) {
  throw "No baseline commit is present yet. Create the first commit before tagging."
}

$existingRemotes = @(& git remote)
if (-not ($existingRemotes -contains $RemoteName)) {
  throw "Remote '$RemoteName' is not configured."
}

$normalizedTag = $Tag.Trim()
if ([string]::IsNullOrWhiteSpace($normalizedTag)) {
  throw "Tag value cannot be empty."
}

if ($normalizedTag -notmatch '^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z\.-]+)?$') {
  throw "Tag '$normalizedTag' does not match the expected release format (example: v0.1.0)."
}

$currentBranch = (& git branch --show-current).Trim()
if ([string]::IsNullOrWhiteSpace($currentBranch)) {
  throw "Git is not on a named branch. Check out the release branch before tagging."
}

& git rev-parse --verify "refs/heads/$Branch" *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Branch '$Branch' does not exist locally."
}

$existingTags = @(& git tag)
if ($existingTags -contains $normalizedTag) {
  throw "Tag '$normalizedTag' already exists."
}

if ($DryRun) {
  Write-Host "Dry run: first tag validation passed." -ForegroundColor Yellow
  if ($currentBranch -ne $Branch) {
    Write-Host "Dry run: current branch is '$currentBranch' while release branch is '$Branch'." -ForegroundColor Yellow
  }
  Write-Host "Dry run: would create and push tag '$normalizedTag' to '$RemoteName'." -ForegroundColor Yellow
  exit 0
}

if ($currentBranch -ne $Branch) {
  Write-Host "Current branch is '$currentBranch'. RAGPilot expects release tag '$normalizedTag' to be issued from '$Branch'." -ForegroundColor Yellow
}

Write-Host "Creating tag '$normalizedTag'..." -ForegroundColor Cyan
& git tag $normalizedTag
if ($LASTEXITCODE -ne 0) {
  throw "Failed to create tag '$normalizedTag'."
}

Write-Host "Pushing tag '$normalizedTag' to '$RemoteName'..." -ForegroundColor Cyan
& git push $RemoteName $normalizedTag
if ($LASTEXITCODE -ne 0) {
  throw "Failed to push tag '$normalizedTag'."
}

Write-Host "First public tag created successfully." -ForegroundColor Green
