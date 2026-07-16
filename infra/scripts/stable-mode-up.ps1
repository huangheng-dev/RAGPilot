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

function Read-DotEnv {
  param([string]$Path)

  $values = @{}
  if (-not (Test-Path $Path)) {
    return $values
  }
  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }
    if ($trimmed -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      $value = $Matches[2].Trim()
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      $values[$Matches[1]] = $value
    }
  }
  return $values
}

function Wait-TcpPort {
  param(
    [string]$HostName,
    [int]$Port,
    [string]$Description,
    [int]$TimeoutSeconds = 120
  )

  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
      $connectTask = $client.ConnectAsync($HostName, $Port)
      if ($connectTask.Wait(1000) -and $client.Connected) {
        Write-Host "$Description is reachable on ${HostName}:$Port."
        return
      }
    } catch {
      # The dependency is still starting.
    } finally {
      $client.Dispose()
    }
    Start-Sleep -Seconds 2
  }
  throw "$Description did not become reachable on ${HostName}:$Port within $TimeoutSeconds seconds."
}

function Wait-TemporalReady {
  param(
    [string]$PythonCommand,
    [string]$Address,
    [int]$TimeoutSeconds = 180
  )

  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  $previousProbeAddress = $env:RAGPILOT_TEMPORAL_PROBE_ADDRESS
  try {
    $env:RAGPILOT_TEMPORAL_PROBE_ADDRESS = $Address
    while ([DateTime]::UtcNow -lt $deadline) {
      $probeCode = "import asyncio, os; from temporalio.client import Client; asyncio.run(asyncio.wait_for(Client.connect(os.environ['RAGPILOT_TEMPORAL_PROBE_ADDRESS']), timeout=5))"
      $probeProcess = Start-Process `
        -FilePath $PythonCommand `
        -ArgumentList @("-c", "`"$probeCode`"") `
        -WindowStyle Hidden `
        -Wait `
        -PassThru
      if ($probeProcess.ExitCode -eq 0) {
        Write-Host "Temporal SDK handshake succeeded at $Address."
        return
      }
      Start-Sleep -Seconds 3
    }
  } finally {
    $env:RAGPILOT_TEMPORAL_PROBE_ADDRESS = $previousProbeAddress
  }
  throw "Temporal did not complete its SDK handshake at $Address."
}

function Wait-HttpEndpoint {
  param(
    [string]$Url,
    [string]$Description,
    [int]$TimeoutSeconds = 180
  )

  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        Write-Host "$Description is ready at $Url."
        return
      }
    } catch {
      # The managed process is still building or starting.
    }
    Start-Sleep -Seconds 2
  }
  throw "$Description did not become ready at $Url within $TimeoutSeconds seconds."
}

function Ensure-WebRuntime {
  if (Test-Path (Join-Path $repoRoot "node_modules")) {
    return
  }
  Write-Host "Installing repository Node.js dependencies..." -ForegroundColor Cyan
  & npm install
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to install repository Node.js dependencies."
  }
}

function Get-Sha256Hex {
  param([Parameter(Mandatory = $true)][string]$Path)

  $resolvedPath = (Resolve-Path $Path).Path
  $stream = [System.IO.File]::OpenRead($resolvedPath)
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([System.BitConverter]::ToString($sha256.ComputeHash($stream))).Replace("-", "")
  } finally {
    $sha256.Dispose()
    $stream.Dispose()
  }
}

function Ensure-ApiRuntime {
  $apiRoot = Join-Path $repoRoot "apps\api"
  $venvRoot = Join-Path $apiRoot ".venv"
  $apiPython = Join-Path $venvRoot "Scripts\python.exe"
  $createdRuntime = $false
  if (-not (Test-Path $apiPython)) {
    $pythonCommand = Get-Command python -ErrorAction Stop
    Write-Host "Creating API virtual environment..." -ForegroundColor Cyan
    & $pythonCommand.Source -m venv $venvRoot
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to create the API virtual environment."
    }
    $createdRuntime = $true
  }

  $fingerprintInputs = @(
    (Join-Path $apiRoot "pyproject.toml")
    (Join-Path $apiRoot "uv.lock")
  )
  $fingerprint = ($fingerprintInputs | ForEach-Object { Get-Sha256Hex $_ }) -join "-"
  $fingerprintPath = Join-Path $runtimeDir "api-dependencies.sha256"
  $installedFingerprint = if (Test-Path $fingerprintPath) { (Get-Content $fingerprintPath -Raw).Trim() } else { "" }
  $runtimeImportsPass = $false
  if (-not $createdRuntime) {
    & $apiPython -c "import alembic, fastapi, langgraph, llama_index.core, ragpilot_api" *> $null
    $runtimeImportsPass = $LASTEXITCODE -eq 0
  }

  if ($createdRuntime -or -not $runtimeImportsPass -or $installedFingerprint -ne $fingerprint) {
    Write-Host "Installing API runtime dependencies..." -ForegroundColor Cyan
    & $apiPython -m pip install --upgrade pip | Out-Host
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to upgrade pip in the API virtual environment."
    }
    $installTarget = "$apiRoot[retrieval-llamaindex,agent-langgraph]"
    & $apiPython -m pip install -e $installTarget | Out-Host
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to install API runtime dependencies."
    }
    Set-Content -Path $fingerprintPath -Value $fingerprint
  }
  return $apiPython
}

function Invoke-ApiMigrations {
  param(
    [string]$ApiPython,
    [hashtable]$Environment,
    [int]$PostgresPort
  )

  $migrationEnvironment = @{
    POSTGRES_HOST     = "localhost"
    POSTGRES_PORT     = [string]$PostgresPort
    POSTGRES_DB       = if ($Environment.ContainsKey("POSTGRES_DB")) { $Environment["POSTGRES_DB"] } else { "ragpilot" }
    POSTGRES_USER     = if ($Environment.ContainsKey("POSTGRES_USER")) { $Environment["POSTGRES_USER"] } else { "ragpilot" }
    POSTGRES_PASSWORD = if ($Environment.ContainsKey("POSTGRES_PASSWORD")) { $Environment["POSTGRES_PASSWORD"] } else { "ragpilot" }
  }
  $previousValues = @{}
  foreach ($entry in $migrationEnvironment.GetEnumerator()) {
    $previousValues[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, "Process")
    [Environment]::SetEnvironmentVariable($entry.Key, [string]$entry.Value, "Process")
  }
  try {
    Write-Host "Applying API database migrations..." -ForegroundColor Cyan
    Push-Location (Join-Path $repoRoot "apps\api")
    & $ApiPython -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) {
      throw "API database migration failed."
    }
  } finally {
    Pop-Location
    foreach ($entry in $previousValues.GetEnumerator()) {
      [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process")
    }
  }
}

$rootEnvPath = Join-Path $repoRoot ".env"
if (-not (Test-Path $rootEnvPath)) {
  Copy-Item (Join-Path $repoRoot ".env.example") $rootEnvPath
  Write-Host "Created local .env from .env.example."
}
$rootEnvironment = Read-DotEnv -Path $rootEnvPath
$postgresPort = if ($rootEnvironment.ContainsKey("RAGPILOT_POSTGRES_PORT")) { [int]$rootEnvironment["RAGPILOT_POSTGRES_PORT"] } else { 5432 }
$redisPort = if ($rootEnvironment.ContainsKey("RAGPILOT_REDIS_PORT")) { [int]$rootEnvironment["RAGPILOT_REDIS_PORT"] } else { 6379 }
$minioPort = if ($rootEnvironment.ContainsKey("RAGPILOT_MINIO_API_PORT")) { [int]$rootEnvironment["RAGPILOT_MINIO_API_PORT"] } else { 9000 }
$elasticsearchPort = if ($rootEnvironment.ContainsKey("RAGPILOT_ELASTICSEARCH_PORT")) { [int]$rootEnvironment["RAGPILOT_ELASTICSEARCH_PORT"] } else { 9200 }
$temporalPort = if ($rootEnvironment.ContainsKey("RAGPILOT_TEMPORAL_PORT")) { [int]$rootEnvironment["RAGPILOT_TEMPORAL_PORT"] } else { 7233 }
$otelGrpcPort = if ($rootEnvironment.ContainsKey("RAGPILOT_OTEL_GRPC_PORT")) { [int]$rootEnvironment["RAGPILOT_OTEL_GRPC_PORT"] } else { 4317 }
$apiPort = if ($rootEnvironment.ContainsKey("RAGPILOT_API_PORT")) { [int]$rootEnvironment["RAGPILOT_API_PORT"] } else { 8000 }
$webPort = if ($rootEnvironment.ContainsKey("RAGPILOT_WEB_PORT")) { [int]$rootEnvironment["RAGPILOT_WEB_PORT"] } else { 3000 }
Ensure-WebRuntime
$apiPython = Ensure-ApiRuntime

$infrastructureServices = @(
  "postgres",
  "redis",
  "minio",
  "elasticsearch",
  "temporal",
  "temporal-ui",
  "otel-collector"
)

Write-Host "Starting RAGPilot dependency services in Docker..."
docker compose --env-file $rootEnvPath -f $composeFile up -d $infrastructureServices
if ($LASTEXITCODE -ne 0) {
  throw "Failed to start RAGPilot dependency services."
}
Wait-TcpPort -HostName "127.0.0.1" -Port $postgresPort -Description "PostgreSQL"
Wait-TcpPort -HostName "127.0.0.1" -Port $temporalPort -Description "Temporal"
Wait-TemporalReady -PythonCommand $apiPython -Address "127.0.0.1:$temporalPort"
Invoke-ApiMigrations -ApiPython $apiPython -Environment $rootEnvironment -PostgresPort $postgresPort

if (-not $SkipWorker) {
  Write-Host "Building and starting document and agent workers..."
  docker compose --env-file $rootEnvPath -f $composeFile up -d --build worker agent-worker
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to start RAGPilot workers."
  }
}

Write-Host "Stopping Docker web/api services to free stable host ports..."
docker compose --env-file $rootEnvPath -f $composeFile stop web api | Out-Null

Stop-ManagedProcess -Name "RAGPilot-web-stable"
Stop-ManagedProcess -Name "RAGPilot-api-stable"

$apiEnv = @{}
foreach ($entry in $rootEnvironment.GetEnumerator()) {
  $apiEnv[$entry.Key] = [string]$entry.Value
}
$stableApiOverrides = @{
  POSTGRES_HOST                      = "localhost"
  POSTGRES_PORT                      = [string]$postgresPort
  POSTGRES_DB                        = if ($rootEnvironment.ContainsKey("POSTGRES_DB")) { $rootEnvironment["POSTGRES_DB"] } else { "ragpilot" }
  POSTGRES_USER                      = if ($rootEnvironment.ContainsKey("POSTGRES_USER")) { $rootEnvironment["POSTGRES_USER"] } else { "ragpilot" }
  POSTGRES_PASSWORD                  = if ($rootEnvironment.ContainsKey("POSTGRES_PASSWORD")) { $rootEnvironment["POSTGRES_PASSWORD"] } else { "ragpilot" }
  REDIS_URL                          = "redis://localhost:$redisPort/0"
  TEMPORAL_ADDRESS                   = "localhost:$temporalPort"
  TEMPORAL_NAMESPACE                 = "default"
  TEMPORAL_TASK_QUEUE                = "ragpilot-ingestion"
  MINIO_ENDPOINT                     = "http://127.0.0.1:$minioPort"
  MINIO_ROOT_USER                    = if ($rootEnvironment.ContainsKey("MINIO_ROOT_USER")) { $rootEnvironment["MINIO_ROOT_USER"] } else { "ragpilot" }
  MINIO_ROOT_PASSWORD                = if ($rootEnvironment.ContainsKey("MINIO_ROOT_PASSWORD")) { $rootEnvironment["MINIO_ROOT_PASSWORD"] } else { "ragpilot123" }
  MINIO_BUCKET                       = if ($rootEnvironment.ContainsKey("MINIO_BUCKET")) { $rootEnvironment["MINIO_BUCKET"] } else { "ragpilot-documents" }
  ELASTICSEARCH_URL                  = "http://127.0.0.1:$elasticsearchPort"
  ELASTICSEARCH_RETRIEVAL_ENABLED    = "true"
  OTEL_EXPORTER_OTLP_ENDPOINT        = "http://127.0.0.1:$otelGrpcPort"
  RETRIEVAL_ENGINE                   = "native"
  AGENT_RUNTIME_ENGINE               = "langgraph_pilot"
  CHAT_MODEL_PROVIDER                = "deterministic"
  CHAT_MODEL_NAME                    = "ragpilot-grounded-template"
  CHAT_MODEL_REQUEST_TIMEOUT_SECONDS = "180"
  CORS_ALLOWED_ORIGINS               = "http://127.0.0.1:$webPort,http://localhost:$webPort"
}
foreach ($entry in $stableApiOverrides.GetEnumerator()) {
  $apiEnv[$entry.Key] = [string]$entry.Value
}

Start-ManagedProcess `
  -Name "RAGPilot-api-stable" `
  -FilePath $apiPython `
  -ArgumentList @("-m", "uvicorn", "ragpilot_api.main:app", "--host", "127.0.0.1", "--port", [string]$apiPort) `
  -WorkingDirectory (Join-Path $repoRoot "apps\api") `
  -EnvironmentVariables $apiEnv

Start-ManagedProcess `
  -Name "RAGPilot-web-stable" `
  -FilePath "npm.cmd" `
  -ArgumentList @("--workspace", "@ragpilot/web", "run", "serve:stable") `
  -WorkingDirectory $repoRoot `
  -EnvironmentVariables @{
    NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:$apiPort"
    PORT = [string]$webPort
    NEXT_PUBLIC_GIT_REPOSITORY_URL = if ($rootEnvironment.ContainsKey("NEXT_PUBLIC_GIT_REPOSITORY_URL")) { $rootEnvironment["NEXT_PUBLIC_GIT_REPOSITORY_URL"] } else { "" }
  }

Wait-HttpEndpoint -Url "http://127.0.0.1:$apiPort/api/v1/health" -Description "RAGPilot API"
Wait-HttpEndpoint -Url "http://127.0.0.1:$webPort" -Description "RAGPilot Web"

Write-Host ""
Write-Host "Stable mode is starting:"
Write-Host "- Web: http://127.0.0.1:$webPort"
Write-Host "- API: http://127.0.0.1:$apiPort/api/v1/health"
if (-not $SkipWorker) {
  Write-Host "- Workers: document ingestion and agent execution"
}
Write-Host "- Logs: $runtimeDir"
