Write-Host "Applying v16.0 Compliance Management System Execution Pack..."
Write-Host "Files are arranged in repository-root paths: src/, scripts/, release/."
Write-Host "If you extracted this ZIP into the repository root and selected replace files, source files are already in place."

node scripts/v160-install-package-scripts.mjs
if ($LASTEXITCODE -ne 0) {
  Write-Error "v16 package script installer failed."
  exit $LASTEXITCODE
}

Write-Host "v16.0 patch applied. Now run:"
Write-Host "npm ci"
Write-Host "npm run typecheck"
Write-Host "npm run build"
Write-Host "npm run pilot:v160-compliance-management"
Write-Host "npm run proof:all"
