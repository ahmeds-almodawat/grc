param([Parameter(Mandatory=$true)][string]$RepoPath)
$ErrorActionPreference = "Stop"
if (-not (Test-Path $RepoPath)) { throw "RepoPath does not exist: $RepoPath" }
$PatchRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
foreach ($item in @("README_APPLY_V79_PATCH.md","docs","scripts","release",".github")) {
  $src = Join-Path $PatchRoot $item
  if (Test-Path $src) { Copy-Item -Path $src -Destination (Join-Path $RepoPath $item) -Recurse -Force }
}
Write-Host "v7.9 patch files copied."
Push-Location $RepoPath
node .\scripts\v79-install-package-scripts.mjs
Pop-Location
Write-Host "v7.9 package scripts installed. Next: npm run pilot:ops-readiness"
