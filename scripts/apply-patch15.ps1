$ErrorActionPreference = 'Stop'

Write-Host "Applying Patch 15: Final Warning & Runtime Security Closure..."

$repoRoot = (Get-Location).Path
$patchRootCandidates = @(
  "C:\Users\molte\Downloads\patch15_grc_changes",
  (Join-Path $repoRoot "patch15_grc_changes"),
  $repoRoot
)

$patchRoot = $null
foreach ($candidate in $patchRootCandidates) {
  if ($candidate -and (Test-Path (Join-Path $candidate "supabase\migrations\076_patch15_final_warning_runtime_security_closure.sql"))) {
    $patchRoot = $candidate
    break
  }
}

if (!$patchRoot) { throw "Patch folder not found. Expected C:\Users\molte\Downloads\patch15_grc_changes or unpacked Patch 15 files in the repository root." }

$copies = @(
  @{ Source = "supabase\migrations\076_patch15_final_warning_runtime_security_closure.sql"; Target = "supabase\migrations\076_patch15_final_warning_runtime_security_closure.sql" },
  @{ Source = "src\lib\supabase.ts"; Target = "src\lib\supabase.ts" },
  @{ Source = "src\lib\finalRuntimeSecurityClosureApi.ts"; Target = "src\lib\finalRuntimeSecurityClosureApi.ts" },
  @{ Source = "src\pages\FinalRuntimeSecurityClosureCenter.tsx"; Target = "src\pages\FinalRuntimeSecurityClosureCenter.tsx" }
)

foreach ($copy in $copies) {
  $src = Join-Path $patchRoot $copy.Source
  $dst = Join-Path $repoRoot $copy.Target
  if (!(Test-Path $src)) { throw "Missing patch file: $src" }
  $dstDir = Split-Path $dst -Parent
  if (!(Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir | Out-Null }
  $srcResolved = (Resolve-Path $src).Path
  $dstResolved = if (Test-Path $dst) { (Resolve-Path $dst).Path } else { $dst }
  if ($srcResolved -ieq $dstResolved) {
    Write-Host "Already in place: $($copy.Target)" -ForegroundColor Yellow
  } else {
    Copy-Item -Force $src $dst
    Write-Host "Copied $($copy.Target)"
  }
}

$appPath = Join-Path $repoRoot "src\App.tsx"
if (!(Test-Path $appPath)) { throw "src\App.tsx not found" }
$app = Get-Content $appPath -Raw

if ($app -notmatch "FinalRuntimeSecurityClosureCenter") {
  $importNeedle = "import { ProductionProofCenter } from './pages/ProductionProofCenter';"
  $importLine = "import { FinalRuntimeSecurityClosureCenter } from './pages/FinalRuntimeSecurityClosureCenter';"
  if ($app.Contains($importNeedle)) {
    $app = $app.Replace($importNeedle, "$importNeedle`r`n$importLine")
  } else {
    throw "Unable to insert FinalRuntimeSecurityClosureCenter import. Please add it manually."
  }
}

$tabLine = "        { id: 'finalRuntimeSecurityClosure', label: t('hub.tab.finalRuntimeSecurityClosure', 'Final Runtime Security Closure'), description: t('hub.tab.finalRuntimeSecurityClosure.desc', 'Close Supabase client warnings, v65 audit warning, RPC classifications, runtime-security exceptions, and final proof evidence.'), icon: <LockKeyhole size={17} />, content: <FinalRuntimeSecurityClosureCenter /> },"

if ($app -notmatch "id: 'finalRuntimeSecurityClosure'") {
  $realDataNeedle = "        { id: 'realDataUatReadiness', label: t('hub.tab.realDataUatReadiness', 'Real Data & UAT'), description: t('hub.tab.realDataUatReadiness.desc', 'Licensed content loading, import validation, mappings, UAT cycles, training, signoffs, and go/no-go readiness.'), icon: <ClipboardCheck size={17} />, content: <RealDataUatReadinessCenter /> },"
  $assuranceNeedle = "        { id: 'assuranceGoLive', label: t('hub.tab.assuranceGoLive', 'Assurance Go-Live Pack'), description: t('hub.tab.assuranceGoLive.desc', 'External auditor portal, signoffs, rollback, monitoring, training, and production decisions.'), icon: <PackageCheck size={17} />, content: <AssuranceGoLiveCenter /> },"
  $releaseNeedle = "        { id: 'releaseFactory', label: t('hub.tab.releaseFactory'), description: t('hub.tab.releaseFactory.desc'), icon: <PackageCheck size={17} />, content: <ReleaseFactoryCenter /> },"

  if ($app.Contains($realDataNeedle)) {
    $app = $app.Replace($realDataNeedle, "$realDataNeedle`r`n$tabLine")
  } elseif ($app.Contains($assuranceNeedle)) {
    $app = $app.Replace($assuranceNeedle, "$assuranceNeedle`r`n$tabLine")
  } elseif ($app.Contains($releaseNeedle)) {
    $app = $app.Replace($releaseNeedle, "$tabLine`r`n$releaseNeedle")
  } else {
    throw "Unable to insert Final Runtime Security Closure tab. Please add it manually to AdminReleaseHub."
  }
}

if ($app -notmatch "FinalRuntimeSecurityClosureCenter") {
  throw "FinalRuntimeSecurityClosureCenter was not inserted into src/App.tsx"
}
if ($app -notmatch "id: 'finalRuntimeSecurityClosure'") {
  throw "finalRuntimeSecurityClosure tab was not inserted into src/App.tsx"
}

Set-Content -Path $appPath -Value $app -Encoding UTF8
Write-Host "Patch 15 applied."
