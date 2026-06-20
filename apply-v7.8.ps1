param(
  [string]$RepoPath = "C:\Users\molte\Downloads\grc-control-center"
)

$ErrorActionPreference = "Stop"
$PatchRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path $RepoPath)) {
  throw "RepoPath not found: $RepoPath"
}

function Copy-ItemSafe($SourceRelative, $DestinationRelative) {
  $source = Join-Path $PatchRoot $SourceRelative
  $destination = Join-Path $RepoPath $DestinationRelative
  $destinationDir = Split-Path -Parent $destination
  if (-not (Test-Path $destinationDir)) {
    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
  }
  Copy-Item -Path $source -Destination $destination -Force
}

$files = @(
  @('README_APPLY_V78_PATCH.md', 'README_APPLY_V78_PATCH.md'),
  @('apply-v7.8.ps1', 'apply-v7.8.ps1'),
  @('docs/V78_LIVE_STAGING_EXECUTION_PACK.md', 'docs/V78_LIVE_STAGING_EXECUTION_PACK.md'),
  @('docs/LIVE_STAGING_EXECUTION_RUNBOOK.md', 'docs/LIVE_STAGING_EXECUTION_RUNBOOK.md'),
  @('docs/ENVIRONMENT_VARIABLE_VALIDATION_GUIDE.md', 'docs/ENVIRONMENT_VARIABLE_VALIDATION_GUIDE.md'),
  @('docs/SUPABASE_STAGING_VALIDATION_SOP.md', 'docs/SUPABASE_STAGING_VALIDATION_SOP.md'),
  @('docs/VERCEL_STAGING_DEPLOYMENT_SOP.md', 'docs/VERCEL_STAGING_DEPLOYMENT_SOP.md'),
  @('docs/STAGING_SMOKE_TEST_MATRIX.md', 'docs/STAGING_SMOKE_TEST_MATRIX.md'),
  @('docs/STAGING_ROLLBACK_DRILL.md', 'docs/STAGING_ROLLBACK_DRILL.md'),
  @('docs/STAGING_ACCESS_CONTROL_CHECKLIST.md', 'docs/STAGING_ACCESS_CONTROL_CHECKLIST.md'),
  @('docs/STAGING_DATA_SEEDING_POLICY.md', 'docs/STAGING_DATA_SEEDING_POLICY.md'),
  @('docs/STAGING_OBSERVABILITY_GUIDE.md', 'docs/STAGING_OBSERVABILITY_GUIDE.md'),
  @('docs/STAGING_GO_NO_GO_MEETING_PACK.md', 'docs/STAGING_GO_NO_GO_MEETING_PACK.md'),
  @('docs/V78_NEXT_PHASE_PLAN.md', 'docs/V78_NEXT_PHASE_PLAN.md'),
  @('scripts/v78-common.mjs', 'scripts/v78-common.mjs'),
  @('scripts/v78-install-package-scripts.mjs', 'scripts/v78-install-package-scripts.mjs'),
  @('scripts/v78-env-template-audit.mjs', 'scripts/v78-env-template-audit.mjs'),
  @('scripts/v78-staging-execution-plan.mjs', 'scripts/v78-staging-execution-plan.mjs'),
  @('scripts/v78-smoke-test-plan.mjs', 'scripts/v78-smoke-test-plan.mjs'),
  @('scripts/v78-rollback-readiness.mjs', 'scripts/v78-rollback-readiness.mjs'),
  @('scripts/v78-access-control-plan.mjs', 'scripts/v78-access-control-plan.mjs'),
  @('scripts/v78-observability-plan.mjs', 'scripts/v78-observability-plan.mjs'),
  @('scripts/v78-go-no-go-pack.mjs', 'scripts/v78-go-no-go-pack.mjs'),
  @('scripts/v78-generate-review-pack.mjs', 'scripts/v78-generate-review-pack.mjs'),
  @('.github/workflows/live-staging-plan.yml', '.github/workflows/live-staging-plan.yml')
)

foreach ($file in $files) {
  Copy-ItemSafe $file[0] $file[1]
}

Push-Location $RepoPath
try {
  node .\scripts\v78-install-package-scripts.mjs
} finally {
  Pop-Location
}

Write-Host "v7.8 patch applied and package scripts installed."
Write-Host "Next: npm run pilot:live-staging-plan"
