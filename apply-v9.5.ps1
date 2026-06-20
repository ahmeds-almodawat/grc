param(
  [string]$RepoPath = "."
)

$ErrorActionPreference = "Stop"
$SourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ResolvedRepo = Resolve-Path $RepoPath

$paths = @(
  "README_APPLY_V95_PATCH.md",
  "docs/V95_APPROVAL_EXECUTION_WORKSPACE_PACK.md",
  "docs/FINAL_APPROVAL_EXECUTION_SOP.md",
  "docs/APPROVAL_ENTRY_QA_GUIDE.md",
  "docs/APPROVER_MEETING_SCRIPT.md",
  "docs/POST_APPROVAL_PROOF_RUNBOOK_V95.md",
  "docs/APPROVAL_EVIDENCE_BINDER_POLICY.md",
  "scripts/v95-common.mjs",
  "scripts/v95-install-package-scripts.mjs",
  "scripts/v95-approval-execution-workspace.mjs",
  "scripts/v95-approval-qa-summary.mjs",
  "scripts/v95-evidence-binder-index.mjs",
  "scripts/v95-approver-action-drafts.mjs",
  "scripts/v95-final-proof-dryrun-plan.mjs",
  "scripts/v95-generate-review-pack.mjs",
  ".github/workflows/approval-execution-workspace.yml"
)

foreach ($relative in $paths) {
  $src = Join-Path $SourceRoot $relative
  $dst = Join-Path $ResolvedRepo $relative
  $dstDir = Split-Path -Parent $dst
  if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Force -Path $dstDir | Out-Null }
  Copy-Item -Force $src $dst
}

Write-Host "v9.5 Approval Execution Workspace Pack applied."
Write-Host "Next: node .\scripts\v95-install-package-scripts.mjs"
Write-Host "Then: npm run pilot:approval-execution-workspace"
