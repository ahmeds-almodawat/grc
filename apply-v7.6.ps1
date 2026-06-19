param(
  [string]$RepoPath = "C:\Users\molte\Downloads\grc-control-center"
)

$ErrorActionPreference = "Stop"
$PatchRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Applying v7.6 CI / repo hygiene / evidence operations pack..."
Write-Host "Repo: $RepoPath"
Write-Host "Patch: $PatchRoot"

if (-not (Test-Path $RepoPath)) {
  throw "Repo path not found: $RepoPath"
}

$paths = @("docs", "scripts", ".github")
foreach ($p in $paths) {
  $src = Join-Path $PatchRoot $p
  if (Test-Path $src) {
    Copy-Item -Path $src -Destination $RepoPath -Recurse -Force
  }
}

$installer = Join-Path $RepoPath "scripts\v76-install-package-scripts.mjs"
if (Test-Path $installer) {
  Push-Location $RepoPath
  node .\scripts\v76-install-package-scripts.mjs
  Pop-Location
} else {
  throw "v76 installer was not copied correctly."
}

Write-Host "v7.6 patch applied. Next run: npm run repo:health"
