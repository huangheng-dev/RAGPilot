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

$workingTreeChanges = @(& git status --porcelain=v1)
if ($workingTreeChanges.Count -gt 0) {
  throw "Release tags require a clean working tree. Commit or remove all tracked and untracked changes first."
}

if ($currentBranch -ne $Branch) {
  throw "Release tag '$normalizedTag' must be created from branch '$Branch', not '$currentBranch'."
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
  Write-Host "Dry run: would create and push tag '$normalizedTag' to '$RemoteName'." -ForegroundColor Yellow
  exit 0
}

$localHead = (& git rev-parse HEAD).Trim()
$remoteBranchLine = @(& git ls-remote --heads $RemoteName "refs/heads/$Branch") | Select-Object -First 1
if (-not $remoteBranchLine) {
  throw "Remote branch '$RemoteName/$Branch' does not exist. Push the reviewed release commit before tagging."
}
$remoteHead = ($remoteBranchLine -split '\s+')[0]
if ($remoteHead -ne $localHead) {
  throw "Local HEAD '$localHead' does not match reviewed remote branch '$RemoteName/$Branch' at '$remoteHead'."
}

Write-Host "Creating tag '$normalizedTag'..." -ForegroundColor Cyan
& git tag -a $normalizedTag -m "RAGPilot $normalizedTag"
if ($LASTEXITCODE -ne 0) {
  throw "Failed to create tag '$normalizedTag'."
}

Write-Host "Pushing tag '$normalizedTag' to '$RemoteName'..." -ForegroundColor Cyan
& git push $RemoteName $normalizedTag
if ($LASTEXITCODE -ne 0) {
  throw "Failed to push tag '$normalizedTag'."
}

Write-Host "First public tag created successfully." -ForegroundColor Green
