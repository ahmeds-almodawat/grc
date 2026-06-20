param(
  [string]$RepoPath = "."
)

$ErrorActionPreference = "Stop"
$sourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetRoot = Resolve-Path $RepoPath

$items = @(
  "README_APPLY_V92_PATCH.md",
  "docs/V92_SIGNOFF_EVIDENCE_QA_PACK.md",
  "docs/APPROVAL_JSON_FIELD_GUIDE.md",
  "docs/APPROVER_QA_CHECKLIST.md",
  "docs/SIGNOFF_RECORD_RETENTION_SOP.md",
  "docs/FINAL_PROOF_RUN_GUIDE.md",
  "scripts/v92-install-package-scripts.mjs",
  "scripts/v92-approval-field-map.mjs",
  "scripts/v92-generate-redline-checklist.mjs",
  "scripts/v92-generate-packet-index.mjs",
  "scripts/v92-generate-final-proof-run-sequence.mjs",
  "scripts/v92-generate-review-pack.mjs",
  ".github/workflows/signoff-evidence-qa.yml"
)

foreach ($item in $items) {
  $src = Join-Path $sourceRoot $item
  $dst = Join-Path $targetRoot $item
  $dstDir = Split-Path -Parent $dst
  if (!(Test-Path $dstDir)) { New-Item -ItemType Directory -Force -Path $dstDir | Out-Null }
  Copy-Item -Force $src $dst
}

Write-Host "v9.2 Signoff Evidence QA Pack applied."
Write-Host "Next: node .\scripts\v92-install-package-scripts.mjs"
Write-Host "Then: npm run pilot:signoff-evidence-qa"
