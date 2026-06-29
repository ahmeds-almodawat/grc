param()

$ErrorActionPreference = "Stop"
$RepoRoot = (Get-Location).Path

if (!(Test-Path (Join-Path $RepoRoot "package.json"))) {
  throw "Run this script from the repo root, for example C:\Users\molte\Downloads\grc-control-center"
}

Write-Host "Verifying Patch 7+8 file presence..."
$required = @(
  "supabase\migrations\068_patch7_professional_audit_risk_compliance_workbenches.sql",
  "supabase\migrations\069_patch8_assurance_security_go_live_pack.sql",
  "src\lib\professionalWorkbenchesApi.ts",
  "src\lib\assuranceGoLiveApi.ts",
  "src\pages\ProfessionalWorkbenchesCenter.tsx",
  "src\pages\AssuranceGoLiveCenter.tsx"
)

foreach ($relative in $required) {
  if (!(Test-Path (Join-Path $RepoRoot $relative))) {
    throw "Missing required file: $relative"
  }
  Write-Host "OK: $relative"
}

$appPath = Join-Path $RepoRoot "src\App.tsx"
$app = Get-Content $appPath -Raw

Write-Host "Checking App.tsx integration..."
if ($app -notmatch "ProfessionalWorkbenchesCenter") { throw "ProfessionalWorkbenchesCenter is not referenced in src/App.tsx" }
if ($app -notmatch "AssuranceGoLiveCenter") { throw "AssuranceGoLiveCenter is not referenced in src/App.tsx" }
if ($app -notmatch "id: 'professionalWorkbenches'") { throw "Professional Workbenches tab is missing in src/App.tsx" }
if ($app -notmatch "id: 'assuranceGoLive'") { throw "Assurance Go-Live tab is missing in src/App.tsx" }
Write-Host "OK: App.tsx integration references found"

Write-Host "Running TypeScript check..."
npm run typecheck

Write-Host "Running build..."
npm run build

Write-Host "Patch 7+8 verification completed."
