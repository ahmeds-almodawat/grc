Write-Host "Applying v20.0 UAT Closure + Production Hardening Pack..." -ForegroundColor Cyan
Write-Host "Files are already arranged in repository-root paths: src/, scripts/, release/." -ForegroundColor DarkGray
Write-Host "If you extracted this ZIP into the repository root, new files are already in place." -ForegroundColor DarkGray
node scripts/v200-install-package-scripts.mjs
if ($LASTEXITCODE -ne 0) {
  Write-Error "v20 installer failed. Review the Node output above."
  exit $LASTEXITCODE
}
Write-Host "v20.0 patch applied. Now run:" -ForegroundColor Green
Write-Host "npm ci"
Write-Host "npm run typecheck"
Write-Host "npm run build"
Write-Host "npm run pilot:v200-production-readiness"
Write-Host "npm run proof:all"
