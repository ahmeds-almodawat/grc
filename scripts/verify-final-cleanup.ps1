$ErrorActionPreference = "Stop"

Write-Host "Verifying final cleanup..." -ForegroundColor Cyan

if (-not (Test-Path "src\App.tsx")) {
  throw "Run this script from the repository root."
}

$app = Get-Content "src\App.tsx" -Raw -Encoding UTF8

if ($app -notmatch "AuditEvidenceGovernanceCenter") {
  throw "AuditEvidenceGovernanceCenter import/content not found in src/App.tsx."
}

if ($app -notmatch "auditEvidenceGovernance") {
  throw "Admin hub tab id auditEvidenceGovernance not found in src/App.tsx."
}

Write-Host "OK: Patch 4 UI tab appears to be integrated." -ForegroundColor Green

npm run typecheck
npm run build
npm run test:unit
npm run test:e2e
npm audit --audit-level=high
npm run proof:all
npm run v672:capture
npm run v700:v65-audit

Write-Host "Final cleanup verification completed." -ForegroundColor Green
