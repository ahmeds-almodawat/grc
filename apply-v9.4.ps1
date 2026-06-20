param(
  [string]$RepoPath = "."
)

$ErrorActionPreference = "Stop"
$SourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoFullPath = Resolve-Path $RepoPath

$items = @(
  "README_APPLY_V94_PATCH.md",
  "apply-v9.4.ps1",
  "docs",
  "scripts",
  "release",
  ".github"
)

foreach ($item in $items) {
  $src = Join-Path $SourceRoot $item
  $dst = Join-Path $RepoFullPath $item
  if (Test-Path $src) {
    if ((Get-Item $src).PSIsContainer) {
      Copy-Item $src $dst -Recurse -Force
    } else {
      Copy-Item $src $dst -Force
    }
  }
}

Write-Host "v9.4 patch applied to $RepoFullPath"
Write-Host "Next: node .\scripts\v94-install-package-scripts.mjs"
Write-Host "Then: npm run pilot:final-gate-simulator"
