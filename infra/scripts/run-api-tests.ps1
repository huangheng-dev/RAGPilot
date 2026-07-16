$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $repoRoot

$apiRoot = Join-Path (Join-Path $repoRoot "apps") "api"
$venvRoot = Join-Path $apiRoot ".venv"
$venvPython = if ($IsWindows -or $env:OS -eq "Windows_NT") {
  Join-Path $venvRoot "Scripts\python.exe"
} else {
  Join-Path $venvRoot "bin/python"
}

$pythonLauncherCommand = Get-Command python3 -ErrorAction SilentlyContinue
if (-not $pythonLauncherCommand) {
  $pythonLauncherCommand = Get-Command python -ErrorAction Stop
}
$pythonLauncher = $pythonLauncherCommand.Source

if (-not (Test-Path $venvPython)) {
  Write-Host "Creating API virtual environment..." -ForegroundColor Cyan
  & $pythonLauncher -m venv $venvRoot
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create API virtual environment."
  }
}

$pythonCommand = $venvPython
$apiInstallTarget = "$apiRoot[retrieval-llamaindex,agent-langgraph]"
$composeFile = Join-Path (Join-Path $repoRoot "infra") "docker/compose.yaml"

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
  param([string]$HostName, [int]$Port, [int]$TimeoutSeconds = 120)

  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (Test-TcpPort -HostName $HostName -Port $Port) {
      return
    }
    Start-Sleep -Seconds 2
  }
  throw "Temporal test dependency did not become reachable on ${HostName}:$Port."
}

function Test-TemporalReady {
  param([string]$PythonCommand, [string]$Address)

  $previousProbeAddress = $env:RAGPILOT_TEMPORAL_PROBE_ADDRESS
  try {
    $env:RAGPILOT_TEMPORAL_PROBE_ADDRESS = $Address
    & $PythonCommand -c "import asyncio, os; from temporalio.client import Client; asyncio.run(asyncio.wait_for(Client.connect(os.environ['RAGPILOT_TEMPORAL_PROBE_ADDRESS']), timeout=5))" *> $null
    return $LASTEXITCODE -eq 0
  } finally {
    $env:RAGPILOT_TEMPORAL_PROBE_ADDRESS = $previousProbeAddress
  }
}

function Wait-TemporalReady {
  param([string]$PythonCommand, [string]$Address, [int]$TimeoutSeconds = 180)

  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (Test-TemporalReady -PythonCommand $PythonCommand -Address $Address) {
      Write-Host "Temporal SDK handshake succeeded at $Address."
      return
    }
    Start-Sleep -Seconds 3
  }
  throw "Temporal did not complete its SDK handshake at $Address."
}

Write-Host "Installing RAGPilot API test dependencies..." -ForegroundColor Cyan
& $pythonCommand -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) {
  throw "Failed to upgrade pip."
}

& $pythonCommand -m pip install -e $apiInstallTarget
if ($LASTEXITCODE -ne 0) {
  throw "Failed to install API package."
}

& $pythonCommand -m pip install pytest
if ($LASTEXITCODE -ne 0) {
  throw "Failed to install pytest."
}

Write-Host "Running RAGPilot API tests..." -ForegroundColor Cyan
Write-Host "Python runtime: $pythonCommand"

$temporalPort = if ($env:RAGPILOT_TEMPORAL_PORT) { [int]$env:RAGPILOT_TEMPORAL_PORT } else { 7233 }
$temporalAddress = if ($env:TEMPORAL_TEST_ADDRESS) { $env:TEMPORAL_TEST_ADDRESS } else { "localhost:$temporalPort" }
$separatorIndex = $temporalAddress.LastIndexOf(":")
if ($separatorIndex -lt 1) {
  throw "TEMPORAL_TEST_ADDRESS must use the host:port form."
}
$temporalHost = $temporalAddress.Substring(0, $separatorIndex).Trim("[", "]")
$temporalTestPort = [int]$temporalAddress.Substring($separatorIndex + 1)
$temporalWasReady = Test-TemporalReady -PythonCommand $pythonCommand -Address $temporalAddress
$postgresHost = "localhost"
$postgresPort = if ($env:RAGPILOT_POSTGRES_PORT) { [int]$env:RAGPILOT_POSTGRES_PORT } else { 5432 }
$postgresWasReady = Test-TcpPort -HostName $postgresHost -Port $postgresPort
$startedLocalDependencies = $false

if (-not $temporalWasReady -or -not $postgresWasReady) {
  if ($temporalHost -notin @("localhost", "127.0.0.1", "::1")) {
    throw "The configured Temporal test dependency is not reachable at $temporalAddress."
  }
  Write-Host "Starting isolated API-test dependencies with Docker Compose..." -ForegroundColor Cyan
  & docker compose -f $composeFile up -d postgres temporal
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to start PostgreSQL and Temporal for API tests."
  }
  $startedLocalDependencies = $true
}

$previousTemporalTestAddress = $env:TEMPORAL_TEST_ADDRESS
$previousOtelEnabled = $env:OTEL_ENABLED
$previousPostgresHost = $env:POSTGRES_HOST
$previousPostgresPort = $env:POSTGRES_PORT
$testExitCode = 1
try {
  Wait-TcpPort -HostName $temporalHost -Port $temporalTestPort
  Wait-TemporalReady -PythonCommand $pythonCommand -Address $temporalAddress
  Wait-TcpPort -HostName $postgresHost -Port $postgresPort
  $env:TEMPORAL_TEST_ADDRESS = $temporalAddress
  $env:POSTGRES_HOST = $postgresHost
  $env:POSTGRES_PORT = "$postgresPort"
  # Tests must not inherit a production/container OTLP endpoint from .env.
  # Exporter retry threads can outlive pytest and turn a passing suite into a
  # noisy, non-zero process on host-managed Windows runs.
  $env:OTEL_ENABLED = "false"
  # Run from the package root so application settings do not implicitly load
  # the repository's deployment .env and change test defaults.
  Push-Location $apiRoot
  try {
    & $pythonCommand -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) {
      throw "API test database migration failed."
    }
  } finally {
    Pop-Location
  }

  & $pythonCommand -m ragpilot_api.commands.retrieval_contract_gate "packages/evals/retrieval/core-contract-v1.json"
  if ($LASTEXITCODE -ne 0) {
    throw "Versioned retrieval fixture contract gate failed."
  }

  & $pythonCommand -m ragpilot_api.commands.retrieval_database_gate "packages/evals/retrieval/database-contract-v1.json"
  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL/pgvector retrieval regression gate failed."
  }

  & $pythonCommand -m ragpilot_api.commands.retrieval_framework_gate "packages/evals/retrieval/database-contract-v1.json"
  if ($LASTEXITCODE -ne 0) {
    throw "Native versus LlamaIndex retrieval comparison gate failed."
  }

  & $pythonCommand -m ragpilot_api.commands.agent_runtime_framework_gate "packages/evals/agents/runtime-contract-v1.json"
  if ($LASTEXITCODE -ne 0) {
    throw "Native versus LangGraph agent runtime comparison gate failed."
  }

  Push-Location $apiRoot
  try {
    & $pythonCommand -m pytest tests
    $testExitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
} finally {
  $env:TEMPORAL_TEST_ADDRESS = $previousTemporalTestAddress
  $env:OTEL_ENABLED = $previousOtelEnabled
  $env:POSTGRES_HOST = $previousPostgresHost
  $env:POSTGRES_PORT = $previousPostgresPort
  if ($startedLocalDependencies) {
    & docker compose -f $composeFile stop temporal postgres | Out-Host
  }
}
exit $testExitCode
