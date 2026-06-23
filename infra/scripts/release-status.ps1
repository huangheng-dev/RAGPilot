$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

Write-Host "RagPilot release status" -ForegroundColor Cyan
Write-Host "Repository root: $repoRoot"
Write-Host ""

$gitDirectoryPresent = Test-Path ".git"
$licensePresent = (Test-Path "LICENSE") -or (Test-Path "LICENSE.md")
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

$requiredFiles = @(
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  ".github/workflows/ci.yml",
  "docs/planning/phase-5-release-checklist.md",
  "docs/runbooks/first-public-release.md",
  "docs/runbooks/first-tagged-release-checklist.md"
)

Write-Host "Git initialized: $gitDirectoryPresent"
Write-Host "Branch: $currentBranch"
Write-Host "Baseline commit present: $hasCommit"
Write-Host "License present: $licensePresent"
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
