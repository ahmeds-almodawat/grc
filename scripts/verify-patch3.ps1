$ErrorActionPreference = "Stop"

Write-Host "Verifying Patch 3 files..." -ForegroundColor Cyan

$required = @(
  "supabase/migrations/064_patch3_live_grc_operating_core.sql",
  "src/lib/liveGrcOperatingApi.ts",
  "src/pages/LiveGrcOperatingCore.tsx"
)

foreach ($path in $required) {
  if (!(Test-Path $path)) {
    throw "Missing required Patch 3 file: $path"
  }
  Write-Host "Found $path" -ForegroundColor Green
}

$app = Get-Content "src/App.tsx" -Raw
foreach ($needle in @("LiveGrcOperatingCore", "id: 'operatingCore'")) {
  if ($app -notmatch [regex]::Escape($needle)) {
    throw "src/App.tsx is missing: $needle"
  }
}
Write-Host "App integration found" -ForegroundColor Green

Write-Host "Running typecheck..." -ForegroundColor Cyan
npm run typecheck

Write-Host "Running build..." -ForegroundColor Cyan
npm run build

Write-Host "Patch 3 verification passed." -ForegroundColor Green
