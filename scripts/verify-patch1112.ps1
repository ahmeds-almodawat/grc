$ErrorActionPreference = "Stop"

Write-Host "Verifying Patch 11+12 file presence..." -ForegroundColor Cyan

$requiredFiles = @(
  "supabase\migrations\072_patch11_real_standards_master_data_pack.sql",
  "supabase\migrations\073_patch12_real_workflow_execution_pack.sql",
  "src\lib\realStandardsMasterDataApi.ts",
  "src\lib\realWorkflowExecutionApi.ts",
  "src\pages\RealStandardsMasterDataCenter.tsx",
  "src\pages\RealWorkflowExecutionCenter.tsx"
)

foreach ($file in $requiredFiles) {
  if (!(Test-Path $file)) { throw "Missing required file: $file" }
  Write-Host "OK: $file" -ForegroundColor Green
}

Write-Host "Checking App.tsx integration..." -ForegroundColor Cyan
$app = Get-Content "src\App.tsx" -Raw
$requiredMarkers = @(
  "RealStandardsMasterDataCenter",
  "RealWorkflowExecutionCenter",
  "id: 'realStandardsMasterData'",
  "id: 'realWorkflowExecution'"
)

foreach ($marker in $requiredMarkers) {
  if ($app -notmatch $marker) { throw "$marker is not referenced in src/App.tsx" }
  Write-Host "OK: App.tsx contains $marker" -ForegroundColor Green
}

Write-Host "Checking migration safety markers..." -ForegroundColor Cyan
$m11 = Get-Content "supabase\migrations\072_patch11_real_standards_master_data_pack.sql" -Raw
$m12 = Get-Content "supabase\migrations\073_patch12_real_workflow_execution_pack.sql" -Raw

foreach ($marker in @("real_standard_libraries", "real_department_master", "real_control_library", "v_real_standards_master_summary")) {
  if ($m11 -notmatch $marker) { throw "Patch 11 migration missing marker: $marker" }
}
foreach ($marker in @("real_workflow_execution_items", "real_evidence_submissions", "real_capa_issuance_records", "v_real_action_queue")) {
  if ($m12 -notmatch $marker) { throw "Patch 12 migration missing marker: $marker" }
}

if ($m11 -match "insert into") { throw "Patch 11 should not insert runtime/demo standards data." }
if ($m12 -match "insert into") { throw "Patch 12 should not insert runtime/demo workflow data." }

Write-Host "Patch 11+12 verification passed." -ForegroundColor Green
