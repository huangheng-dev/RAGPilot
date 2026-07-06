$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $repoRoot

python "infra/scripts/secret_scan.py"
exit $LASTEXITCODE
