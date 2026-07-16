$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$composeFile = Join-Path $repoRoot "infra\docker\compose.yaml"
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

function Read-PortProcessStatus {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $connection) {
    return [pscustomobject]@{
      name = $Name
      state = "stopped"
      port = $Port
      pid = ""
      process = ""
    }
  }

  $existingProcess = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
  if ($existingProcess) {
    return [pscustomobject]@{
      name = $Name
      state = "running"
      pid = $existingProcess.Id
      port = $Port
      process = $existingProcess.ProcessName
    }
  }

  return [pscustomobject]@{
    name = $Name
    state = "listening"
    pid = $connection.OwningProcess
    port = $Port
    process = ""
  }
}

Write-Host "Local stable processes:"
$webPort = Get-ConfiguredPort -Name "RAGPILOT_WEB_PORT" -Default 3000
$apiPort = Get-ConfiguredPort -Name "RAGPILOT_API_PORT" -Default 8000
@(
  Read-PortProcessStatus -Name "RAGPilot-web-stable" -Port $webPort
  Read-PortProcessStatus -Name "RAGPilot-api-stable" -Port $apiPort
) | Format-Table -AutoSize

Write-Host ""
Write-Host "Docker dependency services:"
if (Test-Path $rootEnvPath) {
  docker compose --env-file $rootEnvPath -f $composeFile ps postgres redis minio elasticsearch temporal temporal-ui otel-collector worker
} else {
  docker compose -f $composeFile ps postgres redis minio elasticsearch temporal temporal-ui otel-collector worker
}
