param(
    [string]$ApiBaseUrl = "http://localhost:8000",
    [string]$TempoBaseUrl = "http://localhost:3200",
    [string]$PrometheusBaseUrl = "http://localhost:9090",
    [string]$GrafanaBaseUrl = "http://localhost:3001",
    [string]$GrafanaUser = "admin",
    [string]$GrafanaPassword = "ragpilot-observability"
)

$ErrorActionPreference = "Stop"

$health = Invoke-WebRequest -UseBasicParsing "$ApiBaseUrl/api/v1/health" -TimeoutSec 20
$traceparent = $health.Headers["traceparent"]
if ($health.StatusCode -ne 200 -or $traceparent -notmatch '^00-([0-9a-f]{32})-[0-9a-f]{16}-01$') {
    throw "API health did not return a sampled W3C traceparent"
}
$traceId = $Matches[1]
Start-Sleep -Seconds 8
$trace = Invoke-WebRequest -UseBasicParsing "$TempoBaseUrl/api/traces/$traceId" -TimeoutSec 20
if ($trace.StatusCode -ne 200) { throw "Tempo did not return trace $traceId" }

$targets = $null
for ($attempt = 1; $attempt -le 10; $attempt++) {
    $targets = Invoke-RestMethod "$PrometheusBaseUrl/api/v1/targets" -TimeoutSec 20
    if (@($targets.data.activeTargets | Where-Object health -eq "up").Count -ge 1) { break }
    Start-Sleep -Seconds 3
}
if (@($targets.data.activeTargets | Where-Object health -eq "up").Count -lt 1) {
    throw "Prometheus has no healthy RagPilot target"
}
$rules = Invoke-RestMethod "$PrometheusBaseUrl/api/v1/rules" -TimeoutSec 20
$unhealthyRules = $rules.data.groups.rules | Where-Object health -ne "ok"
if ($unhealthyRules) { throw "Prometheus contains unhealthy alert rules" }

$basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${GrafanaUser}:${GrafanaPassword}"))
$dashboards = $null
for ($attempt = 1; $attempt -le 10; $attempt++) {
    try {
        $dashboards = Invoke-RestMethod -Headers @{ Authorization = "Basic $basic" } "$GrafanaBaseUrl/api/search?query=RagPilot" -TimeoutSec 20
        if ($dashboards | Where-Object uid -eq "ragpilot-runtime") { break }
    } catch {
        if ($attempt -eq 10) { throw }
    }
    Start-Sleep -Seconds 3
}
if (-not ($dashboards | Where-Object uid -eq "ragpilot-runtime")) {
    throw "Provisioned RagPilot Grafana dashboard was not found"
}

[pscustomobject]@{
    api = "healthy"
    trace_id = $traceId
    tempo = "queryable"
    prometheus = "scraping"
    alert_rules = @($rules.data.groups.rules).Count
    grafana_dashboard = "ragpilot-runtime"
}
