$ErrorActionPreference = "Stop"

Write-Host "Verifying Patch 9+10 file presence..."
$required = @(
  "supabase\migrations\070_patch9_runtime_workflow_actions_escalations.sql",
  "supabase\migrations\071_patch10_real_data_activation_uat_readiness.sql",
  "src\lib\runtimeWorkflowActionsApi.ts",
  "src\lib\realDataUatReadinessApi.ts",
  "src\pages\RuntimeWorkflowActionsCenter.tsx",
  "src\pages\RealDataUatReadinessCenter.tsx"
)

foreach ($file in $required) {
  if (!(Test-Path $file)) { throw "Missing required file: $file" }
  Write-Host "OK: $file"
}

Write-Host "Checking App.tsx integration..."
$app = Get-Content "src\App.tsx" -Raw -Encoding UTF8
if ($app -notmatch "RuntimeWorkflowActionsCenter") { throw "RuntimeWorkflowActionsCenter is not referenced in src/App.tsx" }
if ($app -notmatch "RealDataUatReadinessCenter") { throw "RealDataUatReadinessCenter is not referenced in src/App.tsx" }
if ($app -notmatch "id: 'runtimeWorkflowActions'") { throw "Runtime Actions tab is missing in src/App.tsx" }
if ($app -notmatch "id: 'realDataUatReadiness'") { throw "Real Data & UAT tab is missing in src/App.tsx" }

Write-Host "Patch 9+10 verification passed."
