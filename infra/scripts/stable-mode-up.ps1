param(
  [switch]$SkipWorker
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runtimeDir = Join-Path $repoRoot "tmp\stable-mode"
$composeFile = Join-Path $repoRoot "infra\docker\compose.yaml"

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

function Stop-ManagedProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $pidPath = Join-Path $runtimeDir "$Name.pid"
  if (-not (Test-Path $pidPath)) {
    return
  }

  $rawPid = Get-Content $pidPath -ErrorAction SilentlyContinue
  if ($rawPid) {
    $existingProcess = Get-Process -Id ([int]$rawPid) -ErrorAction SilentlyContinue
    if ($existingProcess) {
      Stop-Process -Id $existingProcess.Id -Force
      Start-Sleep -Seconds 1
    }
  }

  Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
}

function Start-ManagedProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [Parameter(Mandatory = $true)]
    [string[]]$ArgumentList,
    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory,
    [hashtable]$EnvironmentVariables = @{}
  )

  $pidPath = Join-Path $runtimeDir "$Name.pid"
  if (Test-Path $pidPath) {
    $rawPid = Get-Content $pidPath -ErrorAction SilentlyContinue
    if ($rawPid) {
      $existingProcess = Get-Process -Id ([int]$rawPid) -ErrorAction SilentlyContinue
      if ($existingProcess) {
        Write-Host "$Name is already running with PID $($existingProcess.Id)."
        return
      }
    }
    Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
  }

  $stdoutPath = Join-Path $runtimeDir "$Name.stdout.log"
  $stderrPath = Join-Path $runtimeDir "$Name.stderr.log"
  foreach ($logPath in @($stdoutPath, $stderrPath)) {
    if (Test-Path $logPath) {
      Remove-Item $logPath -Force -ErrorAction SilentlyContinue
    }
  }

  $launcherPath = Join-Path $runtimeDir "$Name.launcher.ps1"
  $scriptLines = @(
    '$ErrorActionPreference = "Stop"',
    "Set-Location '$($WorkingDirectory.Replace("'", "''"))'"
  )

  foreach ($entry in $EnvironmentVariables.GetEnumerator()) {
    $escapedValue = [string]$entry.Value
    $scriptLines += "`$env:$($entry.Key) = '$($escapedValue.Replace("'", "''"))'"
  }

  $escapedFilePath = $FilePath.Replace("'", "''")
  $escapedArguments = $ArgumentList | ForEach-Object { "'$($_.Replace("'", "''"))'" }
  $scriptLines += "& '$escapedFilePath' $($escapedArguments -join ' ')"

  Set-Content -Path $launcherPath -Value ($scriptLines -join [Environment]::NewLine)

  $process = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $launcherPath) `
    -WorkingDirectory $WorkingDirectory `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -WindowStyle Hidden `
    -PassThru

  Set-Content -Path $pidPath -Value $process.Id
  Write-Host "Started $Name with PID $($process.Id)."
}

$dependencyServices = @(
  "postgres",
  "redis",
  "minio",
  "elasticsearch",
  "temporal",
  "temporal-ui",
  "otel-collector"
)

if (-not $SkipWorker) {
  $dependencyServices += "worker"
}

Write-Host "Starting RAGPilot dependency services in Docker..."
docker compose -f $composeFile up -d $dependencyServices

Write-Host "Stopping Docker web/api services to free stable host ports..."
docker compose -f $composeFile stop web api | Out-Null

Stop-ManagedProcess -Name "RAGPilot-web-stable"
Stop-ManagedProcess -Name "RAGPilot-api-stable"

$apiEnv = @{
  POSTGRES_HOST                      = "localhost"
  POSTGRES_PORT                      = "5433"
  POSTGRES_DB                        = "ragpilot"
  POSTGRES_USER                      = "ragpilot"
  POSTGRES_PASSWORD                  = "ragpilot"
  REDIS_URL                          = "redis://localhost:6380/0"
  TEMPORAL_ADDRESS                   = "localhost:7234"
  TEMPORAL_NAMESPACE                 = "default"
  TEMPORAL_TASK_QUEUE                = "ragpilot-ingestion"
  MINIO_ENDPOINT                     = "http://127.0.0.1:9002"
  MINIO_ROOT_USER                    = "ragpilot"
  MINIO_ROOT_PASSWORD                = "ragpilot123"
  MINIO_BUCKET                       = "ragpilot-documents"
  RETRIEVAL_ENGINE                   = "native"
  AGENT_RUNTIME_ENGINE               = "langgraph_pilot"
  CHAT_MODEL_PROVIDER                = "deterministic"
  CHAT_MODEL_NAME                    = "ragpilot-grounded-template"
  CHAT_MODEL_REQUEST_TIMEOUT_SECONDS = "180"
  CORS_ALLOWED_ORIGINS               = "http://127.0.0.1:3001,http://localhost:3001"
}

Start-ManagedProcess `
  -Name "RAGPilot-api-stable" `
  -FilePath (Join-Path $repoRoot "apps\api\.venv\Scripts\python.exe") `
  -ArgumentList @("-m", "uvicorn", "ragpilot_api.main:app", "--host", "127.0.0.1", "--port", "18000") `
  -WorkingDirectory (Join-Path $repoRoot "apps\api") `
  -EnvironmentVariables $apiEnv

Start-ManagedProcess `
  -Name "RAGPilot-web-stable" `
  -FilePath "npm.cmd" `
  -ArgumentList @("--workspace", "@ragpilot/web", "run", "serve:stable") `
  -WorkingDirectory $repoRoot `
  -EnvironmentVariables @{
    NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:18000"
  }

Write-Host ""
Write-Host "Stable mode is starting:"
Write-Host "- Web: http://127.0.0.1:3001"
Write-Host "- API: http://127.0.0.1:18000/api/v1/health"
Write-Host "- Logs: $runtimeDir"
