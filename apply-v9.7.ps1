param(
  [string]$RepoPath = "."
)

$ErrorActionPreference = "Stop"
$SourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoFullPath = Resolve-Path $RepoPath

Write-Host "Applying v9.7 Approval Record Integrity / Evidence Lock Pack to $RepoFullPath"

$items = @(
  "README_APPLY_V97_PATCH.md",
  "docs",
  "scripts",
  "release",
  ".github"
)

foreach ($item in $items) {
  $src = Join-Path $SourceRoot $item
  $dst = Join-Path $RepoFullPath $item
  if (Test-Path $src) {
    Copy-Item $src $dst -Recurse -Force
  }
}

Write-Host "v9.7 patch files copied. Now run:"
Write-Host "node .\scripts\v97-install-package-scripts.mjs"
Write-Host "npm run pilot:approval-record-integrity"
