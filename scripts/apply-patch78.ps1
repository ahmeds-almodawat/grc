param()

$ErrorActionPreference = "Stop"
$RepoRoot = (Get-Location).Path
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Downloads = Join-Path $env:USERPROFILE "Downloads"

$candidatePatchRoots = @(
  (Split-Path $ScriptDir -Parent),
  (Join-Path $Downloads "patch78_grc_changes"),
  (Join-Path (Split-Path $RepoRoot -Parent) "patch78_grc_changes")
) | Select-Object -Unique

$PatchRoot = $null
foreach ($candidate in $candidatePatchRoots) {
  if ($candidate -and (Test-Path (Join-Path $candidate "supabase\migrations\068_patch7_professional_audit_risk_compliance_workbenches.sql")) -and (Test-Path (Join-Path $candidate "src\pages\AssuranceGoLiveCenter.tsx"))) {
    $PatchRoot = $candidate
    break
  }
}

if (!$PatchRoot) {
  throw "Could not locate patch78_grc_changes. Extract grc_patch78_professional_workbenches_assurance.zip under Downloads first."
}

if (!(Test-Path (Join-Path $RepoRoot "package.json"))) {
  throw "Run this script from the repo root, for example C:\Users\molte\Downloads\grc-control-center"
}

Write-Host "Applying Patch 7+8: Professional Workbenches + Assurance Go-Live Pack..."
Write-Host "Repo root: $RepoRoot"
Write-Host "Patch root: $PatchRoot"

$files = @(
  "supabase\migrations\068_patch7_professional_audit_risk_compliance_workbenches.sql",
  "supabase\migrations\069_patch8_assurance_security_go_live_pack.sql",
  "src\lib\professionalWorkbenchesApi.ts",
  "src\lib\assuranceGoLiveApi.ts",
  "src\pages\ProfessionalWorkbenchesCenter.tsx",
  "src\pages\AssuranceGoLiveCenter.tsx"
)

foreach ($relative in $files) {
  $src = Join-Path $PatchRoot $relative
  $dst = Join-Path $RepoRoot $relative
  if (!(Test-Path $src)) { throw "Missing patch file: $src" }
  New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null
  $srcResolved = (Resolve-Path $src).Path
  $dstResolved = if (Test-Path $dst) { (Resolve-Path $dst).Path } else { $dst }
  if ($srcResolved -ieq $dstResolved) {
    Write-Host "Already in place: $relative" -ForegroundColor Yellow
  } else {
    Copy-Item -Force $src $dst
  }
}

$appPath = Join-Path $RepoRoot "src\App.tsx"
$app = Get-Content $appPath -Raw

if ($app -notmatch "ProfessionalWorkbenchesCenter") {
  $anchor = "import { WorkflowKernelCenter } from './pages/WorkflowKernelCenter';"
  if ($app -match [regex]::Escape($anchor)) {
    $app = $app.Replace($anchor, "$anchor`r`nimport { ProfessionalWorkbenchesCenter } from './pages/ProfessionalWorkbenchesCenter';")
  } else {
    $qualityAnchor = "import { QualityAccreditationOperatingCenter } from './pages/QualityAccreditationOperatingCenter';"
    if ($app -match [regex]::Escape($qualityAnchor)) {
      $app = $app.Replace($qualityAnchor, "$qualityAnchor`r`nimport { ProfessionalWorkbenchesCenter } from './pages/ProfessionalWorkbenchesCenter';")
    } else {
      throw "Could not find import anchor for ProfessionalWorkbenchesCenter."
    }
  }
}

if ($app -notmatch "AssuranceGoLiveCenter") {
  $anchor = "import { AuditEvidenceGovernanceCenter } from './pages/AuditEvidenceGovernanceCenter';"
  if ($app -match [regex]::Escape($anchor)) {
    $app = $app.Replace($anchor, "$anchor`r`nimport { AssuranceGoLiveCenter } from './pages/AssuranceGoLiveCenter';")
  } else {
    throw "Could not find import anchor for AssuranceGoLiveCenter."
  }
}

if ($app -notmatch "id: 'professionalWorkbenches'") {
  $anchor = "{ id: 'workflowKernel', label: t('hub.tab.workflowKernel', 'Workflow Kernel'), description: t('hub.tab.workflowKernel.desc', 'Cross-module workflow routing, approvals, SLA, and escalation control.'), icon: <ClipboardList size={17} />, content: <WorkflowKernelCenter /> },"
  $insert = "$anchor`r`n    { id: 'professionalWorkbenches', label: t('hub.tab.professionalWorkbenches', 'Professional Workbenches'), description: t('hub.tab.professionalWorkbenches.desc', 'Audit, risk, compliance, issue, response, and CAPA operating queues.'), icon: <FileSearch size={17} />, content: <ProfessionalWorkbenchesCenter /> },"
  if ($app -match [regex]::Escape($anchor)) {
    $app = $app.Replace($anchor, $insert)
  } else {
    $fallback = "{ id: 'audit', label: t('hub.tab.audit'), description: t('hub.tab.audit.desc'), icon: <FileSearch size={17} />, content: <Audit /> },"
    $insertFallback = "{ id: 'professionalWorkbenches', label: t('hub.tab.professionalWorkbenches', 'Professional Workbenches'), description: t('hub.tab.professionalWorkbenches.desc', 'Audit, risk, compliance, issue, response, and CAPA operating queues.'), icon: <FileSearch size={17} />, content: <ProfessionalWorkbenchesCenter /> },`r`n    $fallback"
    if ($app -match [regex]::Escape($fallback)) {
      $app = $app.Replace($fallback, $insertFallback)
    } else {
      throw "Could not find GRC tab anchor for Professional Workbenches."
    }
  }
}

if ($app -notmatch "id: 'assuranceGoLive'") {
  $anchor = "{ id: 'auditEvidenceGovernance', label: t('hub.tab.auditEvidenceGovernance', 'Audit & Evidence Integrity'), description: t('hub.tab.auditEvidenceGovernance.desc', 'Audit workbench, evidence integrity, and production governance gates.'), icon: <FileCheck2 size={17} />, content: <AuditEvidenceGovernanceCenter /> },"
  $insert = "$anchor`r`n        { id: 'assuranceGoLive', label: t('hub.tab.assuranceGoLive', 'Assurance Go-Live Pack'), description: t('hub.tab.assuranceGoLive.desc', 'External auditor portal, signoffs, rollback, monitoring, training, and production decisions.'), icon: <PackageCheck size={17} />, content: <AssuranceGoLiveCenter /> },"
  if ($app -match [regex]::Escape($anchor)) {
    $app = $app.Replace($anchor, $insert)
  } else {
    $fallback = "{ id: 'productionProof', label: t('hub.tab.productionProof', 'Production Proof'), description: t('hub.tab.productionProof.desc', 'Final evidence-based go-live proof gates.'), icon: <PackageCheck size={17} />, content: <ProductionProofCenter /> },"
    $insertFallback = "{ id: 'assuranceGoLive', label: t('hub.tab.assuranceGoLive', 'Assurance Go-Live Pack'), description: t('hub.tab.assuranceGoLive.desc', 'External auditor portal, signoffs, rollback, monitoring, training, and production decisions.'), icon: <PackageCheck size={17} />, content: <AssuranceGoLiveCenter /> },`r`n        $fallback"
    if ($app -match [regex]::Escape($fallback)) {
      $app = $app.Replace($fallback, $insertFallback)
    } else {
      throw "Could not find Admin tab anchor for Assurance Go-Live Pack."
    }
  }
}

if ($app -notmatch "ProfessionalWorkbenchesCenter") {
  throw "ProfessionalWorkbenchesCenter was not inserted into src/App.tsx"
}
if ($app -notmatch "id: 'professionalWorkbenches'") {
  throw "professionalWorkbenches tab was not inserted into src/App.tsx"
}
if ($app -notmatch "AssuranceGoLiveCenter") {
  throw "AssuranceGoLiveCenter was not inserted into src/App.tsx"
}
if ($app -notmatch "id: 'assuranceGoLive'") {
  throw "assuranceGoLive tab was not inserted into src/App.tsx"
}

Set-Content -Path $appPath -Value $app -Encoding UTF8

$readmePath = Join-Path $RepoRoot "README.md"
if (Test-Path $readmePath) {
  $readme = Get-Content $readmePath -Raw
  $note = @"

## Patch 7-8 Professional Workbenches and Assurance Go-Live Pack

Patch 7 turns audit, risk, compliance, issue, management-response, and CAPA records into operating workbenches. Patch 8 adds go-live assurance controls including external auditor packages, read-only sessions, retention/confidentiality, training, SOPs, board/committee packs, signoffs, rollback/restore exercises, monitoring checks, controlled pilot signoff, and production decisions. Passing proof commands still does not equal production approval; real evidence and executive/IT/Quality signoffs remain required.
"@
  if ($readme -notmatch "Patch 7-8 Professional Workbenches") {
    Add-Content -Path $readmePath -Value $note -Encoding UTF8
  }
}

Write-Host "Patch 7+8 files copied and App.tsx integration attempted."
Write-Host "Next: run verify-patch78.ps1, then npm run typecheck, build, test, and proof gates."
