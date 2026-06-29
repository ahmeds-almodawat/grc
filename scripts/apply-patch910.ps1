$ErrorActionPreference = "Stop"

Write-Host "Applying Patch 9+10: Runtime Actions + Real Data UAT Readiness..."

$repoRoot = (Get-Location).Path
if (!(Test-Path (Join-Path $repoRoot "package.json"))) {
  throw "Run this script from the repo root, for example: C:\Users\molte\Downloads\grc-control-center"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$candidateRoots = @(
  (Split-Path -Parent $scriptDir),
  "C:\Users\molte\Downloads\patch910_grc_changes"
)

$patchRoot = $null
foreach ($candidate in $candidateRoots) {
  if ($candidate -and (Test-Path (Join-Path $candidate "supabase\migrations\070_patch9_runtime_workflow_actions_escalations.sql"))) {
    $patchRoot = $candidate
    break
  }
}

if (!$patchRoot) {
  throw "Could not locate patch910_grc_changes. Extract grc_patch910_runtime_actions_real_data_uat.zip to C:\Users\molte\Downloads first."
}

$files = @(
  "supabase\migrations\070_patch9_runtime_workflow_actions_escalations.sql",
  "supabase\migrations\071_patch10_real_data_activation_uat_readiness.sql",
  "src\lib\runtimeWorkflowActionsApi.ts",
  "src\lib\realDataUatReadinessApi.ts",
  "src\pages\RuntimeWorkflowActionsCenter.tsx",
  "src\pages\RealDataUatReadinessCenter.tsx"
)

foreach ($relative in $files) {
  $src = Join-Path $patchRoot $relative
  $dest = Join-Path $repoRoot $relative
  if (!(Test-Path $src)) { throw "Missing patch file: $src" }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
  $srcResolved = (Resolve-Path $src).Path
  $destResolved = if (Test-Path $dest) { (Resolve-Path $dest).Path } else { $dest }
  if ($srcResolved -ieq $destResolved) {
    Write-Host "Already in place: $relative" -ForegroundColor Yellow
  } else {
    Copy-Item -Force $src $dest
    Write-Host "Copied: $relative"
  }
}

$appPath = Join-Path $repoRoot "src\App.tsx"
if (!(Test-Path $appPath)) { throw "src\App.tsx not found" }
$app = Get-Content $appPath -Raw -Encoding UTF8

if ($app -notmatch "RuntimeWorkflowActionsCenter") {
  if ($app -match "import \{ ProfessionalWorkbenchesCenter \} from './pages/ProfessionalWorkbenchesCenter';") {
    $app = $app -replace "import \{ ProfessionalWorkbenchesCenter \} from './pages/ProfessionalWorkbenchesCenter';", "import { ProfessionalWorkbenchesCenter } from './pages/ProfessionalWorkbenchesCenter';`r`nimport { RuntimeWorkflowActionsCenter } from './pages/RuntimeWorkflowActionsCenter';"
  } else {
    throw "Could not insert RuntimeWorkflowActionsCenter import. Ask Codex to fix App.tsx integration."
  }
}

if ($app -notmatch "RealDataUatReadinessCenter") {
  if ($app -match "import \{ AssuranceGoLiveCenter \} from './pages/AssuranceGoLiveCenter';") {
    $app = $app -replace "import \{ AssuranceGoLiveCenter \} from './pages/AssuranceGoLiveCenter';", "import { AssuranceGoLiveCenter } from './pages/AssuranceGoLiveCenter';`r`nimport { RealDataUatReadinessCenter } from './pages/RealDataUatReadinessCenter';"
  } elseif ($app -match "import \{ AuditEvidenceGovernanceCenter \} from './pages/AuditEvidenceGovernanceCenter';") {
    $app = $app -replace "import \{ AuditEvidenceGovernanceCenter \} from './pages/AuditEvidenceGovernanceCenter';", "import { AuditEvidenceGovernanceCenter } from './pages/AuditEvidenceGovernanceCenter';`r`nimport { RealDataUatReadinessCenter } from './pages/RealDataUatReadinessCenter';"
  } else {
    throw "Could not insert RealDataUatReadinessCenter import. Ask Codex to fix App.tsx integration."
  }
}

if ($app -notmatch "id: 'runtimeWorkflowActions'") {
  $needle = "{ id: 'professionalWorkbenches', label: t('hub.tab.professionalWorkbenches', 'Professional Workbenches'), description: t('hub.tab.professionalWorkbenches.desc', 'Audit, risk, compliance, issue, response, and CAPA operating queues.'), icon: <FileSearch size={17} />, content: <ProfessionalWorkbenchesCenter /> },"
  $insert = "$needle`r`n    { id: 'runtimeWorkflowActions', label: t('hub.tab.runtimeWorkflowActions', 'Runtime Actions'), description: t('hub.tab.runtimeWorkflowActions.desc', 'Action requests, transitions, notifications, escalation rules, integration outbox, and runtime exceptions.'), icon: <BellRing size={17} />, content: <RuntimeWorkflowActionsCenter /> },"
  if ($app.Contains($needle)) {
    $app = $app.Replace($needle, $insert)
  } else {
    throw "Could not insert Runtime Actions tab. Ask Codex to fix App.tsx integration."
  }
}

if ($app -notmatch "id: 'realDataUatReadiness'") {
  $needle = "{ id: 'assuranceGoLive', label: t('hub.tab.assuranceGoLive', 'Assurance Go-Live Pack'), description: t('hub.tab.assuranceGoLive.desc', 'External auditor portal, signoffs, rollback, monitoring, training, and production decisions.'), icon: <PackageCheck size={17} />, content: <AssuranceGoLiveCenter /> },"
  $insert = "$needle`r`n        { id: 'realDataUatReadiness', label: t('hub.tab.realDataUatReadiness', 'Real Data & UAT'), description: t('hub.tab.realDataUatReadiness.desc', 'Licensed content loading, import validation, mappings, UAT cycles, training, signoffs, and go/no-go readiness.'), icon: <ClipboardCheck size={17} />, content: <RealDataUatReadinessCenter /> },"
  if ($app.Contains($needle)) {
    $app = $app.Replace($needle, $insert)
  } else {
    throw "Could not insert Real Data & UAT tab. Ask Codex to fix App.tsx integration."
  }
}

if ($app -notmatch "RuntimeWorkflowActionsCenter") {
  throw "RuntimeWorkflowActionsCenter was not inserted into src/App.tsx"
}
if ($app -notmatch "id: 'runtimeWorkflowActions'") {
  throw "runtimeWorkflowActions tab was not inserted into src/App.tsx"
}
if ($app -notmatch "RealDataUatReadinessCenter") {
  throw "RealDataUatReadinessCenter was not inserted into src/App.tsx"
}
if ($app -notmatch "id: 'realDataUatReadiness'") {
  throw "realDataUatReadiness tab was not inserted into src/App.tsx"
}

Set-Content -Path $appPath -Value $app -Encoding UTF8
Write-Host "Updated src/App.tsx integration."
Write-Host "Patch 9+10 applied. Run verify-patch910.ps1, npm run typecheck, npm run build, npm run v64:rls-strict, and npm run proof:all."
