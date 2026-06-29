$ErrorActionPreference = 'Stop'
Write-Host "Applying Patch 16: Real Data Activation Pack..." -ForegroundColor Cyan

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$downloads = Join-Path $env:USERPROFILE "Downloads"
$externalPatchRoot = Join-Path $downloads "patch16_grc_changes"
$repoPatchRoot = $repoRoot
$zipPath = Join-Path $downloads "grc_patch16_real_data_activation_pack.zip"

if (!(Test-Path $externalPatchRoot)) {
  if (Test-Path $zipPath) {
    Write-Host "Patch folder not found; extracting ZIP from Downloads..." -ForegroundColor Yellow
    Expand-Archive -Path $zipPath -DestinationPath $downloads -Force
  }
}

$patchRoot = $null
if (Test-Path (Join-Path $externalPatchRoot "supabase\migrations\077_patch16_real_data_activation_pack.sql")) {
  $patchRoot = $externalPatchRoot
} elseif (Test-Path (Join-Path $repoPatchRoot "supabase\migrations\077_patch16_real_data_activation_pack.sql")) {
  $patchRoot = $repoPatchRoot
}

if (!$patchRoot) {
  throw "Patch folder not found. Expected $externalPatchRoot or repo-root Patch 16 files. Put grc_patch16_real_data_activation_pack.zip in Downloads and extract it first."
}

$copyMap = @(
  @{ Source = "supabase\migrations\077_patch16_real_data_activation_pack.sql"; Target = "supabase\migrations\077_patch16_real_data_activation_pack.sql" },
  @{ Source = "src\lib\realDataActivationApi.ts"; Target = "src\lib\realDataActivationApi.ts" },
  @{ Source = "src\pages\RealDataActivationCenter.tsx"; Target = "src\pages\RealDataActivationCenter.tsx" }
)

foreach ($item in $copyMap) {
  $source = Join-Path $patchRoot $item.Source
  $target = Join-Path $repoRoot $item.Target
  if (!(Test-Path $source)) {
    throw "Missing Patch 16 source file: $source"
  }

  $resolvedSource = (Resolve-Path $source).Path
  $resolvedTarget = if (Test-Path $target) { (Resolve-Path $target).Path } else { $target }
  if ($resolvedSource -ieq $resolvedTarget) {
    Write-Host "Already in place: $($item.Target)" -ForegroundColor DarkGray
  } else {
    Copy-Item -Force $source $target
    Write-Host "Copied: $($item.Target)" -ForegroundColor Green
  }
}

$appPath = Join-Path $repoRoot "src\App.tsx"
$app = Get-Content $appPath -Raw

if ($app -notmatch "RealDataActivationCenter") {
  $anchorImport = "import { RealDataUatReadinessCenter } from './pages/RealDataUatReadinessCenter';"
  if ($app.Contains($anchorImport)) {
    $app = $app.Replace($anchorImport, $anchorImport + "`r`nimport { RealDataActivationCenter } from './pages/RealDataActivationCenter';")
  } else {
    $fallbackImport = "import { AssuranceGoLiveCenter } from './pages/AssuranceGoLiveCenter';"
    $app = $app.Replace($fallbackImport, $fallbackImport + "`r`nimport { RealDataActivationCenter } from './pages/RealDataActivationCenter';")
  }
}

if ($app -notmatch "id: 'realDataActivation'") {
  $tabLine = "        { id: 'realDataActivation', label: t('hub.tab.realDataActivation', 'Real Data Activation'), description: t('hub.tab.realDataActivation.desc', 'Controlled activation of licensed metadata, master data, mappings, validations, load approvals, reconciliation, and cutover readiness.'), icon: <UploadCloud size={17} />, content: <RealDataActivationCenter /> },"
  $anchorTab = "        { id: 'realDataUatReadiness', label: t('hub.tab.realDataUatReadiness', 'Real Data & UAT'), description: t('hub.tab.realDataUatReadiness.desc', 'Licensed content loading, import validation, mappings, UAT cycles, training, signoffs, and go/no-go readiness.'), icon: <ClipboardCheck size={17} />, content: <RealDataUatReadinessCenter /> },"
  if ($app.Contains($anchorTab)) {
    $app = $app.Replace($anchorTab, $anchorTab + "`r`n" + $tabLine)
  } else {
    $anchorTab2 = "        { id: 'assuranceGoLive', label: t('hub.tab.assuranceGoLive', 'Assurance Go-Live Pack'), description: t('hub.tab.assuranceGoLive.desc', 'External auditor portal, signoffs, rollback, monitoring, training, and production decisions.'), icon: <PackageCheck size={17} />, content: <AssuranceGoLiveCenter /> },"
    $app = $app.Replace($anchorTab2, $anchorTab2 + "`r`n" + $tabLine)
  }
}

Set-Content -Path $appPath -Value $app -Encoding UTF8

$app = Get-Content $appPath -Raw
if ($app -notmatch "RealDataActivationCenter") {
  throw "RealDataActivationCenter was not inserted into src/App.tsx"
}
if ($app -notmatch "id: 'realDataActivation'") {
  throw "realDataActivation tab was not inserted into src/App.tsx"
}

$readmePath = Join-Path $repoRoot "README.md"
if (Test-Path $readmePath) {
  $readme = Get-Content $readmePath -Raw
  if ($readme -notmatch "Patch 16") {
    Add-Content -Path $readmePath -Value "`n## Patch 16 - Real Data Activation Pack`nAdds controlled real-data activation governance for licensed standards metadata, hospital master data, dataset mapping, validation, approval, reconciliation, cutover readiness, and signoffs. No demo data or copyrighted standards text is seeded.`n"
  }
}

Write-Host "Patch 16 applied. Run scripts\verify-patch16.ps1, npm run typecheck, npm run build, npm run v64:rls-strict, and npm run proof:all." -ForegroundColor Green
