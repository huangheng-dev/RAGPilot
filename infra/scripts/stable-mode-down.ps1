$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runtimeDir = Join-Path $repoRoot "tmp\stable-mode"
$rootEnvPath = Join-Path $repoRoot ".env"

function Get-ConfiguredPort {
  param(
    [string]$Name,
    [int]$Default
  )

  $processValue = [Environment]::GetEnvironmentVariable($Name, "Process")
  if ($processValue) {
    return [int]$processValue
  }
  if (Test-Path $rootEnvPath) {
    $line = Get-Content $rootEnvPath | Where-Object { $_ -match "^$([regex]::Escape($Name))=" } | Select-Object -Last 1
    if ($line) {
      return [int](($line -split "=", 2)[1].Trim())
    }
  }
  return $Default
}

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

$webPort = Get-ConfiguredPort -Name "RAGPILOT_WEB_PORT" -Default 3000
$apiPort = Get-ConfiguredPort -Name "RAGPILOT_API_PORT" -Default 8000

Stop-ProcessOnPort -Port $webPort -Label "RAGPilot-web-stable"
Stop-ProcessOnPort -Port $apiPort -Label "RAGPilot-api-stable"

Get-ChildItem $runtimeDir -Filter "*.pid" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host "Local RAGPilot stable processes stopped."
