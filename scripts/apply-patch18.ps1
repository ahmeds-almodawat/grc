param(
  [string]$RepoRoot = "C:\Users\molte\Downloads\grc-control-center",
  [string]$PatchRoot = "C:\Users\molte\Downloads\patch18_grc_changes",
  [string]$ZipPath = "C:\Users\molte\Downloads\grc_patch18_production_go_no_go_pack.zip"
)

Write-Host "Applying Patch 18: Production Go/No-Go Pack..." -ForegroundColor Cyan

if (!(Test-Path $PatchRoot)) {
  if (Test-Path $ZipPath) {
    Write-Host "Patch folder not found. Extracting ZIP from Downloads..." -ForegroundColor Yellow
    Expand-Archive -Path $ZipPath -DestinationPath (Split-Path $PatchRoot -Parent) -Force
  }
}

if (!(Test-Path $PatchRoot)) {
  throw "Patch folder not found. Expected $PatchRoot. Keep the ZIP in Downloads or extract it to Downloads."
}

if (!(Test-Path $RepoRoot)) {
  throw "Repo folder not found. Expected $RepoRoot"
}

$files = @(
  @{ Source = "supabase\migrations\079_patch18_production_go_no_go_pack.sql"; Target = "supabase\migrations\079_patch18_production_go_no_go_pack.sql" },
  @{ Source = "src\lib\productionGoNoGoApi.ts"; Target = "src\lib\productionGoNoGoApi.ts" },
  @{ Source = "src\pages\ProductionGoNoGoCenter.tsx"; Target = "src\pages\ProductionGoNoGoCenter.tsx" }
)

foreach ($file in $files) {
  $source = Join-Path $PatchRoot $file.Source
  $target = Join-Path $RepoRoot $file.Target
  $targetDir = Split-Path $target -Parent
  if (!(Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
  Copy-Item -Path $source -Destination $target -Force
  Write-Host "Copied $($file.Target)" -ForegroundColor Green
}

$appPath = Join-Path $RepoRoot "src\App.tsx"
$app = Get-Content $appPath -Raw

if ($app -notmatch "ProductionGoNoGoCenter") {
  $importLine = "import { ProductionGoNoGoCenter } from './pages/ProductionGoNoGoCenter';"
  $app = $app -replace "import \{ ProductionHardeningLaunchCenter \} from './pages/ProductionHardeningLaunchCenter';", "import { ProductionHardeningLaunchCenter } from './pages/ProductionHardeningLaunchCenter';`r`n$importLine"
}

if ($app -notmatch "realProductionGoNoGo") {
  $tabLine = "        { id: 'realProductionGoNoGo', label: t('hub.tab.realProductionGoNoGo', 'Production Go/No-Go'), description: t('hub.tab.realProductionGoNoGo.desc', 'Staging persona SQL, restore and rollback proof, change freeze, access and confidentiality review, board pack, executive decision, and launch monitoring.'), icon: <PackageCheck size={17} />, content: <ProductionGoNoGoCenter /> },"
  $app = $app -replace "        \{ id: 'productionHardeningLaunch'.*?<ProductionHardeningLaunchCenter /> \},", "`$0`r`n$tabLine"
}

Set-Content -Path $appPath -Value $app -Encoding UTF8

Write-Host "Patch 18 applied. Run verify-patch18.ps1, npm run typecheck, npm run build, and npm run proof:all." -ForegroundColor Cyan
