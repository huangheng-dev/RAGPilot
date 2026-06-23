param(
  [string]$Tag = "v0.1.0",
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

$existingTags = @(& git tag)
if ($existingTags -contains $Tag) {
  throw "Tag '$Tag' already exists."
}

if ($DryRun) {
  Write-Host "Dry run: first tag validation passed." -ForegroundColor Yellow
  Write-Host "Dry run: would create and push tag '$Tag' to '$RemoteName'." -ForegroundColor Yellow
  exit 0
}

Write-Host "Creating tag '$Tag'..." -ForegroundColor Cyan
& git tag $Tag
if ($LASTEXITCODE -ne 0) {
  throw "Failed to create tag '$Tag'."
}

Write-Host "Pushing tag '$Tag' to '$RemoteName'..." -ForegroundColor Cyan
& git push $RemoteName $Tag
if ($LASTEXITCODE -ne 0) {
  throw "Failed to push tag '$Tag'."
}

Write-Host "First public tag created successfully." -ForegroundColor Green
