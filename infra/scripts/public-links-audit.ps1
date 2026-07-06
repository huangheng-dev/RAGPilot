$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

Write-Host "Auditing RAGPilot public markdown links..." -ForegroundColor Cyan

$publicMarkdownFiles = @(
  "README.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md"
)

$linkPattern = '\[[^\]]+\]\(([^)]+)\)'
$violations = New-Object System.Collections.Generic.List[string]

foreach ($path in $publicMarkdownFiles) {
  if (-not (Test-Path $path)) {
    $violations.Add("${path} -> missing file under audit set")
    continue
  }

  $content = Get-Content $path -Raw
  $matches = [regex]::Matches($content, $linkPattern)

  foreach ($match in $matches) {
    $target = $match.Groups[1].Value.Trim()
    if ([string]::IsNullOrWhiteSpace($target)) {
      continue
    }

    if (
      $target.StartsWith("http://") -or
      $target.StartsWith("https://") -or
      $target.StartsWith("mailto:") -or
      $target.StartsWith("#")
    ) {
      continue
    }

    $normalizedTarget = $target.Split("#")[0].Split("?")[0]
    if ([string]::IsNullOrWhiteSpace($normalizedTarget)) {
      continue
    }

    $parentPath = Split-Path $path -Parent
    if ([string]::IsNullOrWhiteSpace($parentPath)) {
      $parentPath = "."
    }

    $resolvedTarget = Join-Path $parentPath $normalizedTarget
    if (-not (Test-Path $resolvedTarget)) {
      $violations.Add("${path} -> $target")
    }
  }
}

if ($violations.Count -gt 0) {
  Write-Host ""
  Write-Host "Broken public markdown links detected:" -ForegroundColor Yellow
  $violations | Sort-Object -Unique | ForEach-Object { Write-Host $_ }
  exit 1
}

Write-Host "Public markdown links resolve successfully." -ForegroundColor Green
