$ErrorActionPreference = 'Stop'
Write-Host "Verifying Patch 17 file presence and App integration..." -ForegroundColor Cyan

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$requiredFiles = @(
  "supabase\migrations\078_patch17_real_uat_execution_evidence_pack.sql",
  "src\lib\realUatExecutionApi.ts",
  "src\pages\RealUatExecutionCenter.tsx"
)

foreach ($file in $requiredFiles) {
  $path = Join-Path $repoRoot $file
  if (!(Test-Path $path)) {
    throw "Missing required Patch 17 file: $file"
  }
  Write-Host "OK: $file" -ForegroundColor Green
}

$appPath = Join-Path $repoRoot "src\App.tsx"
$app = Get-Content $appPath -Raw

if ($app -notmatch "RealUatExecutionCenter") {
  throw "RealUatExecutionCenter is not referenced in src/App.tsx"
}
Write-Host "OK: RealUatExecutionCenter referenced in App.tsx" -ForegroundColor Green

if ($app -notmatch "realUatExecution") {
  throw "realUatExecution tab is not referenced in src/App.tsx"
}
Write-Host "OK: realUatExecution tab referenced in App.tsx" -ForegroundColor Green

$migration = Get-Content (Join-Path $repoRoot "supabase\migrations\078_patch17_real_uat_execution_evidence_pack.sql") -Raw
foreach ($needle in @("enable row level security", "create policy", "v_real_uat_execution_summary", "v_real_uat_run_queue", "v_real_uat_signoff_readiness")) {
  if ($migration -notmatch [regex]::Escape($needle)) {
    throw "Patch 17 migration missing expected token: $needle"
  }
}
Write-Host "OK: migration contains RLS policies and views" -ForegroundColor Green
Write-Host "Patch 17 verification passed." -ForegroundColor Green
