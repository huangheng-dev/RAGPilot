param(
  [string]$RemoteUrl = "",
  [string]$RemoteName = "origin"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

if (-not (Test-Path ".git")) {
  throw "The repository is not initialized as Git."
}

$normalizedRemoteUrl = $RemoteUrl.Trim()
if ([string]::IsNullOrWhiteSpace($normalizedRemoteUrl)) {
  throw "Missing RemoteUrl. Example: powershell -NoProfile -ExecutionPolicy Bypass -File infra/scripts/configure-remote.ps1 -RemoteUrl https://github.com/<owner>/ragpilot.git"
}

$existingRemotes = @(& git remote)
if ($existingRemotes -contains $RemoteName) {
  Write-Host "Updating existing remote '$RemoteName'..." -ForegroundColor Cyan
  & git remote set-url $RemoteName $normalizedRemoteUrl
} else {
  Write-Host "Adding remote '$RemoteName'..." -ForegroundColor Cyan
  & git remote add $RemoteName $normalizedRemoteUrl
}

if ($LASTEXITCODE -ne 0) {
  throw "Failed to configure Git remote."
}

Write-Host "Remote '$RemoteName' configured:" -ForegroundColor Green
& git remote -v
