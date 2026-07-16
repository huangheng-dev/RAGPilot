$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$compose = Join-Path $root "infra\docker\compose.yaml"
$health = "http://localhost:8000/api/v1/health"
if ((Invoke-WebRequest -UseBasicParsing $health).StatusCode -ne 200) { throw "API baseline health failed" }
docker compose -f $compose pause elasticsearch | Out-Null
try {
  if ((Invoke-WebRequest -UseBasicParsing $health).StatusCode -ne 200) { throw "API did not survive Elasticsearch outage" }
} finally { docker compose -f $compose unpause elasticsearch | Out-Null }
docker compose -f $compose pause redis | Out-Null
try {
  if ((Invoke-WebRequest -UseBasicParsing $health).StatusCode -ne 200) { throw "API did not survive Redis outage" }
} finally { docker compose -f $compose unpause redis | Out-Null }
$jobs = 1..20 | ForEach-Object { Start-Job { param($url) (Invoke-WebRequest -UseBasicParsing $url).StatusCode } -ArgumentList $health }
$codes = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job
if (($codes | Where-Object { $_ -ne 200 }).Count -gt 0) { throw "Concurrent health load failed" }
Write-Host "Reliability drill passed: load=20, Elasticsearch outage recovered, Redis outage recovered"
