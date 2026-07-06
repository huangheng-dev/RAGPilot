$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $repoRoot

if (-not (Test-Path ".git")) {
  throw "The repository is not initialized as Git."
}

Write-Host "Auditing RAGPilot public release candidate set..." -ForegroundColor Cyan

$candidateFiles = @(& git ls-files --cached --others --exclude-standard)
if ($LASTEXITCODE -ne 0) {
  throw "Failed to read Git candidate files."
}

$forbiddenMatchers = @(
  '^\.env$',
  '^\.env\.local$',
  '^\.env\..+$',
  '^docs/internal(/|$)',
  '^docs/private(/|$)',
  '^logs(/|$)',
  '^\.logs(/|$)',
  '^output(/|$)',
  '^tmp(/|$)',
  '^work(/|$)',
  '^data(/|$)',
  '^\.codex(/|$)',
  '^\.codex-runtime(/|$)',
  '^\.playwright-cli(/|$)',
  '^node_modules(/|$)',
  '^\.next(/|$)',
  '^dist(/|$)',
  '^coverage(/|$)',
  '^apps/api/\.venv(/|$)',
  '^.*__pycache__(/|$)',
  '^.*\.log$',
  '^.*\.pyc$',
  '^.*\.tsbuildinfo$',
  '^.*\.egg-info(/|$)'
)

$allowedSpecialFiles = @(
  ".env.example",
  ".env.production.example"
)

$requiredCandidateFiles = @(
  "README.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "LICENSE",
  ".env.example",
  ".env.production.example"
)

$violations = @()
foreach ($candidateFile in $candidateFiles) {
  if ($allowedSpecialFiles -contains $candidateFile) {
    continue
  }

  foreach ($matcher in $forbiddenMatchers) {
    if ($candidateFile -match $matcher) {
      $violations += $candidateFile
      break
    }
  }
}

if ($violations.Count -gt 0) {
  Write-Host ""
  Write-Host "Forbidden public-release candidates detected:" -ForegroundColor Yellow
  $violations | Sort-Object -Unique | ForEach-Object { Write-Host $_ }
  exit 1
}

$missingRequiredCandidates = @(
  $requiredCandidateFiles | Where-Object { $candidateFiles -notcontains $_ }
)

if ($missingRequiredCandidates.Count -gt 0) {
  Write-Host ""
  Write-Host "Required public-release files are missing from the Git candidate set:" -ForegroundColor Yellow
  $missingRequiredCandidates | ForEach-Object { Write-Host $_ }
  exit 1
}

Write-Host "No forbidden local-only files are present in the current public candidate set." -ForegroundColor Green
