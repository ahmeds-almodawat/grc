$ErrorActionPreference = "Stop"

$PatchRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$RepoRoot = Get-Location
$FilesRoot = Join-Path $PatchRoot "files"

Write-Host "Applying Patch 4: Audit, Evidence Integrity, and Production Governance..." -ForegroundColor Cyan
Write-Host "Repo root: $RepoRoot"
Write-Host "Patch root: $PatchRoot"

if (-not (Test-Path (Join-Path $RepoRoot "package.json"))) {
  throw "Run this script from the repository root. package.json was not found."
}

Copy-Item -Path (Join-Path $FilesRoot "*") -Destination $RepoRoot -Recurse -Force

$AppPath = Join-Path $RepoRoot "src\App.tsx"
$app = Get-Content $AppPath -Raw

if ($app -notmatch "AuditEvidenceGovernanceCenter") {
  $app = $app -replace "import \{ ProductionProofCenter \} from './pages/ProductionProofCenter';", "import { ProductionProofCenter } from './pages/ProductionProofCenter';`r`nimport { AuditEvidenceGovernanceCenter } from './pages/AuditEvidenceGovernanceCenter';"
}

$tabLine = "        { id: 'auditEvidenceGovernance', label: t('hub.tab.auditEvidenceGovernance', 'Audit & Evidence Integrity'), description: t('hub.tab.auditEvidenceGovernance.desc', 'Audit workbench, evidence hash chain, external auditor access, and go-live gates.'), icon: <FileCheck2 size={17} />, content: <AuditEvidenceGovernanceCenter /> },"

if ($app -notmatch "auditEvidenceGovernance") {
  $target = "        { id: 'productionProof', label: t('hub.tab.productionProof', 'Production Proof'), description: t('hub.tab.productionProof.desc', 'Final evidence-based go-live proof gates.'), icon: <PackageCheck size={17} />, content: <ProductionProofCenter /> },"
  if ($app.Contains($target)) {
    $app = $app.Replace($target, "$target`r`n$tabLine")
  } else {
    Write-Warning "Could not find productionProof tab insertion point. Add AuditEvidenceGovernanceCenter manually to AdminReleaseHub."
  }
}

Set-Content -Path $AppPath -Value $app -Encoding UTF8

$ReadmePath = Join-Path $RepoRoot "README.md"
if (Test-Path $ReadmePath) {
  $readme = Get-Content $ReadmePath -Raw
  if ($readme -notmatch "Patch 4 governance note") {
    $note = @"

## Patch 4 governance note

Audit, evidence integrity, external auditor access, and production governance gates are now treated as live operating controls. Technical proof, generated evidence packs, or passing CI do not equal production approval. Production readiness remains blocked until real management, IT, Quality, confidentiality, live bridge, access review, restore/rollback, RLS persona, and controlled pilot signoff evidence are approved.
"@
    $readme = $readme.TrimEnd() + $note + "`r`n"
    Set-Content -Path $ReadmePath -Value $readme -Encoding UTF8
  }
}

Write-Host "Patch 4 files copied and App.tsx integration attempted." -ForegroundColor Green
Write-Host "Next: run .\patch4_grc_changes\scripts\verify-patch4.ps1 or the commands in PATCH4_DEPLOY_INSTRUCTIONS.md"
