param(
  [string]$RepoPath = "."
)

$ErrorActionPreference = "Stop"
$SourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoFullPath = Resolve-Path $RepoPath

$items = @(
  "README_APPLY_V91_PATCH.md",
  "docs",
  "scripts",
  ".github"
)

foreach ($item in $items) {
  $source = Join-Path $SourceRoot $item
  $dest = Join-Path $RepoFullPath $item
  if (Test-Path $source) {
    if ((Get-Item $source).PSIsContainer) {
      New-Item -ItemType Directory -Force -Path $dest | Out-Null
      Copy-Item -Path (Join-Path $source "*") -Destination $dest -Recurse -Force
    } else {
      Copy-Item -Path $source -Destination $dest -Force
    }
  }
}

Write-Host "v9.1 patch applied. Now run:"
Write-Host "node .\scripts\v91-install-package-scripts.mjs"
Write-Host "npm run pilot:approval-finalization"
