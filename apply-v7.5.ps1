param(
  [string]$RepoPath = "."
)

$ErrorActionPreference = "Stop"

$PatchRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$FilesRoot = Join-Path $PatchRoot "files"
$ResolvedRepo = Resolve-Path $RepoPath

if (!(Test-Path (Join-Path $ResolvedRepo "package.json"))) {
  throw "package.json not found in $ResolvedRepo. Pass the repo root path using -RepoPath."
}

Write-Host "Applying v7.5 controlled-pilot readiness pack to: $ResolvedRepo"
Copy-Item -Path (Join-Path $FilesRoot "*") -Destination $ResolvedRepo -Recurse -Force

Push-Location $ResolvedRepo
try {
  node scripts/v75-install-package-scripts.mjs
  Write-Host ""
  Write-Host "v7.5 files applied. Recommended validation commands:"
  Write-Host "npm run ci:static"
  Write-Host "npm run v75:all"
  Write-Host "git status"
  Write-Host ""
  Write-Host "Note: proof:all may still fail until real human approval files are completed. v7.5 does not fake or bypass approvals."
} finally {
  Pop-Location
}
