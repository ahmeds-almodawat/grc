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

Write-Host "Applying v7.4 repo hardening patch to: $ResolvedRepo"
Copy-Item -Path (Join-Path $FilesRoot "*") -Destination $ResolvedRepo -Recurse -Force

Push-Location $ResolvedRepo
try {
  node scripts/v74-install-package-scripts.mjs
  Write-Host ""
  Write-Host "v7.4 files applied. Next recommended commands:"
  Write-Host "npm run ci:static"
  Write-Host "npm run proof:all"
  Write-Host "git status"
} finally {
  Pop-Location
}
