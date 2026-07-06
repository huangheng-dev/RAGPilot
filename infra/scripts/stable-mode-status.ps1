$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$composeFile = Join-Path $repoRoot "infra\docker\compose.yaml"

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
@(
  Read-PortProcessStatus -Name "RAGPilot-web-stable" -Port 3001
  Read-PortProcessStatus -Name "RAGPilot-api-stable" -Port 18000
) | Format-Table -AutoSize

Write-Host ""
Write-Host "Docker dependency services:"
docker compose -f $composeFile ps postgres redis minio elasticsearch temporal temporal-ui otel-collector worker
