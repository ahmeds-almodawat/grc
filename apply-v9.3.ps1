param(
  [string]$RepoPath = "."
)

$ErrorActionPreference = "Stop"

$PatchRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoFullPath = Resolve-Path $RepoPath

Write-Host "Applying v9.3 Final Approval Command Center Pack..." -ForegroundColor Cyan
Write-Host "Patch root: $PatchRoot"
Write-Host "Repo path:   $RepoFullPath"

$items = @(
  "README_APPLY_V93_PATCH.md",
  ".github/workflows/final-approval-command-center.yml",
  "docs/V93_FINAL_APPROVAL_COMMAND_CENTER.md",
  "docs/FINAL_APPROVAL_PACKET_OPERATING_MODEL.md",
  "docs/APPROVAL_GATE_FIELD_OWNERSHIP.md",
  "docs/APPROVER_MEETING_SCRIPT.md",
  "docs/EVIDENCE_FREEZE_AND_TRACEABILITY.md",
  "docs/POST_APPROVAL_PROOF_PROTOCOL.md",
  "docs/CONTROLLED_PILOT_LAUNCH_CONDITIONS.md",
  "docs/V93_NEXT_DECISION_BOUNDARY.md",
  "scripts/v93-common.mjs",
  "scripts/v93-install-package-scripts.mjs",
  "scripts/v93-gate-snapshot.mjs",
  "scripts/v93-approval-packet-index.mjs",
  "scripts/v93-approver-task-board.mjs",
  "scripts/v93-signoff-json-guide.mjs",
  "scripts/v93-release-freeze-check.mjs",
  "scripts/v93-post-approval-proof-protocol.mjs",
  "scripts/v93-final-approval-command-center.mjs",
  "scripts/v93-generate-review-pack.mjs"
)

foreach ($item in $items) {
  $src = Join-Path $PatchRoot $item
  $dst = Join-Path $RepoFullPath $item
  if (!(Test-Path $src)) { throw "Missing patch file: $item" }
  $dstDir = Split-Path -Parent $dst
  if (!(Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
  Copy-Item -Path $src -Destination $dst -Force
  Write-Host "Copied $item"
}

Write-Host "v9.3 patch files copied." -ForegroundColor Green
Write-Host "Next required command: node .\scripts\v93-install-package-scripts.mjs" -ForegroundColor Yellow
