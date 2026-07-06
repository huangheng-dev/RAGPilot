$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $repoRoot

Write-Host "RAGPilot release status" -ForegroundColor Cyan
Write-Host "Repository root: $repoRoot"
Write-Host ""

$gitDirectoryPresent = Test-Path ".git"
$licensePresent = (Test-Path "LICENSE") -or (Test-Path "LICENSE.md")
$releaseWorkflowUsesPreflight = $false
$internalDocsExcluded = $false
$releaseValidationScripts = @(
  "infra/scripts/public-docs-audit.ps1",
  "infra/scripts/public-links-audit.ps1",
  "infra/scripts/release-candidate-audit.ps1",
  "infra/scripts/production-delivery-audit.ps1",
  "infra/scripts/secret-scan.ps1"
)
$missingReleaseValidationScripts = @()
$currentBranch = ""
$hasCommit = $false
$remoteNames = @()
$statusLines = @()

if ($gitDirectoryPresent) {
  $currentBranch = (& git branch --show-current).Trim()
  $statusLines = @(& git status --short --branch)
  $hasCommit = -not ($statusLines | Where-Object { $_ -like "## No commits yet on *" })
  $remoteOutput = & git remote
  if ($LASTEXITCODE -eq 0 -and $remoteOutput) {
    $remoteNames = @($remoteOutput)
  }
}

if (Test-Path ".github/workflows/release-readiness.yml") {
  $releaseWorkflowContent = Get-Content ".github/workflows/release-readiness.yml" -Raw
  $releaseWorkflowUsesPreflight = $releaseWorkflowContent -match "npm run release:preflight"
}

if (Test-Path ".gitignore") {
  $gitignoreContent = Get-Content ".gitignore" -Raw
  $internalDocsExcluded = $gitignoreContent -match "(?m)^docs/$"
}

foreach ($scriptPath in $releaseValidationScripts) {
  if (-not (Test-Path $scriptPath)) {
    $missingReleaseValidationScripts += $scriptPath
  }
}

$requiredFiles = @(
  "README.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  ".env.example",
  ".env.production.example",
  ".github/workflows/ci.yml",
  ".github/workflows/release-readiness.yml"
)

Write-Host "Git initialized: $gitDirectoryPresent"
Write-Host "Branch: $currentBranch"
Write-Host "Baseline commit present: $hasCommit"
Write-Host "License present: $licensePresent"
Write-Host "Release workflow uses unified preflight: $releaseWorkflowUsesPreflight"
Write-Host "Internal docs excluded from public push by default: $internalDocsExcluded"
Write-Host "Release validation scripts present: $($missingReleaseValidationScripts.Count -eq 0)"
Write-Host "Remotes: $([string]::Join(', ', $remoteNames))"
Write-Host ""

Write-Host "Required public-release files:" -ForegroundColor Cyan
foreach ($path in $requiredFiles) {
  $exists = Test-Path $path
  $symbol = if ($exists) { "[x]" } else { "[ ]" }
  Write-Host "$symbol $path"
}

Write-Host ""
Write-Host "Working tree summary:" -ForegroundColor Cyan
if (-not $gitDirectoryPresent) {
  Write-Host "Git is not initialized yet."
} elseif ($statusLines.Count -eq 0) {
  Write-Host "Working tree is clean."
} else {
  $statusLines | ForEach-Object { Write-Host $_ }
}

Write-Host ""
Write-Host "Next blockers:" -ForegroundColor Cyan
if (-not $licensePresent) {
  Write-Host "- choose and add LICENSE"
}
if (-not $releaseWorkflowUsesPreflight) {
  Write-Host "- align release-readiness workflow with npm run release:preflight"
}
if (-not $internalDocsExcluded) {
  Write-Host "- exclude internal docs from the public push set by default"
}
if ($missingReleaseValidationScripts.Count -gt 0) {
  Write-Host "- restore missing release validation scripts:"
  $missingReleaseValidationScripts | ForEach-Object { Write-Host "  - $_" }
}
if (-not $gitDirectoryPresent) {
  Write-Host "- initialize Git"
} elseif (-not $hasCommit) {
  Write-Host "- create first baseline commit"
}
if ($remoteNames.Count -eq 0) {
  Write-Host "- configure Git remote"
}
if ($licensePresent -and $gitDirectoryPresent -and $hasCommit -and $remoteNames.Count -gt 0) {
  Write-Host "- ready for final preflight and first public push"
}

Write-Host ""
Write-Host "Suggested next commands:" -ForegroundColor Cyan
if (-not $licensePresent) {
  Write-Host "- add the chosen LICENSE file at the repository root"
}
if ($gitDirectoryPresent -and $hasCommit -and $remoteNames.Count -eq 0) {
  Write-Host "- powershell -NoProfile -ExecutionPolicy Bypass -File infra/scripts/configure-remote.ps1 -RemoteUrl <your-github-repository-url>"
}
if ($licensePresent -and $gitDirectoryPresent -and $hasCommit -and $remoteNames.Count -gt 0) {
  Write-Host "- npm run release:docs-audit"
  Write-Host "- npm run release:links-audit"
  Write-Host "- npm run release:preflight"
  Write-Host "- npm run release:first-push"
  Write-Host "- npm run release:first-tag"
}
