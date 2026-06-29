$ErrorActionPreference = 'Stop'

Write-Host "Verifying Patch 15 file presence..."
$required = @(
  "supabase\migrations\076_patch15_final_warning_runtime_security_closure.sql",
  "src\lib\supabase.ts",
  "src\lib\finalRuntimeSecurityClosureApi.ts",
  "src\pages\FinalRuntimeSecurityClosureCenter.tsx"
)
foreach ($path in $required) {
  if (!(Test-Path $path)) { throw "Missing required file: $path" }
  Write-Host "OK: $path"
}

Write-Host "Checking Supabase singleton remediation..."
$supabase = Get-Content "src\lib\supabase.ts" -Raw
if ($supabase -notmatch "__grcSupabaseClient__") { throw "src/lib/supabase.ts does not include global singleton marker" }
if ($supabase -notmatch "storageKey: 'grc-control-center-auth'") { throw "src/lib/supabase.ts does not include stable auth storageKey" }

Write-Host "Checking App.tsx integration..."
$app = Get-Content "src\App.tsx" -Raw
if ($app -notmatch "FinalRuntimeSecurityClosureCenter") { throw "FinalRuntimeSecurityClosureCenter is not referenced in src/App.tsx" }
if ($app -notmatch "id: 'finalRuntimeSecurityClosure'") { throw "finalRuntimeSecurityClosure tab is not referenced in src/App.tsx" }

Write-Host "Checking migration content..."
$migration = Get-Content "supabase\migrations\076_patch15_final_warning_runtime_security_closure.sql" -Raw
foreach ($needle in @(
  "patch15_runtime_warning_register",
  "patch15_v65_warning_closures",
  "patch15_rpc_classification_reviews",
  "patch15_runtime_security_exceptions",
  "patch15_supabase_client_checks",
  "patch15_final_hardening_proof_runs",
  "v_patch15_final_security_closure_summary",
  "create policy patch15_runtime_warning_register_org_read"
)) {
  if ($migration -notmatch [regex]::Escape($needle)) { throw "Migration missing expected marker: $needle" }
}

Write-Host "Patch 15 verification passed."
