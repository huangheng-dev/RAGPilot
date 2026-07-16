$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $repoRoot

$composeFile = Join-Path $repoRoot "infra/docker/compose.yaml"
$apiRoot = Join-Path $repoRoot "apps/api"
$apiVenv = Join-Path $apiRoot ".venv"
$apiPython = if ($IsWindows -or $env:OS -eq "Windows_NT") {
  Join-Path $apiVenv "Scripts\python.exe"
} else {
  Join-Path $apiVenv "bin/python"
}
$runtimeDir = Join-Path $repoRoot "tmp/e2e"
$e2eDatabase = "ragpilot_e2e"
$apiPort = if ($env:RAGPILOT_E2E_API_PORT) { [int]$env:RAGPILOT_E2E_API_PORT } else { 18001 }
$webPort = if ($env:RAGPILOT_E2E_WEB_PORT) { [int]$env:RAGPILOT_E2E_WEB_PORT } else { 3002 }

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

function Test-TcpPort {
  param([string]$HostName, [int]$Port)

  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync($HostName, $Port)
    return $task.Wait(1000) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Wait-TcpPort {
  param([string]$HostName, [int]$Port, [string]$Description, [int]$TimeoutSeconds = 120)

  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (Test-TcpPort -HostName $HostName -Port $Port) {
      return
    }
    Start-Sleep -Seconds 2
  }
  throw "$Description did not become reachable on ${HostName}:$Port."
}

function Wait-TemporalReady {
  param([string]$PythonCommand, [string]$Address, [int]$TimeoutSeconds = 180)

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
  param([string]$Url, [string]$Description, [int]$TimeoutSeconds = 180)

  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      # The local test process is still starting.
    }
    Start-Sleep -Seconds 2
  }
  throw "$Description did not become ready at $Url."
}

function Invoke-PostgresCommand {
  param([string]$Sql, [string]$PostgresUser)

  & docker compose -f $composeFile exec -T postgres psql -v ON_ERROR_STOP=1 -U $PostgresUser -d postgres -c $Sql
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to prepare the isolated E2E database."
  }
}

function Stop-TestProcess {
  param($Process)

  if ($null -ne $Process -and -not $Process.HasExited) {
    Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
    $Process.WaitForExit(5000) | Out-Null
  }
}

if (Test-TcpPort -HostName "127.0.0.1" -Port $apiPort) {
  throw "E2E API port $apiPort is already in use. Set RAGPILOT_E2E_API_PORT to an unused port."
}
if (Test-TcpPort -HostName "127.0.0.1" -Port $webPort) {
  throw "E2E Web port $webPort is already in use. Set RAGPILOT_E2E_WEB_PORT to an unused port."
}

$rootEnvironment = Read-DotEnv -Path (Join-Path $repoRoot ".env")
$postgresPort = if ($env:RAGPILOT_POSTGRES_PORT) {
  [int]$env:RAGPILOT_POSTGRES_PORT
} elseif ($rootEnvironment.ContainsKey("RAGPILOT_POSTGRES_PORT")) {
  [int]$rootEnvironment["RAGPILOT_POSTGRES_PORT"]
} else {
  5432
}
$temporalPort = if ($env:RAGPILOT_TEMPORAL_PORT) {
  [int]$env:RAGPILOT_TEMPORAL_PORT
} elseif ($rootEnvironment.ContainsKey("RAGPILOT_TEMPORAL_PORT")) {
  [int]$rootEnvironment["RAGPILOT_TEMPORAL_PORT"]
} else {
  7233
}
$postgresUser = if ($rootEnvironment.ContainsKey("POSTGRES_USER")) { $rootEnvironment["POSTGRES_USER"] } else { "ragpilot" }
$postgresPassword = if ($rootEnvironment.ContainsKey("POSTGRES_PASSWORD")) { $rootEnvironment["POSTGRES_PASSWORD"] } else { "ragpilot" }
$postgresWasReachable = Test-TcpPort -HostName "127.0.0.1" -Port $postgresPort
$temporalWasReachable = Test-TcpPort -HostName "127.0.0.1" -Port $temporalPort
$apiProcess = $null
$webProcess = $null
$databaseCreated = $false
$previousEnvironment = @{}

$testEnvironment = @{
  POSTGRES_HOST               = "127.0.0.1"
  POSTGRES_PORT               = [string]$postgresPort
  POSTGRES_DB                 = $e2eDatabase
  POSTGRES_USER               = $postgresUser
  POSTGRES_PASSWORD           = $postgresPassword
  TEMPORAL_ADDRESS            = "127.0.0.1:$temporalPort"
  AUTH_PRIMARY_MODE           = "password_local"
  ALLOW_LEGACY_ACTOR_HEADERS  = "false"
  ELASTICSEARCH_RETRIEVAL_ENABLED = "false"
  OTEL_ENABLED                = "false"
  CORS_ALLOWED_ORIGINS        = "http://127.0.0.1:$webPort,http://localhost:$webPort"
  NEXT_PUBLIC_API_BASE_URL    = "http://127.0.0.1:$apiPort"
  RAGPILOT_E2E_API_BASE_URL   = "http://127.0.0.1:$apiPort/api/v1"
  RAGPILOT_E2E_BASE_URL       = "http://127.0.0.1:$webPort"
  RAGPILOT_E2E_EMAIL          = if ($env:RAGPILOT_E2E_EMAIL) { $env:RAGPILOT_E2E_EMAIL } else { "admin@ragpilot.local" }
  RAGPILOT_E2E_PASSWORD       = if ($env:RAGPILOT_E2E_PASSWORD) { $env:RAGPILOT_E2E_PASSWORD } else { "RAGPilotE2E123!" }
}

$pythonLauncher = Get-Command python3 -ErrorAction SilentlyContinue
if (-not $pythonLauncher) {
  $pythonLauncher = Get-Command python -ErrorAction Stop
}
if (-not (Test-Path $apiPython)) {
  & $pythonLauncher.Source -m venv $apiVenv
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create the API E2E runtime."
  }
  & $apiPython -m pip install -e "$apiRoot[retrieval-llamaindex,agent-langgraph]"
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to install the API E2E runtime."
  }
}

try {
  Write-Host "Starting isolated E2E dependencies..." -ForegroundColor Cyan
  & docker compose -f $composeFile up -d postgres temporal
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to start PostgreSQL and Temporal for E2E tests."
  }
  Wait-TcpPort -HostName "127.0.0.1" -Port $postgresPort -Description "PostgreSQL"
  Wait-TcpPort -HostName "127.0.0.1" -Port $temporalPort -Description "Temporal"
  Wait-TemporalReady -PythonCommand $apiPython -Address "127.0.0.1:$temporalPort"

  Invoke-PostgresCommand -PostgresUser $postgresUser -Sql "DROP DATABASE IF EXISTS $e2eDatabase WITH (FORCE);"
  Invoke-PostgresCommand -PostgresUser $postgresUser -Sql "CREATE DATABASE $e2eDatabase;"
  $databaseCreated = $true

  if (-not (Test-Path (Join-Path $repoRoot "node_modules"))) {
    & npm ci
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to install Node.js dependencies for E2E tests."
    }
  }

  foreach ($entry in $testEnvironment.GetEnumerator()) {
    $previousEnvironment[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, "Process")
    [Environment]::SetEnvironmentVariable($entry.Key, [string]$entry.Value, "Process")
  }

  Write-Host "Applying migrations to the isolated E2E database..." -ForegroundColor Cyan
  Push-Location $apiRoot
  try {
    & $apiPython -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) {
      throw "E2E database migration failed."
    }
  } finally {
    Pop-Location
  }

  Write-Host "Building the Web application for the isolated E2E API..." -ForegroundColor Cyan
  & npm run web:build
  if ($LASTEXITCODE -ne 0) {
    throw "E2E Web build failed."
  }

  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
  $apiStdout = Join-Path $runtimeDir "api.stdout.log"
  $apiStderr = Join-Path $runtimeDir "api.stderr.log"
  $webStdout = Join-Path $runtimeDir "web.stdout.log"
  $webStderr = Join-Path $runtimeDir "web.stderr.log"
  foreach ($logPath in @($apiStdout, $apiStderr, $webStdout, $webStderr)) {
    Remove-Item $logPath -Force -ErrorAction SilentlyContinue
  }

  $apiProcess = Start-Process -FilePath $apiPython `
    -ArgumentList @("-m", "uvicorn", "ragpilot_api.main:app", "--host", "127.0.0.1", "--port", [string]$apiPort) `
    -WorkingDirectory $apiRoot `
    -RedirectStandardOutput $apiStdout `
    -RedirectStandardError $apiStderr `
    -PassThru

  $nodeCommand = (Get-Command node -ErrorAction Stop).Source
  $nextCli = Join-Path $repoRoot "node_modules/next/dist/bin/next"
  $webProcess = Start-Process -FilePath $nodeCommand `
    -ArgumentList @($nextCli, "start", (Join-Path $repoRoot "apps/web"), "-p", [string]$webPort) `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $webStdout `
    -RedirectStandardError $webStderr `
    -PassThru

  Wait-HttpEndpoint -Url "http://127.0.0.1:$apiPort/api/v1/health" -Description "E2E API"
  Wait-HttpEndpoint -Url "http://127.0.0.1:$webPort" -Description "E2E Web"

  $playwrightInstallArgs = @("--workspace", "@ragpilot/web", "exec", "--", "playwright", "install")
  if ($env:CI) {
    $playwrightInstallArgs += "--with-deps"
  }
  $playwrightInstallArgs += "chromium"
  & npm @playwrightInstallArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to install the Playwright Chromium runtime."
  }

  Write-Host "Running authenticated browser E2E tests..." -ForegroundColor Cyan
  & npm --workspace @ragpilot/web run test:e2e
  if ($LASTEXITCODE -ne 0) {
    throw "Authenticated browser E2E tests failed. Logs are under $runtimeDir."
  }
} catch {
  foreach ($logPath in @($apiStderr, $webStderr)) {
    if ($logPath -and (Test-Path $logPath)) {
      Write-Host "Recent output from $logPath" -ForegroundColor Yellow
      Get-Content $logPath -Tail 80
    }
  }
  throw
} finally {
  Stop-TestProcess -Process $webProcess
  Stop-TestProcess -Process $apiProcess

  foreach ($entry in $previousEnvironment.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process")
  }

  if ($databaseCreated -and (Test-TcpPort -HostName "127.0.0.1" -Port $postgresPort)) {
    try {
      Invoke-PostgresCommand -PostgresUser $postgresUser -Sql "DROP DATABASE IF EXISTS $e2eDatabase WITH (FORCE);"
    } catch {
      Write-Warning "Unable to remove the isolated E2E database: $($_.Exception.Message)"
    }
  }
  if (-not $temporalWasReachable) {
    & docker compose -f $composeFile stop temporal | Out-Host
  }
  if (-not $postgresWasReachable) {
    & docker compose -f $composeFile stop postgres | Out-Host
  }
}

Write-Host "Authenticated browser E2E tests passed." -ForegroundColor Green
