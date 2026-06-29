$ErrorActionPreference = "Stop"

Write-Host "Applying Patch 11+12: Real Standards/Master Data + Real Workflow Execution..." -ForegroundColor Cyan

$repoRoot = (Get-Location).Path
if (!(Test-Path (Join-Path $repoRoot "src\App.tsx"))) {
  throw "Run this script from the repository root: C:\Users\molte\Downloads\grc-control-center"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$patchRoot = Resolve-Path (Join-Path $scriptDir "..") -ErrorAction SilentlyContinue
if (!$patchRoot -or !(Test-Path (Join-Path $patchRoot "supabase\migrations\072_patch11_real_standards_master_data_pack.sql"))) {
  $patchRoot = Join-Path $env:USERPROFILE "Downloads\patch1112_grc_changes"
}
if (!(Test-Path (Join-Path $patchRoot "supabase\migrations\072_patch11_real_standards_master_data_pack.sql"))) {
  throw "Patch root not found. Extract grc_patch1112_real_standards_workflow_execution.zip to C:\Users\molte\Downloads first."
}

$copyPairs = @(
  @{ Source = "supabase\migrations\072_patch11_real_standards_master_data_pack.sql"; Target = "supabase\migrations\072_patch11_real_standards_master_data_pack.sql" },
  @{ Source = "supabase\migrations\073_patch12_real_workflow_execution_pack.sql"; Target = "supabase\migrations\073_patch12_real_workflow_execution_pack.sql" },
  @{ Source = "src\lib\realStandardsMasterDataApi.ts"; Target = "src\lib\realStandardsMasterDataApi.ts" },
  @{ Source = "src\lib\realWorkflowExecutionApi.ts"; Target = "src\lib\realWorkflowExecutionApi.ts" },
  @{ Source = "src\pages\RealStandardsMasterDataCenter.tsx"; Target = "src\pages\RealStandardsMasterDataCenter.tsx" },
  @{ Source = "src\pages\RealWorkflowExecutionCenter.tsx"; Target = "src\pages\RealWorkflowExecutionCenter.tsx" }
)

foreach ($pair in $copyPairs) {
  $src = Join-Path $patchRoot $pair.Source
  $dst = Join-Path $repoRoot $pair.Target
  if (!(Test-Path $src)) { throw "Missing patch file: $src" }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
  $srcResolved = (Resolve-Path $src).Path
  $dstResolved = if (Test-Path $dst) { (Resolve-Path $dst).Path } else { $dst }
  if ($srcResolved -ieq $dstResolved) {
    Write-Host "Already in place: $($pair.Target)" -ForegroundColor Yellow
  } else {
    Copy-Item -Force $src $dst
    Write-Host "Copied $($pair.Target)" -ForegroundColor Green
  }
}

$appPath = Join-Path $repoRoot "src\App.tsx"
$app = Get-Content $appPath -Raw

if ($app -notmatch "RealStandardsMasterDataCenter") {
  $anchor = "import { QualityAccreditationOperatingCenter } from './pages/QualityAccreditationOperatingCenter';"
  if ($app -notmatch [regex]::Escape($anchor)) { throw "Could not find QualityAccreditationOperatingCenter import anchor in src/App.tsx" }
  $app = $app.Replace($anchor, "$anchor`r`nimport { RealStandardsMasterDataCenter } from './pages/RealStandardsMasterDataCenter';")
}

if ($app -notmatch "RealWorkflowExecutionCenter") {
  $anchor = "import { ProfessionalWorkbenchesCenter } from './pages/ProfessionalWorkbenchesCenter';"
  if ($app -notmatch [regex]::Escape($anchor)) { throw "Could not find ProfessionalWorkbenchesCenter import anchor in src/App.tsx" }
  $app = $app.Replace($anchor, "$anchor`r`nimport { RealWorkflowExecutionCenter } from './pages/RealWorkflowExecutionCenter';")
}

if ($app -notmatch "id: 'realStandardsMasterData'") {
  $anchor = "{ id: 'qualityAccreditationOperating', label: t('hub.tab.qualityAccreditationOperating', 'Quality Operating Layer'), description: t('hub.tab.qualityAccreditationOperating.desc', 'Tracer rounds, indicators, RCA/CAPA, evidence packs, and requirement readiness work.'), icon: <ClipboardCheck size={17} />, content: <QualityAccreditationOperatingCenter /> },"
  if ($app -notmatch [regex]::Escape($anchor)) { throw "Could not find Quality Operating Layer tab anchor in src/App.tsx" }
  $insert = "$anchor`r`n        { id: 'realStandardsMasterData', label: t('hub.tab.realStandardsMasterData', 'Standards & Master Data'), description: t('hub.tab.realStandardsMasterData.desc', 'Licensed standards metadata, departments, committees, evidence taxonomy, controls, indicators, tracers, and document ownership.'), icon: <ClipboardList size={17} />, content: <RealStandardsMasterDataCenter /> },"
  $app = $app.Replace($anchor, $insert)
}

if ($app -notmatch "id: 'realWorkflowExecution'") {
  $anchor = "{ id: 'professionalWorkbenches', label: t('hub.tab.professionalWorkbenches', 'Professional Workbenches'), description: t('hub.tab.professionalWorkbenches.desc', 'Audit, risk, compliance, issue, response, and CAPA operating queues.'), icon: <FileSearch size={17} />, content: <ProfessionalWorkbenchesCenter /> },"
  if ($app -notmatch [regex]::Escape($anchor)) { throw "Could not find Professional Workbenches tab anchor in src/App.tsx" }
  $insert = "$anchor`r`n    { id: 'realWorkflowExecution', label: t('hub.tab.realWorkflowExecution', 'Real Workflow Execution'), description: t('hub.tab.realWorkflowExecution.desc', 'Submit, review, approve, evidence, close, escalate, issue CAPA, approve exceptions, and record management responses.'), icon: <ClipboardCheck size={17} />, content: <RealWorkflowExecutionCenter /> },"
  $app = $app.Replace($anchor, $insert)
}

if ($app -notmatch "RealStandardsMasterDataCenter") {
  throw "RealStandardsMasterDataCenter was not inserted into src/App.tsx"
}
if ($app -notmatch "id: 'realStandardsMasterData'") {
  throw "realStandardsMasterData tab was not inserted into src/App.tsx"
}
if ($app -notmatch "RealWorkflowExecutionCenter") {
  throw "RealWorkflowExecutionCenter was not inserted into src/App.tsx"
}
if ($app -notmatch "id: 'realWorkflowExecution'") {
  throw "realWorkflowExecution tab was not inserted into src/App.tsx"
}

Set-Content -Path $appPath -Value $app -Encoding UTF8
Write-Host "Updated src/App.tsx integration." -ForegroundColor Green
Write-Host "Patch 11+12 applied. Run verify-patch1112.ps1, then npm run typecheck and npm run build." -ForegroundColor Cyan
