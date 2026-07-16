param(
  [string]$HealthUrl = "http://localhost:8000/api/v1/health",
  [int]$ConcurrentRequests = 20,
  [int]$RecoveryTimeoutSeconds = 60,
  [string]$EnvFile = ".env",
  [switch]$AllowNonLocalHealth
)

$ErrorActionPreference = "Stop"
$healthUri = [Uri]$HealthUrl
if (-not $AllowNonLocalHealth -and $healthUri.Host -notin @("localhost", "127.0.0.1", "::1")) {
  throw "Reliability fault injection is restricted to a local health URL unless -AllowNonLocalHealth is explicit."
}
if ($ConcurrentRequests -lt 1) { throw "ConcurrentRequests must be at least 1." }

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$compose = Join-Path $root "infra\docker\compose.yaml"
$resolvedEnvFile = if ([IO.Path]::IsPathRooted($EnvFile)) { $EnvFile } else { Join-Path $root $EnvFile }
$composeArgs = @("compose")
if (Test-Path $resolvedEnvFile) {
  $composeArgs += @("--env-file", $resolvedEnvFile)
}
$composeArgs += @("-f", $compose)

function Get-ApiHealth {
  Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 10
}

function Wait-HealthCondition {
  param([scriptblock]$Condition, [string]$FailureMessage)
  $deadline = [DateTime]::UtcNow.AddSeconds($RecoveryTimeoutSeconds)
  do {
    try {
      $snapshot = Get-ApiHealth
      if (& $Condition $snapshot) { return $snapshot }
    } catch {
      # A dependency probe can time out briefly while the API remains live.
    }
    Start-Sleep -Seconds 2
  } while ([DateTime]::UtcNow -lt $deadline)
  throw $FailureMessage
}

$baseline = Get-ApiHealth
if ($baseline.status -ne "ok") { throw "API baseline health failed." }
if (-not $baseline.search_projection.enabled -or -not $baseline.search_projection.reachable) {
  throw "Elasticsearch projection must be enabled and reachable before the drill."
}

$elasticsearchPaused = $false
try {
  & docker @composeArgs pause elasticsearch | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Pausing Elasticsearch failed." }
  $elasticsearchPaused = $true
  $degraded = Wait-HealthCondition `
    -Condition { param($snapshot) $snapshot.status -eq "ok" -and -not $snapshot.search_projection.reachable } `
    -FailureMessage "API did not expose Elasticsearch degradation while remaining available."
  if ($degraded.status -ne "ok") { throw "API did not survive the Elasticsearch outage." }
} finally {
  if ($elasticsearchPaused) {
    & docker @composeArgs unpause elasticsearch | Out-Null
  }
}

Wait-HealthCondition `
  -Condition { param($snapshot) $snapshot.status -eq "ok" -and $snapshot.search_projection.reachable } `
  -FailureMessage "Elasticsearch projection did not recover before the timeout." | Out-Null

$redisBaseline = (& docker @composeArgs exec -T redis redis-cli ping).Trim()
if ($LASTEXITCODE -ne 0 -or $redisBaseline -ne "PONG") { throw "Redis baseline PING failed." }
$redisPaused = $false
try {
  & docker @composeArgs pause redis | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Pausing Redis failed." }
  $redisPaused = $true
  $redisDuringOutage = & docker @composeArgs exec -T redis redis-cli ping 2>$null
  if ($LASTEXITCODE -eq 0 -and (($redisDuringOutage -join "").Trim() -eq "PONG")) {
    throw "Redis remained reachable after the outage was injected."
  }
  if ((Get-ApiHealth).status -ne "ok") { throw "API did not survive the Redis outage." }
} finally {
  if ($redisPaused) {
    & docker @composeArgs unpause redis | Out-Null
  }
}

$redisRecovered = $false
$deadline = [DateTime]::UtcNow.AddSeconds($RecoveryTimeoutSeconds)
do {
  $redisPing = & docker @composeArgs exec -T redis redis-cli ping 2>$null
  if ($LASTEXITCODE -eq 0 -and (($redisPing -join "").Trim() -eq "PONG")) {
    $redisRecovered = $true
    break
  }
  Start-Sleep -Seconds 2
} while ([DateTime]::UtcNow -lt $deadline)
if (-not $redisRecovered) { throw "Redis did not recover before the timeout." }

$jobs = 1..$ConcurrentRequests | ForEach-Object {
  Start-Job { param($url) (Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 10).StatusCode } `
    -ArgumentList $HealthUrl
}
try {
  $codes = $jobs | Wait-Job | Receive-Job
  if (($codes | Where-Object { $_ -ne 200 }).Count -gt 0 -or $codes.Count -ne $ConcurrentRequests) {
    throw "Concurrent health load failed."
  }
} finally {
  $jobs | Remove-Job -Force
}

$successMessage = (
  "Reliability drill passed: load={0}, Elasticsearch degradation/recovery observed, " +
  "Redis interruption/recovery observed"
) -f $ConcurrentRequests
Write-Host $successMessage
