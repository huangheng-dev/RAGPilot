param([string]$OutputDirectory = "backups")
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$target = Join-Path $root (Join-Path $OutputDirectory (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $target -Force | Out-Null
$compose = Join-Path $root "infra\docker\compose.yaml"
docker compose -f $compose exec -T postgres pg_dump -U ragpilot -d ragpilot -Fc > (Join-Path $target "postgres.dump")
docker run --rm --volumes-from ragpilot-minio-1 alpine:3.20 tar -C /data -czf - . > (Join-Path $target "minio-data.tar.gz")
if ((Get-Item (Join-Path $target "postgres.dump")).Length -eq 0) { throw "PostgreSQL backup is empty" }
if ((Get-Item (Join-Path $target "minio-data.tar.gz")).Length -eq 0) { throw "MinIO backup is empty" }
Copy-Item (Join-Path $root "infra\k8s\configmap.yaml") (Join-Path $target "configmap.yaml")
$manifest = Get-ChildItem $target -File | ForEach-Object { "{0}  {1}" -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower(), $_.Name }
$manifest | Set-Content (Join-Path $target "SHA256SUMS")
Write-Host "Backup completed: $target"
