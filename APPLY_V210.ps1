Write-Host "Applying v21.0 Framework Crosswalk + Live GRC Backbone Pack..." -ForegroundColor Cyan
Write-Host "Files are already arranged in repository-root paths: src/, scripts/, release/, supabase/." -ForegroundColor Gray
Write-Host "If you extracted this ZIP into the repository root, new files are already in place." -ForegroundColor Gray

node scripts/v210-install-package-scripts.mjs

Write-Host "v21.0 patch applied. Now run:" -ForegroundColor Green
Write-Host "npm ci"
Write-Host "npm run typecheck"
Write-Host "npm run build"
Write-Host "npm run pilot:v210-framework-crosswalk"
Write-Host "npm run proof:all"
