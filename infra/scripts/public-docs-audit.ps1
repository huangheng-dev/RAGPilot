$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $repoRoot

Write-Host "Auditing RAGPilot public documentation layer..." -ForegroundColor Cyan

$requiredFiles = @(
  "README.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "LICENSE"
)

$missingFiles = @($requiredFiles | Where-Object { -not (Test-Path $_) })
if ($missingFiles.Count -gt 0) {
  Write-Host ""
  Write-Host "Missing required public documentation files:" -ForegroundColor Yellow
  $missingFiles | ForEach-Object { Write-Host $_ }
  exit 1
}

$emptyFiles = @(
  $requiredFiles | Where-Object {
    (Get-Item $_).Length -le 0
  }
)
if ($emptyFiles.Count -gt 0) {
  Write-Host ""
  Write-Host "Empty public documentation files detected:" -ForegroundColor Yellow
  $emptyFiles | ForEach-Object { Write-Host $_ }
  exit 1
}

$readmeContent = Get-Content "README.md" -Raw
if ($readmeContent -notmatch "RAGPilot") {
  throw "README.md does not appear to describe RAGPilot."
}

Write-Host "Public documentation layer is present and non-empty." -ForegroundColor Green
