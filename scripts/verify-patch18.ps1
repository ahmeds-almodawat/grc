param(
  [string]$RepoRoot = "C:\Users\molte\Downloads\grc-control-center"
)

Write-Host "Verifying Patch 18 files..." -ForegroundColor Cyan

$required = @(
  "supabase\migrations\079_patch18_production_go_no_go_pack.sql",
  "src\lib\productionGoNoGoApi.ts",
  "src\pages\ProductionGoNoGoCenter.tsx"
)

foreach ($item in $required) {
  $path = Join-Path $RepoRoot $item
  if (!(Test-Path $path)) {
    throw "Missing required Patch 18 file: $item"
  }
  Write-Host "Found $item" -ForegroundColor Green
}

$app = Get-Content (Join-Path $RepoRoot "src\App.tsx") -Raw

if ($app -notmatch "ProductionGoNoGoCenter") {
  throw "App.tsx is missing ProductionGoNoGoCenter import or usage."
}

if ($app -notmatch "realProductionGoNoGo") {
  throw "App.tsx is missing realProductionGoNoGo tab."
}

Write-Host "Patch 18 verification passed." -ForegroundColor Green
