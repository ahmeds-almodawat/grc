$ErrorActionPreference = "Stop"

Write-Host "Applying v14.0 Professional GRC Workflow Maturity Pack..."
Write-Host "Files are already arranged in repository-root paths: src/, scripts/, release/."
Write-Host "If you extracted this ZIP into the repository root, the replacement files are already in place."

node .\scripts\v140-install-package-scripts.mjs

Write-Host "v14.0 patch applied. Now run:"
Write-Host "npm ci"
Write-Host "npm run typecheck"
Write-Host "npm run build"
Write-Host "npm run pilot:v140-professional-grc"
Write-Host "npm run proof:all"
