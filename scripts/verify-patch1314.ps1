$ErrorActionPreference = 'Stop'

Write-Host "Verifying Patch 13+14 file presence..."

$requiredFiles = @(
  'supabase\migrations\074_patch13_uat_accreditation_evidence_pack.sql',
  'supabase\migrations\075_patch14_production_hardening_launch_pack.sql',
  'src\lib\uatAccreditationEvidenceApi.ts',
  'src\lib\productionHardeningLaunchApi.ts',
  'src\pages\UatAccreditationEvidenceCenter.tsx',
  'src\pages\ProductionHardeningLaunchCenter.tsx'
)

foreach ($file in $requiredFiles) {
  if (!(Test-Path $file)) { throw "Missing required file: $file" }
  Write-Host "OK: $file"
}

Write-Host "Checking App.tsx integration..."
$app = Get-Content -Raw 'src\App.tsx'

$checks = @(
  'UatAccreditationEvidenceCenter',
  'ProductionHardeningLaunchCenter',
  "id: 'uatAccreditationEvidence'",
  "id: 'productionHardeningLaunch'"
)

foreach ($check in $checks) {
  if ($app -notmatch [regex]::Escape($check)) { throw "Missing App.tsx integration marker: $check" }
  Write-Host "OK: $check"
}

Write-Host "Checking migration policy visibility..."
$m13 = Get-Content -Raw 'supabase\migrations\074_patch13_uat_accreditation_evidence_pack.sql'
$m14 = Get-Content -Raw 'supabase\migrations\075_patch14_production_hardening_launch_pack.sql'
if ($m13 -notmatch 'create policy patch13_role_scenario_scripts_org_read') { throw 'Patch 13 explicit RLS policies not found.' }
if ($m14 -notmatch 'create policy patch14_client_warning_register_org_read') { throw 'Patch 14 explicit RLS policies not found.' }

Write-Host 'Patch 13+14 verification passed.'
