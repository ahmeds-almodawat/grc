Write-Host "Applying v19.0 Executive Reporting + Automation Pack..."
Write-Host "Files are already arranged in repository-root paths: src/, scripts/, release/."
Write-Host "If you extracted this ZIP into the repository root, new files are already in place."

node scripts/v190-install-package-scripts.mjs

Write-Host "v19.0 patch applied. Now run:"
Write-Host "npm ci"
Write-Host "npm run typecheck"
Write-Host "npm run build"
Write-Host "npm run pilot:v190-executive-reporting"
Write-Host "npm run proof:all"
