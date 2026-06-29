$ErrorActionPreference = 'Stop'
Write-Host "Applying Patch 17: Real UAT Execution Evidence Pack..." -ForegroundColor Cyan

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$downloads = Join-Path $env:USERPROFILE "Downloads"
$patchRoot = Join-Path $downloads "patch17_grc_changes"
$zipPath = Join-Path $downloads "grc_patch17_real_uat_execution_evidence_pack.zip"

if (!(Test-Path $patchRoot)) {
  if (Test-Path $zipPath) {
    Write-Host "Patch folder not found; extracting ZIP from Downloads..." -ForegroundColor Yellow
    Expand-Archive -Path $zipPath -DestinationPath $downloads -Force
  }
}

if (!(Test-Path $patchRoot)) {
  throw "Patch folder not found. Expected $patchRoot. Put grc_patch17_real_uat_execution_evidence_pack.zip in Downloads and extract it first."
}

Copy-Item -Force (Join-Path $patchRoot "supabase\migrations\078_patch17_real_uat_execution_evidence_pack.sql") (Join-Path $repoRoot "supabase\migrations\078_patch17_real_uat_execution_evidence_pack.sql")
Copy-Item -Force (Join-Path $patchRoot "src\lib\realUatExecutionApi.ts") (Join-Path $repoRoot "src\lib\realUatExecutionApi.ts")
Copy-Item -Force (Join-Path $patchRoot "src\pages\RealUatExecutionCenter.tsx") (Join-Path $repoRoot "src\pages\RealUatExecutionCenter.tsx")

$appPath = Join-Path $repoRoot "src\App.tsx"
$app = Get-Content $appPath -Raw

if ($app -notmatch "RealUatExecutionCenter") {
  $anchorImport = "import { UatAccreditationEvidenceCenter } from './pages/UatAccreditationEvidenceCenter';"
  if ($app.Contains($anchorImport)) {
    $app = $app.Replace($anchorImport, $anchorImport + "`r`nimport { RealUatExecutionCenter } from './pages/RealUatExecutionCenter';")
  } else {
    $fallbackImport = "import { RealStandardsMasterDataCenter } from './pages/RealStandardsMasterDataCenter';"
    $app = $app.Replace($fallbackImport, $fallbackImport + "`r`nimport { RealUatExecutionCenter } from './pages/RealUatExecutionCenter';")
  }
}

if ($app -notmatch "realUatExecution") {
  $tabLine = "        { id: 'realUatExecution', label: t('hub.tab.realUatExecution', 'Real UAT Execution'), description: t('hub.tab.realUatExecution.desc', 'Real role-based UAT runs, screenshots, SQL proof, findings, retests, signoffs, and evidence pack readiness.'), icon: <ClipboardCheck size={17} />, content: <RealUatExecutionCenter /> },"
  $anchorTab = "        { id: 'uatAccreditationEvidence', label: t('hub.tab.uatAccreditationEvidence', 'UAT Evidence Pack'), description: t('hub.tab.uatAccreditationEvidence.desc', 'Role scenario scripts, screenshots, SQL proof, signoffs, failed scenarios, retests, and accreditation evidence readiness.'), icon: <FileCheck2 size={17} />, content: <UatAccreditationEvidenceCenter /> },"
  if ($app.Contains($anchorTab)) {
    $app = $app.Replace($anchorTab, $anchorTab + "`r`n" + $tabLine)
  } else {
    $anchorTab2 = "        { id: 'realStandardsMasterData', label: t('hub.tab.realStandardsMasterData', 'Standards & Master Data'), description: t('hub.tab.realStandardsMasterData.desc', 'Licensed standards metadata, departments, committees, evidence taxonomy, controls, indicators, tracers, and document ownership.'), icon: <ClipboardList size={17} />, content: <RealStandardsMasterDataCenter /> },"
    $app = $app.Replace($anchorTab2, $anchorTab2 + "`r`n" + $tabLine)
  }
}

Set-Content -Path $appPath -Value $app -Encoding UTF8

$readmePath = Join-Path $repoRoot "README.md"
if (Test-Path $readmePath) {
  $readme = Get-Content $readmePath -Raw
  if ($readme -notmatch "Patch 17") {
    Add-Content -Path $readmePath -Value "`n## Patch 17 - Real UAT Execution Evidence Pack`nAdds controlled real UAT execution cycles, persona scripts, scenario runs, step evidence, SQL proof archive, findings, retests, signoffs, and accreditation evidence pack readiness. No fake evidence, fake signoffs, or copyrighted standards text is seeded.`n"
  }
}

Write-Host "Patch 17 applied. Run scripts\verify-patch17.ps1, npm run typecheck, npm run build, npm run v64:rls-strict, and npm run proof:all." -ForegroundColor Green
