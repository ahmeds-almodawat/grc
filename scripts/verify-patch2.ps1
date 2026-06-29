param(
  [string]$RepoRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
Set-Location $RepoRoot

Write-Host "Running Patch 2 verification..."
npm run typecheck
npm run build
npm run test:unit
npm run proof:all
Write-Host "Patch 2 verification commands completed. Run npm run test:e2e manually if Playwright is configured on this machine."
