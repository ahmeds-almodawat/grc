$ErrorActionPreference = 'Stop'
Write-Host "Verifying Patch 16 file presence and App integration..." -ForegroundColor Cyan

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$requiredFiles = @(
  "supabase\migrations\077_patch16_real_data_activation_pack.sql",
  "src\lib\realDataActivationApi.ts",
  "src\pages\RealDataActivationCenter.tsx"
)

foreach ($file in $requiredFiles) {
  $path = Join-Path $repoRoot $file
  if (!(Test-Path $path)) {
    throw "Missing required Patch 16 file: $file"
  }
  Write-Host "OK: $file" -ForegroundColor Green
}

$appPath = Join-Path $repoRoot "src\App.tsx"
$app = Get-Content $appPath -Raw

if ($app -notmatch "RealDataActivationCenter") {
  throw "RealDataActivationCenter is not referenced in src/App.tsx"
}
Write-Host "OK: RealDataActivationCenter referenced in App.tsx" -ForegroundColor Green

if ($app -notmatch "id: 'realDataActivation'") {
  throw "realDataActivation tab is not referenced in src/App.tsx"
}
Write-Host "OK: realDataActivation tab referenced in App.tsx" -ForegroundColor Green

$migration = Get-Content (Join-Path $repoRoot "supabase\migrations\077_patch16_real_data_activation_pack.sql") -Raw
foreach ($needle in @("enable row level security", "create policy", "v_real_data_activation_summary", "v_real_data_cutover_readiness")) {
  if ($migration -notmatch [regex]::Escape($needle)) {
    throw "Patch 16 migration missing expected token: $needle"
  }
}
Write-Host "OK: migration contains RLS policies and views" -ForegroundColor Green
Write-Host "Patch 16 verification passed." -ForegroundColor Green
