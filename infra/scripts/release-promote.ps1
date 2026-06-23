param(
  [string]$RemoteUrl = "",
  [string]$RemoteName = "origin",
  [string]$Tag = "v0.1.0",
  [switch]$AllowLocalBaselineCommit,
  [switch]$Push,
  [switch]$CreateTag,
  [switch]$SkipPreflight,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

if (-not (Test-Path ".git")) {
  throw "The repository is not initialized as Git."
}

Write-Host "Running RagPilot release promotion helper..." -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
  Write-Host "Dry run mode is active. No Git remote, push, or tag mutation will be executed." -ForegroundColor Yellow
  Write-Host ""
}

$licensePresent = (Test-Path "LICENSE") -or (Test-Path "LICENSE.md")
$statusBranchOutput = @(& git status --short --branch)
$hasCommit = -not ($statusBranchOutput | Where-Object { $_ -like "## No commits yet on *" })
$existingRemotes = @(& git remote)
$blockers = New-Object System.Collections.Generic.List[string]

if (-not $hasCommit) {
  if ($licensePresent) {
    Write-Host "No baseline commit found. Creating the first baseline commit..." -ForegroundColor Cyan
    & powershell -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/create-baseline-commit.ps1"
    if ($LASTEXITCODE -ne 0) {
      throw "Baseline commit creation failed."
    }
    $hasCommit = $true
    $existingRemotes = @(& git remote)
  } elseif ($AllowLocalBaselineCommit) {
    Write-Host "No baseline commit found. Creating a local-only baseline commit without LICENSE..." -ForegroundColor Yellow
    & powershell -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/create-baseline-commit.ps1" -SkipLicenseCheck
    if ($LASTEXITCODE -ne 0) {
      throw "Local baseline commit creation failed."
    }
    $hasCommit = $true
    $existingRemotes = @(& git remote)
  }
}

$normalizedRemoteUrl = $RemoteUrl.Trim()
if (-not [string]::IsNullOrWhiteSpace($normalizedRemoteUrl)) {
  Write-Host "Configuring remote..." -ForegroundColor Cyan
  if ($DryRun) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/configure-remote.ps1" -RemoteUrl $normalizedRemoteUrl -RemoteName $RemoteName -DryRun
  } else {
    & powershell -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/configure-remote.ps1" -RemoteUrl $normalizedRemoteUrl -RemoteName $RemoteName
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Remote configuration failed."
  }
  if (-not $DryRun) {
    $existingRemotes = @(& git remote)
  }
}

if ($Push) {
  if (-not $licensePresent) {
    if ($DryRun) {
      $blockers.Add("first public push requires a LICENSE")
    } else {
      throw "Cannot perform the first public push without a LICENSE."
    }
  }

  if (-not $hasCommit) {
    if ($DryRun) {
      $blockers.Add("first public push requires a baseline commit")
    } else {
      throw "Cannot perform the first public push without a baseline commit."
    }
  }

  if (-not ($existingRemotes -contains $RemoteName)) {
    if ($DryRun) {
      $blockers.Add("first public push requires remote '$RemoteName'")
    } else {
      throw "Cannot perform the first public push because remote '$RemoteName' is not configured."
    }
  }

  if (-not $DryRun -or $blockers.Count -eq 0) {
    Write-Host "Running first public push..." -ForegroundColor Cyan
    if ($SkipPreflight -and $DryRun) {
      & powershell -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/push-first-public.ps1" -RemoteName $RemoteName -SkipPreflight -DryRun
    } elseif ($SkipPreflight) {
      & powershell -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/push-first-public.ps1" -RemoteName $RemoteName -SkipPreflight
    } elseif ($DryRun) {
      & powershell -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/push-first-public.ps1" -RemoteName $RemoteName -DryRun
    } else {
      & powershell -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/push-first-public.ps1" -RemoteName $RemoteName
    }
    if ($LASTEXITCODE -ne 0) {
      throw "First public push failed."
    }
  }
}

if ($CreateTag) {
  if (-not ($existingRemotes -contains $RemoteName)) {
    if ($DryRun) {
      $blockers.Add("first public tag requires remote '$RemoteName'")
    } else {
      throw "Cannot create the first public tag because remote '$RemoteName' is not configured."
    }
  }

  if (-not $hasCommit) {
    if ($DryRun) {
      $blockers.Add("first public tag requires a baseline commit")
    } else {
      throw "Cannot create the first public tag without a baseline commit."
    }
  }

  if (-not $DryRun -or $blockers.Count -eq 0) {
    Write-Host "Creating first public tag..." -ForegroundColor Cyan
    if ($DryRun) {
      & powershell -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/create-first-tag.ps1" -Tag $Tag -RemoteName $RemoteName -DryRun
    } else {
      & powershell -NoProfile -ExecutionPolicy Bypass -File "infra/scripts/create-first-tag.ps1" -Tag $Tag -RemoteName $RemoteName
    }
    if ($LASTEXITCODE -ne 0) {
      throw "First public tag failed."
    }
  }
}

Write-Host ""
Write-Host "Release promotion helper finished." -ForegroundColor Green

if ($DryRun -and $blockers.Count -gt 0) {
  Write-Host ""
  Write-Host "Dry run blockers:" -ForegroundColor Yellow
  $blockers | Select-Object -Unique | ForEach-Object { Write-Host "- $_" }
}

if (-not $licensePresent) {
  Write-Warning "LICENSE is still missing."
}
if (-not $hasCommit) {
  Write-Warning "Baseline commit is still missing."
}
if (-not ($existingRemotes -contains $RemoteName)) {
  Write-Warning "Remote '$RemoteName' is still not configured."
}
