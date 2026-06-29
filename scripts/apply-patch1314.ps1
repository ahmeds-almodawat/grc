$ErrorActionPreference = 'Stop'

Write-Host "Applying Patch 13+14: UAT Evidence + Production Hardening Launch..."

$repoRoot = (Get-Location).Path
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$patchRoot = Split-Path -Parent $scriptDir

if (!(Test-Path (Join-Path $patchRoot 'supabase'))) {
  $candidate = 'C:\Users\molte\Downloads\patch1314_grc_changes'
  if (Test-Path (Join-Path $candidate 'supabase')) {
    $patchRoot = $candidate
  } else {
    throw "Cannot locate patch1314_grc_changes. Extract grc_patch1314_uat_evidence_production_hardening.zip to C:\Users\molte\Downloads first."
  }
}

$files = @(
  @{ Source = 'supabase\migrations\074_patch13_uat_accreditation_evidence_pack.sql'; Target = 'supabase\migrations\074_patch13_uat_accreditation_evidence_pack.sql' },
  @{ Source = 'supabase\migrations\075_patch14_production_hardening_launch_pack.sql'; Target = 'supabase\migrations\075_patch14_production_hardening_launch_pack.sql' },
  @{ Source = 'src\lib\uatAccreditationEvidenceApi.ts'; Target = 'src\lib\uatAccreditationEvidenceApi.ts' },
  @{ Source = 'src\lib\productionHardeningLaunchApi.ts'; Target = 'src\lib\productionHardeningLaunchApi.ts' },
  @{ Source = 'src\pages\UatAccreditationEvidenceCenter.tsx'; Target = 'src\pages\UatAccreditationEvidenceCenter.tsx' },
  @{ Source = 'src\pages\ProductionHardeningLaunchCenter.tsx'; Target = 'src\pages\ProductionHardeningLaunchCenter.tsx' }
)

foreach ($file in $files) {
  $src = Join-Path $patchRoot $file.Source
  $dst = Join-Path $repoRoot $file.Target
  if (!(Test-Path $src)) { throw "Missing patch file: $src" }
  $dstDir = Split-Path -Parent $dst
  if (!(Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir | Out-Null }
  $srcResolved = (Resolve-Path $src).Path
  $dstResolved = if (Test-Path $dst) { (Resolve-Path $dst).Path } else { $dst }
  if ($srcResolved -ieq $dstResolved) {
    Write-Host "Already in place: $($file.Target)" -ForegroundColor Yellow
  } else {
    Copy-Item -Force $src $dst
    Write-Host "Copied $($file.Target)"
  }
}

$appPath = Join-Path $repoRoot 'src\App.tsx'
if (!(Test-Path $appPath)) { throw 'src/App.tsx not found.' }
$app = Get-Content -Raw $appPath

if ($app -notmatch 'UatAccreditationEvidenceCenter') {
  $anchor = "import { RealStandardsMasterDataCenter } from './pages/RealStandardsMasterDataCenter';"
  if ($app.Contains($anchor)) {
    $app = $app.Replace($anchor, "$anchor`r`nimport { UatAccreditationEvidenceCenter } from './pages/UatAccreditationEvidenceCenter';")
  } else {
    throw 'Could not find RealStandardsMasterDataCenter import anchor in src/App.tsx.'
  }
}

if ($app -notmatch 'ProductionHardeningLaunchCenter') {
  $anchor = "import { RealDataUatReadinessCenter } from './pages/RealDataUatReadinessCenter';"
  if ($app.Contains($anchor)) {
    $app = $app.Replace($anchor, "$anchor`r`nimport { ProductionHardeningLaunchCenter } from './pages/ProductionHardeningLaunchCenter';")
  } else {
    throw 'Could not find RealDataUatReadinessCenter import anchor in src/App.tsx.'
  }
}

if ($app -notmatch "id: 'uatAccreditationEvidence'") {
  $anchor = "{ id: 'realStandardsMasterData', label: t('hub.tab.realStandardsMasterData', 'Standards & Master Data'), description: t('hub.tab.realStandardsMasterData.desc', 'Licensed standards metadata, departments, committees, evidence taxonomy, controls, indicators, tracers, and document ownership.'), icon: <ClipboardList size={17} />, content: <RealStandardsMasterDataCenter /> },"
  $insert = "$anchor`r`n        { id: 'uatAccreditationEvidence', label: t('hub.tab.uatAccreditationEvidence', 'UAT Evidence Pack'), description: t('hub.tab.uatAccreditationEvidence.desc', 'Role scenario scripts, screenshots, SQL proof, signoffs, failed scenarios, retests, and accreditation evidence readiness.'), icon: <FileCheck2 size={17} />, content: <UatAccreditationEvidenceCenter /> },"
  if ($app.Contains($anchor)) {
    $app = $app.Replace($anchor, $insert)
  } else {
    throw 'Could not find Standards & Master Data tab anchor in src/App.tsx.'
  }
}

if ($app -notmatch "id: 'productionHardeningLaunch'") {
  $anchor = "{ id: 'realDataUatReadiness', label: t('hub.tab.realDataUatReadiness', 'Real Data & UAT'), description: t('hub.tab.realDataUatReadiness.desc', 'Licensed content loading, import validation, mappings, UAT cycles, training, signoffs, and go/no-go readiness.'), icon: <ClipboardCheck size={17} />, content: <RealDataUatReadinessCenter /> },"
  $insert = "$anchor`r`n        { id: 'productionHardeningLaunch', label: t('hub.tab.productionHardeningLaunch', 'Production Hardening Launch'), description: t('hub.tab.productionHardeningLaunch.desc', 'Warning cleanup, staging persona SQL, restore proof, change freeze, board go/no-go, launch signoffs, and monitoring.'), icon: <PackageCheck size={17} />, content: <ProductionHardeningLaunchCenter /> },"
  if ($app.Contains($anchor)) {
    $app = $app.Replace($anchor, $insert)
  } else {
    throw 'Could not find Real Data & UAT tab anchor in src/App.tsx.'
  }
}

if ($app -notmatch 'UatAccreditationEvidenceCenter') {
  throw 'UatAccreditationEvidenceCenter was not inserted into src/App.tsx.'
}
if ($app -notmatch "id: 'uatAccreditationEvidence'") {
  throw "uatAccreditationEvidence tab was not inserted into src/App.tsx."
}
if ($app -notmatch 'ProductionHardeningLaunchCenter') {
  throw 'ProductionHardeningLaunchCenter was not inserted into src/App.tsx.'
}
if ($app -notmatch "id: 'productionHardeningLaunch'") {
  throw "productionHardeningLaunch tab was not inserted into src/App.tsx."
}

Set-Content -Path $appPath -Value $app -Encoding UTF8
Write-Host 'Updated src/App.tsx integration.'
Write-Host 'Patch 13+14 applied successfully.'
