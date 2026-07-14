param([Parameter(Mandatory=$true)][string]$BackupDirectory)
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$backup = Resolve-Path $BackupDirectory
$dump = Join-Path $backup "postgres.dump"
if (-not (Test-Path $dump)) { throw "postgres.dump not found in backup directory" }
$compose = Join-Path $root "infra\docker\compose.yaml"
$drillDb = "ragpilot_restore_drill"
docker compose -f $compose exec -T postgres dropdb -U ragpilot --if-exists $drillDb
docker compose -f $compose exec -T postgres createdb -U ragpilot $drillDb
Get-Content -Raw -AsByteStream $dump | docker compose -f $compose exec -T postgres pg_restore -U ragpilot -d $drillDb --no-owner --no-privileges
$tableCount = docker compose -f $compose exec -T postgres psql -U ragpilot -d $drillDb -Atc "select count(*) from information_schema.tables where table_schema='public';"
$migration = docker compose -f $compose exec -T postgres psql -U ragpilot -d $drillDb -Atc "select version_num from alembic_version;"
if ([int]$tableCount -lt 20) { throw "Restore validation failed: only $tableCount public tables" }
docker compose -f $compose exec -T postgres dropdb -U ragpilot $drillDb
Write-Host "Restore drill passed: tables=$tableCount migration=$migration"
