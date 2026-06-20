param(
  [string]$RepoPath = "."
)

$ErrorActionPreference = "Stop"
$PatchRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoFullPath = Resolve-Path $RepoPath

Write-Host "Applying v8.6 to v9.0 Pilot Execution Evidence Suite..."
Write-Host "PatchRoot: $PatchRoot"
Write-Host "RepoPath:   $RepoFullPath"

$items = @(
  "README_APPLY_V86_TO_V90_PATCH.md",
  "apply-v8.6-to-v9.0.ps1",
  "docs",
  "scripts",
  ".github",
  "release"
)

foreach ($item in $items) {
  $source = Join-Path $PatchRoot $item
  $dest = Join-Path $RepoFullPath $item
  if (Test-Path $source) {
    if ((Get-Item $source).PSIsContainer) {
      Copy-Item $source $dest -Recurse -Force
    } else {
      Copy-Item $source $dest -Force
    }
  }
}

Write-Host "v8.6 to v9.0 patch files copied."
Write-Host "Now run: node .\scripts\v86-v90-install-package-scripts.mjs"
Write-Host "Then run: npm run pilot:execution-evidence"
