$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $repoRoot

$scanTargets = @(
  "README.md",
  ".env.example",
  "CONTRIBUTING.md",
  "SECURITY.md",
  ".github",
  "apps/api/ragpilot_api",
  "apps/web/app",
  "apps/web/components",
  "apps/web/lib",
  "apps/web/messages",
  "docs",
  "infra",
  "packages"
) | Where-Object { Test-Path $_ }

$pattern = '(OPENAI_API_KEY|ANTHROPIC_API_KEY|AZURE_OPENAI|SECRET_KEY|JWT_SECRET|PRIVATE KEY|BEGIN RSA|BEGIN OPENSSH|sk-[A-Za-z0-9_-]{10,})'

Write-Host "Running RAGPilot secret scan..."

$arguments = @(
  "-n",
  "--hidden",
  "-g", "*.py",
  "-g", "*.ts",
  "-g", "*.tsx",
  "-g", "*.js",
  "-g", "*.json",
  "-g", "*.toml",
  "-g", "*.yaml",
  "-g", "*.yml",
  "-g", "*.md",
  "-g", "*.env*",
  "-g", "!node_modules/**",
  "-g", "!.next/**",
  "-g", "!dist/**",
  "-g", "!output/**",
  "-g", "!logs/**",
  "-g", "!.logs/**",
  "-g", "!work/**",
  "-g", "!tmp/**",
  "-g", "!.venv/**",
  "-g", "!**/__pycache__/**",
  $pattern
) + $scanTargets

$scanOutput = & rg @arguments 2>$null
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
  Write-Host ""
  Write-Host "Potential sensitive matches found:" -ForegroundColor Yellow
  $scanOutput | ForEach-Object { Write-Host $_ }
  exit 1
}

if ($exitCode -eq 1) {
  Write-Host "No sensitive key patterns found in tracked source and documentation scope." -ForegroundColor Green
  exit 0
}

Write-Error "Secret scan failed to run correctly."
