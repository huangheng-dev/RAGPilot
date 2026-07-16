$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root
$uv = Get-Command uv -ErrorAction Stop

function Invoke-UvChecked {
  param(
    [string[]]$Arguments,
    [string]$FailureMessage,
    [switch]$Quiet
  )
  if ($Quiet) {
    & $uv.Source @Arguments *> $null
  } else {
    & $uv.Source @Arguments
  }
  if ($LASTEXITCODE -ne 0) { throw $FailureMessage }
}

function Assert-ExportMatches {
  param([string]$ExpectedPath, [string[]]$ExportArguments)
  $temporaryPath = Join-Path ([IO.Path]::GetTempPath()) ("ragpilot-lock-{0}.txt" -f ([guid]::NewGuid()))
  try {
    Invoke-UvChecked -Arguments (@("export") + $ExportArguments + @("--no-header", "--output-file", $temporaryPath)) `
      -FailureMessage "Unable to export dependency lock for $ExpectedPath." -Quiet
    $expected = (Get-Content $ExpectedPath -Raw).Replace("`r`n", "`n").TrimEnd()
    $actual = (Get-Content $temporaryPath -Raw).Replace("`r`n", "`n").TrimEnd()
    if ($expected -cne $actual) {
      throw "Exported dependency lock is stale: $ExpectedPath"
    }
  } finally {
    Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Auditing RAGPilot dependency locks..." -ForegroundColor Cyan
Invoke-UvChecked -Arguments @("lock", "--project", "apps/api", "--check") `
  -FailureMessage "apps/api/uv.lock is stale."
Invoke-UvChecked -Arguments @("lock", "--project", "apps/worker", "--check") `
  -FailureMessage "apps/worker/uv.lock is stale."

$sharedExportArguments = @("--locked", "--no-dev", "--no-hashes", "--no-emit-project")
Assert-ExportMatches -ExpectedPath "apps/api/requirements-core.lock" `
  -ExportArguments (@("--project", "apps/api") + $sharedExportArguments)
Assert-ExportMatches -ExpectedPath "apps/api/requirements-agent.lock" `
  -ExportArguments (@("--project", "apps/api", "--extra", "agent-langgraph") + $sharedExportArguments)
Assert-ExportMatches -ExpectedPath "apps/api/requirements.lock" `
  -ExportArguments (@("--project", "apps/api", "--all-extras") + $sharedExportArguments)
Assert-ExportMatches -ExpectedPath "apps/worker/requirements.lock" `
  -ExportArguments (@("--project", "apps/worker") + $sharedExportArguments)

Write-Host "Python resolution and exported container dependency locks are synchronized." -ForegroundColor Green
