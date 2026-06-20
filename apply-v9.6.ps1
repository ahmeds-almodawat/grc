param(
  [string]$RepoPath = "."
)

$ErrorActionPreference = "Stop"
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoFullPath = Resolve-Path $RepoPath

$paths = @(
  "scripts",
  "docs",
  "release\v96",
  ".github\workflows"
)

foreach ($p in $paths) {
  $dest = Join-Path $RepoFullPath $p
  if (!(Test-Path $dest)) { New-Item -ItemType Directory -Path $dest | Out-Null }
}

Copy-Item -Path (Join-Path $ScriptRoot "scripts\*") -Destination (Join-Path $RepoFullPath "scripts") -Recurse -Force
Copy-Item -Path (Join-Path $ScriptRoot "docs\*") -Destination (Join-Path $RepoFullPath "docs") -Recurse -Force
Copy-Item -Path (Join-Path $ScriptRoot "release\v96\*") -Destination (Join-Path $RepoFullPath "release\v96") -Recurse -Force
Copy-Item -Path (Join-Path $ScriptRoot ".github\workflows\*") -Destination (Join-Path $RepoFullPath ".github\workflows") -Recurse -Force
Copy-Item -Path (Join-Path $ScriptRoot "README_APPLY_V96_PATCH.md") -Destination (Join-Path $RepoFullPath "README_APPLY_V96_PATCH.md") -Force
Copy-Item -Path (Join-Path $ScriptRoot "apply-v9.6.ps1") -Destination (Join-Path $RepoFullPath "apply-v9.6.ps1") -Force

Write-Host "v9.6 Approval Closure Control Pack applied."
Write-Host "Next: node .\scripts\v96-install-package-scripts.mjs"
Write-Host "Then: npm run pilot:approval-closure-control"
