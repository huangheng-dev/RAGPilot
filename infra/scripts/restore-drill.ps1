param(
  [Parameter(Mandatory = $true)][string]$BackupDirectory,
  [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$backup = Resolve-Path $BackupDirectory
$dump = Join-Path $backup "postgres.dump"
$minioArchive = Join-Path $backup "minio-data.tar.gz"
$manifestPath = Join-Path $backup "SHA256SUMS"
foreach ($requiredFile in @($dump, $minioArchive, $manifestPath)) {
  if (-not (Test-Path $requiredFile)) { throw "Required backup artifact is missing: $requiredFile" }
}

$manifestEntries = Get-Content $manifestPath | Where-Object { $_.Trim() }
if (-not $manifestEntries) { throw "SHA256SUMS is empty." }
foreach ($entry in $manifestEntries) {
  if ($entry -notmatch '^([0-9a-fA-F]{64})\s\s(.+)$') {
    throw "Invalid SHA256SUMS entry: $entry"
  }
  $expectedHash = $Matches[1].ToLowerInvariant()
  $fileName = $Matches[2]
  if ([IO.Path]::GetFileName($fileName) -ne $fileName) {
    throw "SHA256SUMS may only contain files from the backup directory."
  }
  $artifact = Join-Path $backup $fileName
  if (-not (Test-Path $artifact -PathType Leaf)) { throw "Manifest artifact is missing: $fileName" }
  $actualHash = (Get-FileHash $artifact -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne $expectedHash) { throw "SHA-256 validation failed for $fileName" }
}

$compose = Join-Path $root "infra\docker\compose.yaml"
$resolvedEnvFile = if ([IO.Path]::IsPathRooted($EnvFile)) { $EnvFile } else { Join-Path $root $EnvFile }
$composeArgs = @("compose")
if (Test-Path $resolvedEnvFile) {
  $composeArgs += @("--env-file", $resolvedEnvFile)
}
$composeArgs += @("-f", $compose)
$postgresContainer = ((& docker @composeArgs ps -q postgres) | Select-Object -First 1).Trim()
if (-not $postgresContainer) { throw "PostgreSQL Compose service is not running." }
$databaseUser = (& docker @composeArgs exec -T postgres printenv POSTGRES_USER).Trim()
$databaseName = (& docker @composeArgs exec -T postgres printenv POSTGRES_DB).Trim()
if (-not $databaseUser -or -not $databaseName) {
  throw "PostgreSQL container does not expose POSTGRES_USER and POSTGRES_DB."
}

$suffix = "{0}-{1}" -f (Get-Date -Format "yyyyMMddHHmmss"), $PID
$drillDb = "ragpilot_restore_drill_" + $suffix.Replace("-", "_")
$containerDump = "/tmp/${drillDb}.dump"
$restoreVolume = "ragpilot-restore-drill-$suffix"
$databaseCreated = $false
$volumeCreated = $false
try {
  $sourceTableCount = (& docker @composeArgs exec -T postgres psql -U $databaseUser -d $databaseName -Atc `
    "select count(*) from information_schema.tables where table_schema='public';").Trim()
  $sourceMigration = (& docker @composeArgs exec -T postgres psql -U $databaseUser -d $databaseName -Atc `
    "select version_num from alembic_version;").Trim()
  if ($LASTEXITCODE -ne 0 -or -not $sourceMigration) {
    throw "Unable to read the source database schema evidence."
  }

  & docker @composeArgs exec -T postgres createdb -U $databaseUser $drillDb
  if ($LASTEXITCODE -ne 0) { throw "Creating the isolated restore database failed." }
  $databaseCreated = $true
  & docker cp $dump "${postgresContainer}:${containerDump}"
  if ($LASTEXITCODE -ne 0) { throw "Copying the dump into PostgreSQL failed." }
  & docker @composeArgs exec -T postgres pg_restore -U $databaseUser -d $drillDb `
    --no-owner --no-privileges $containerDump
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL restore failed." }

  $restoredTableCount = (& docker @composeArgs exec -T postgres psql -U $databaseUser -d $drillDb -Atc `
    "select count(*) from information_schema.tables where table_schema='public';").Trim()
  $restoredMigration = (& docker @composeArgs exec -T postgres psql -U $databaseUser -d $drillDb -Atc `
    "select version_num from alembic_version;").Trim()
  if ([int]$restoredTableCount -ne [int]$sourceTableCount) {
    throw "Restore table count mismatch: restored=$restoredTableCount source=$sourceTableCount"
  }
  if ($restoredMigration -ne $sourceMigration) {
    throw "Restore Alembic mismatch: restored=$restoredMigration source=$sourceMigration"
  }

  & docker volume create $restoreVolume | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Creating the isolated MinIO restore volume failed." }
  $volumeCreated = $true
  & docker run --rm -v "${backup}:/backup:ro" -v "${restoreVolume}:/restore" alpine:3.20 `
    tar -C /restore -xzf /backup/minio-data.tar.gz
  if ($LASTEXITCODE -ne 0) { throw "MinIO archive restore failed." }
  $restoredObjectFileCount = (& docker run --rm -v "${restoreVolume}:/restore:ro" alpine:3.20 `
    sh -c "find /restore -type f | wc -l").Trim()

  Write-Host (
    "Restore drill passed: tables={0}, migration={1}, MinIO files={2}, hashes=verified" -f `
      $restoredTableCount, $restoredMigration, $restoredObjectFileCount
  )
} finally {
  & docker @composeArgs exec -T postgres rm -f $containerDump 2>$null
  if ($databaseCreated) {
    & docker @composeArgs exec -T postgres dropdb -U $databaseUser --if-exists $drillDb 2>$null
  }
  if ($volumeCreated) {
    & docker volume rm -f $restoreVolume 2>$null | Out-Null
  }
}
