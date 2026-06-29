param(
  [switch]$NoBackup
)

$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$appPath = Join-Path $repoRoot "src\App.tsx"

if (-not (Test-Path $appPath)) {
  throw "src\App.tsx not found. Run this script from the repository root."
}

Write-Host "Applying final cleanup: expose Audit Evidence Governance workspace..." -ForegroundColor Cyan
Write-Host "Repo root: $repoRoot"

if (-not $NoBackup) {
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $backupRoot = Join-Path $repoRoot ".final-cleanup-backup\$stamp"
  New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
  Copy-Item $appPath (Join-Path $backupRoot "App.tsx")
  Write-Host "Backup created: $backupRoot"
}

$app = Get-Content $appPath -Raw -Encoding UTF8

if ($app -notmatch "AuditEvidenceGovernanceCenter") {
  $needle = "import { ProductionProofCenter } from './pages/ProductionProofCenter';"
  $replacement = "$needle`r`nimport { AuditEvidenceGovernanceCenter } from './pages/AuditEvidenceGovernanceCenter';"
  if ($app.Contains($needle)) {
    $app = $app.Replace($needle, $replacement)
  } else {
    throw "Could not find ProductionProofCenter import anchor. Use Codex final cleanup command."
  }
}

if ($app -notmatch "auditEvidenceGovernance") {
  $tabLine = "        { id: 'auditEvidenceGovernance', label: t('hub.tab.auditEvidenceGovernance', 'Audit & Evidence Integrity'), description: t('hub.tab.auditEvidenceGovernance.desc', 'Audit workbench, evidence hash chain, external auditor sessions, and production gate governance.'), icon: <FileSearch size={17} />, content: <AuditEvidenceGovernanceCenter /> },"
  $anchor = "        { id: 'productionProof', label: t('hub.tab.productionProof', 'Production Proof'), description: t('hub.tab.productionProof.desc', 'Final evidence-based go-live proof gates.'), icon: <PackageCheck size={17} />, content: <ProductionProofCenter /> },"
  if ($app.Contains($anchor)) {
    $app = $app.Replace($anchor, "$anchor`r`n$tabLine")
  } else {
    throw "Could not find Admin hub productionProof tab anchor. Use Codex final cleanup command."
  }
}

Set-Content -Path $appPath -Value $app -Encoding UTF8

Write-Host "Final cleanup applied." -ForegroundColor Green
Write-Host "Next run:"
Write-Host "npm run typecheck"
Write-Host "npm run build"
Write-Host "npm run test:unit"
Write-Host "npm run test:e2e"
Write-Host "npm audit --audit-level=high"
Write-Host "npm run proof:all"
Write-Host "npm run v672:capture"
Write-Host "npm run v700:v65-audit"
