$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $repoRoot

$targetPaths = @(
  "README.md",
  ".env.example",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "apps/api/ragpilot_api",
  "apps/web/app",
  "apps/web/components",
  "apps/web/lib",
  "apps/web/messages",
  "docs",
  "packages"
) | Where-Object { Test-Path $_ }

$allowedExtensions = @(
  ".env",
  ".json",
  ".md",
  ".py",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml"
)

$excludedPathFragments = @(
  "/.next/",
  "/.venv/",
  "/__pycache__/",
  "/dist/",
  "/logs/",
  "/node_modules/",
  "/output/",
  "/tmp/",
  "/work/"
)

$sensitivePattern = [regex]'(OPENAI_API_KEY|ANTHROPIC_API_KEY|AZURE_OPENAI|SECRET_KEY|JWT_SECRET|PRIVATE KEY|BEGIN RSA|BEGIN OPENSSH|sk-[A-Za-z0-9_-]{20,})'

function Convert-ToUnixPath {
  param([string]$Path)
  return $Path.Replace("\", "/")
}

function Test-PathExcluded {
  param([string]$Path)

  $normalizedPath = Convert-ToUnixPath -Path $Path
  foreach ($fragment in $excludedPathFragments) {
    if ($normalizedPath.Contains($fragment)) {
      return $true
    }
  }

  return $false
}

function Get-ScanFiles {
  param([string[]]$Paths)

  foreach ($path in $Paths) {
    $item = Get-Item -LiteralPath $path
    if ($item.PSIsContainer) {
      Get-ChildItem -LiteralPath $item.FullName -Recurse -File -Force | Where-Object {
        ($allowedExtensions -contains $_.Extension -or $_.Name -like ".env*") -and
        -not (Test-PathExcluded -Path $_.FullName)
      }
      continue
    }

    if (($allowedExtensions -contains $item.Extension -or $item.Name -like ".env*") -and -not (Test-PathExcluded -Path $item.FullName)) {
      $item
    }
  }
}

Write-Host "Running RAGPilot secret scan..."

$matches = @()
$scanFiles = @(Get-ScanFiles -Paths $targetPaths)

foreach ($file in $scanFiles) {
  $lineNumber = 0
  try {
    foreach ($line in Get-Content -LiteralPath $file.FullName -ErrorAction Stop) {
      $lineNumber += 1
      if ($sensitivePattern.IsMatch($line)) {
        $relativePath = Convert-ToUnixPath -Path (Resolve-Path -LiteralPath $file.FullName -Relative)
        $matches += "${relativePath}:${lineNumber}:$line"
      }
    }
  } catch {
    throw "Secret scan could not read '$($file.FullName)': $($_.Exception.Message)"
  }
}

if ($matches.Count -gt 0) {
  Write-Host ""
  Write-Host "Potential sensitive matches found:" -ForegroundColor Yellow
  $matches | ForEach-Object { Write-Host $_ }
  exit 1
}

Write-Host "No sensitive key patterns found in tracked source and documentation scope." -ForegroundColor Green
exit 0
