param(
  [string]$OutputDirectory = "backups",
  [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$outputRoot = if ([IO.Path]::IsPathRooted($OutputDirectory)) {
  [IO.Path]::GetFullPath($OutputDirectory)
} else {
  Join-Path $root $OutputDirectory
}
$target = Join-Path $outputRoot (Get-Date -Format "yyyyMMdd-HHmmss")
New-Item -ItemType Directory -Path $target -Force | Out-Null
$compose = Join-Path $root "infra\docker\compose.yaml"
$resolvedEnvFile = if ([IO.Path]::IsPathRooted($EnvFile)) { $EnvFile } else { Join-Path $root $EnvFile }
$composeArgs = @("compose")
if (Test-Path $resolvedEnvFile) {
  $composeArgs += @("--env-file", $resolvedEnvFile)
}
$composeArgs += @("-f", $compose)

$postgresContainer = ((& docker @composeArgs ps -q postgres) | Select-Object -First 1).Trim()
$minioContainer = ((& docker @composeArgs ps -q minio) | Select-Object -First 1).Trim()
if (-not $postgresContainer) { throw "PostgreSQL Compose service is not running." }
if (-not $minioContainer) { throw "MinIO Compose service is not running." }
$databaseUser = (& docker @composeArgs exec -T postgres printenv POSTGRES_USER).Trim()
$databaseName = (& docker @composeArgs exec -T postgres printenv POSTGRES_DB).Trim()
if (-not $databaseUser -or -not $databaseName) {
  throw "PostgreSQL container does not expose POSTGRES_USER and POSTGRES_DB."
}

$dump = Join-Path $target "postgres.dump"
$minioArchive = Join-Path $target "minio-data.tar.gz"
$containerDump = "/tmp/ragpilot-backup.dump"
try {
  & docker @composeArgs exec -T postgres pg_dump -U $databaseUser -d $databaseName -Fc -f $containerDump
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL pg_dump failed." }
  & docker cp "${postgresContainer}:${containerDump}" $dump
  if ($LASTEXITCODE -ne 0) { throw "Copying the PostgreSQL dump failed." }
} finally {
  & docker @composeArgs exec -T postgres rm -f $containerDump 2>$null
}

& docker run --rm --volumes-from $minioContainer -v "${target}:/backup" alpine:3.20 `
  tar -C /data -czf /backup/minio-data.tar.gz .
if ($LASTEXITCODE -ne 0) { throw "MinIO archive creation failed." }

if (-not (Test-Path $dump) -or (Get-Item $dump).Length -eq 0) {
  throw "PostgreSQL backup is empty."
}
if (-not (Test-Path $minioArchive) -or (Get-Item $minioArchive).Length -eq 0) {
  throw "MinIO backup is empty."
}

$configMap = Join-Path $root "infra\k8s\configmap.yaml"
if (-not (Test-Path $configMap)) { throw "Production ConfigMap snapshot source is missing." }
Copy-Item $configMap (Join-Path $target "configmap.yaml")
$manifest = Get-ChildItem $target -File | Sort-Object Name | ForEach-Object {
  "{0}  {1}" -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $_.Name
}
$manifest | Set-Content (Join-Path $target "SHA256SUMS") -Encoding utf8
Write-Host "Backup completed with PostgreSQL, MinIO, configuration and SHA-256 manifest: $target"
