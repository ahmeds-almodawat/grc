param()

$ErrorActionPreference = "Stop"
$RepoRoot = (Get-Location).Path
if (!(Test-Path (Join-Path $RepoRoot "package.json"))) {
  throw "Run this from the repository root."
}

Write-Host "Verifying Patch 6 file presence..."
$required = @(
  "supabase\migrations\067_patch6_accreditation_quality_operating_layer.sql",
  "src\lib\qualityAccreditationOperatingApi.ts",
  "src\pages\QualityAccreditationOperatingCenter.tsx"
)
foreach ($path in $required) {
  if (!(Test-Path (Join-Path $RepoRoot $path))) { throw "Missing required file: $path" }
  Write-Host "OK: $path"
}

$app = Get-Content (Join-Path $RepoRoot "src\App.tsx") -Raw
if ($app -notmatch "QualityAccreditationOperatingCenter") { throw "QualityAccreditationOperatingCenter is not referenced in src/App.tsx" }
if ($app -notmatch "qualityAccreditationOperating") { throw "qualityAccreditationOperating tab is not present in src/App.tsx" }
if ($app -notmatch "WorkflowKernelCenter") { throw "Patch 5 WorkflowKernelCenter reference missing from src/App.tsx" }
if ($app -notmatch "auditEvidenceGovernance") { throw "Patch 4 Audit Evidence Governance tab reference missing from src/App.tsx" }
Write-Host "OK: App.tsx integration found"

Write-Host "Running TypeScript check..."
npm run typecheck

Write-Host "Running production build..."
npm run build

Write-Host "Running static RLS proof gate..."
npm run v64:rls-strict

Write-Host "Patch 6 verification completed."
