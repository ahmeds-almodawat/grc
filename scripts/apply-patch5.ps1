$ErrorActionPreference = "Stop"

Write-Host "Applying Patch 5: Workflow Kernel..." -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PatchRoot = Split-Path -Parent $ScriptDir
$RepoRoot = (Get-Location).Path

if (!(Test-Path (Join-Path $RepoRoot "package.json"))) {
  throw "Run this script from the repository root where package.json exists. Current: $RepoRoot"
}

$FilesRoot = Join-Path $PatchRoot "files"
if (!(Test-Path $FilesRoot)) {
  throw "Patch files folder not found: $FilesRoot. Extract patch5_grc_changes to Downloads and run the script from repo root."
}

function Copy-PatchFile($relativePath) {
  $src = Join-Path $FilesRoot $relativePath
  $dst = Join-Path $RepoRoot $relativePath
  if (!(Test-Path $src)) { throw "Missing patch file: $src" }
  $dstDir = Split-Path -Parent $dst
  if (!(Test-Path $dstDir)) { New-Item -ItemType Directory -Force -Path $dstDir | Out-Null }
  Copy-Item -Force $src $dst
  Write-Host "Copied: $relativePath" -ForegroundColor Green
}

Copy-PatchFile "supabase\migrations\066_patch5_workflow_kernel.sql"
Copy-PatchFile "src\lib\workflowKernelApi.ts"
Copy-PatchFile "src\pages\WorkflowKernelCenter.tsx"

$appPath = Join-Path $RepoRoot "src\App.tsx"
if (!(Test-Path $appPath)) { throw "src/App.tsx not found" }
$app = Get-Content $appPath -Raw

if ($app -notmatch "WorkflowKernelCenter") {
  $anchor = "import { LiveGrcOperatingCore } from './pages/LiveGrcOperatingCore';"
  if ($app.Contains($anchor)) {
    $app = $app.Replace($anchor, "$anchor`r`nimport { WorkflowKernelCenter } from './pages/WorkflowKernelCenter';")
  } else {
    $app = $app.Replace("import { Governance } from './pages/Governance';", "import { WorkflowKernelCenter } from './pages/WorkflowKernelCenter';`r`nimport { Governance } from './pages/Governance';")
  }
}

if ($app -notmatch "AuditEvidenceGovernanceCenter") {
  $anchor = "import { ProductionProofCenter } from './pages/ProductionProofCenter';"
  if ($app.Contains($anchor)) {
    $app = $app.Replace($anchor, "$anchor`r`nimport { AuditEvidenceGovernanceCenter } from './pages/AuditEvidenceGovernanceCenter';")
  }
}

$operatingCoreTab = "{ id: 'operatingCore', label: t('hub.tab.operatingCore', 'Operating Core'), description: t('hub.tab.operatingCore.desc', 'Risk, controls, tests, evidence, CAPA, and obligations.'), icon: <Network size={17} />, content: <LiveGrcOperatingCore /> },"
$workflowTab = "{ id: 'workflowKernel', label: t('hub.tab.workflowKernel', 'Workflow Kernel'), description: t('hub.tab.workflowKernel.desc', 'Shared owner, reviewer, approver, SLA, escalation, and RACI workflow engine.'), icon: <Network size={17} />, content: <WorkflowKernelCenter /> },"

if ($app -notmatch "id: 'workflowKernel'") {
  if ($app.Contains($operatingCoreTab)) {
    $app = $app.Replace($operatingCoreTab, "$operatingCoreTab`r`n    $workflowTab")
  } else {
    Write-Warning "Could not find Operating Core tab anchor. Codex may need to insert WorkflowKernelCenter manually."
  }
}

$productionProofTab = "{ id: 'productionProof', label: t('hub.tab.productionProof', 'Production Proof'), description: t('hub.tab.productionProof.desc', 'Final evidence-based go-live proof gates.'), icon: <PackageCheck size={17} />, content: <ProductionProofCenter /> },"
$auditEvidenceTab = "{ id: 'auditEvidenceGovernance', label: t('hub.tab.auditEvidenceGovernance', 'Audit & Evidence Integrity'), description: t('hub.tab.auditEvidenceGovernance.desc', 'Audit workbench, evidence integrity, and production governance gates.'), icon: <FileCheck2 size={17} />, content: <AuditEvidenceGovernanceCenter /> },"

if ($app -notmatch "id: 'auditEvidenceGovernance'") {
  if ($app.Contains($productionProofTab)) {
    $app = $app.Replace($productionProofTab, "$productionProofTab`r`n        $auditEvidenceTab")
  } else {
    Write-Warning "Could not find Production Proof tab anchor. Codex may need to insert AuditEvidenceGovernanceCenter manually."
  }
}

Set-Content -Path $appPath -Value $app -Encoding UTF8
Write-Host "App.tsx integration attempted." -ForegroundColor Green
Write-Host "Next: run .\patch5_grc_changes\scripts\verify-patch5.ps1 or the commands in PATCH5_DEPLOY_INSTRUCTIONS.md" -ForegroundColor Cyan
