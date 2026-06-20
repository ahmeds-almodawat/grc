param(
  [Parameter(Mandatory=$true)]
  [string]$RepoPath
)

$ErrorActionPreference = "Stop"
$SourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path $RepoPath)) {
  throw "RepoPath does not exist: $RepoPath"
}

Write-Host "Applying v8.0-to-v8.5 governed pilot suite to $RepoPath"

$items = @(
  "README_APPLY_V80_TO_V85_PATCH.md",
  "apply-v8.0-to-v8.5.ps1",
  "docs",
  "scripts",
  ".github"
)

foreach ($item in $items) {
  $src = Join-Path $SourceRoot $item
  $dst = Join-Path $RepoPath $item
  if (Test-Path $src) {
    if ((Get-Item $src).PSIsContainer) {
      New-Item -ItemType Directory -Force -Path $dst | Out-Null
      Copy-Item -Path (Join-Path $src "*") -Destination $dst -Recurse -Force
    } else {
      $parent = Split-Path -Parent $dst
      if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
      Copy-Item -Path $src -Destination $dst -Force
    }
  }
}

Push-Location $RepoPath
try {
  if (Test-Path ".\scripts\v80-v85-install-package-scripts.mjs") {
    node .\scripts\v80-v85-install-package-scripts.mjs
  }
} finally {
  Pop-Location
}

Write-Host "v8.0-to-v8.5 patch applied. Next run: npm run pilot:governed-launch-suite"
