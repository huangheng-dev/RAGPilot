$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runtimeDir = Join-Path $repoRoot "tmp\stable-mode"

function Stop-ProcessOnPort {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port,
    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $connections) {
    Write-Host "$Label is already stopped."
    return
  }

  $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $processIds) {
    $existingProcess = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($existingProcess) {
      Stop-Process -Id $existingProcess.Id -Force
      Write-Host "Stopped $Label on port $Port (PID $($existingProcess.Id))."
    }
  }
}

Stop-ProcessOnPort -Port 3001 -Label "RAGPilot-web-stable"
Stop-ProcessOnPort -Port 18000 -Label "RAGPilot-api-stable"

Get-ChildItem $runtimeDir -Filter "*.pid" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host "Local RAGPilot stable processes stopped."
