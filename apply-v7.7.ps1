param([Parameter(Mandatory=$true)][string]$RepoPath)
$ErrorActionPreference = "Stop"
$PatchRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoPath = Resolve-Path $RepoPath
Write-Host "Applying v7.7 Staging Validation and PR Quality Pack..." -ForegroundColor Cyan
foreach ($item in @("docs","scripts",".github","release","README_APPLY_V77_PATCH.md")) {
  $src = Join-Path $PatchRoot $item
  $dst = Join-Path $RepoPath $item
  if (Test-Path $src) { Copy-Item -Path $src -Destination $dst -Recurse -Force }
}
Push-Location $RepoPath
try {
  node .\scripts\v77-install-package-scripts.mjs
  Write-Host "v7.7 applied and package scripts installed." -ForegroundColor Green
  Write-Host "Next: npm run pilot:staging-readiness"
} finally { Pop-Location }
