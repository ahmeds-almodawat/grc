$ErrorActionPreference = "Stop"

Write-Host "Verifying Patch 4 file presence..." -ForegroundColor Cyan

$required = @(
  "supabase\migrations\065_patch4_audit_evidence_production_governance.sql",
  "src\lib\auditEvidenceGovernanceApi.ts",
  "src\pages\AuditEvidenceGovernanceCenter.tsx"
)

foreach ($path in $required) {
  if (-not (Test-Path $path)) {
    throw "Missing required Patch 4 file: $path"
  }
  Write-Host "OK: $path" -ForegroundColor Green
}

$app = Get-Content "src\App.tsx" -Raw
if ($app -notmatch "AuditEvidenceGovernanceCenter") {
  throw "App.tsx does not reference AuditEvidenceGovernanceCenter. Run apply-patch4.ps1 again or add integration manually."
}

Write-Host "Running TypeScript check..." -ForegroundColor Cyan
npm run typecheck

Write-Host "Patch 4 verification completed." -ForegroundColor Green
