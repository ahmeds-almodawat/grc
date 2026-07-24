$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath 'C:\Users\molte\Downloads\grc-control-center').Path
Set-Location -LiteralPath $repo
if ((git branch --show-current) -ne 'release/grc-platform-1.0.0-rc.2') { throw 'Wrong branch' }
if ((git rev-parse HEAD) -ne '87074faa9476a6d158199426871167ae30cd5a55') { throw 'Wrong HEAD' }
if (@(git diff --cached --name-only).Count -ne 0) { throw 'Index is not empty' }
git add -- 'package-lock.json'
git add -- 'release/production-readiness/gate13br3-baseline-v3-validation-20260724.json'
git add -- 'release/production-readiness/gate13br3-baseline-v3-validation-20260724.md'
git add -- 'release/production-readiness/gate13br3-control-traceability-20260724.json'
git add -- 'release/production-readiness/gate13br3-control-traceability-20260724.md'
git add -- 'release/production-readiness/gate13br3-decision-20260724.json'
git add -- 'release/production-readiness/gate13br3-decision-20260724.md'
git add -- 'release/production-readiness/gate13br3-dual-lineage-validation-20260724.json'
git add -- 'release/production-readiness/gate13br3-dual-lineage-validation-20260724.md'
git add -- 'release/production-readiness/gate13br3-expected-post187-catalog-fingerprint-20260724.json'
git add -- 'release/production-readiness/gate13br3-expected-post187-catalog-fingerprint-20260724.sha256'
git add -- 'release/production-readiness/gate13br3-final-clone-rehearsal-plan-20260724.json'
git add -- 'release/production-readiness/gate13br3-final-clone-rehearsal-plan-20260724.md'
git add -- 'release/production-readiness/gate13br3-forced-rotation-validation-20260724.json'
git add -- 'release/production-readiness/gate13br3-forced-rotation-validation-20260724.md'
git add -- 'release/production-readiness/gate13br3-independent-security-review-20260724.json'
git add -- 'release/production-readiness/gate13br3-independent-security-review-20260724.md'
git add -- 'release/production-readiness/gate13br3-input-verification-20260724.json'
git add -- 'release/production-readiness/gate13br3-input-verification-20260724.md'
git add -- 'release/production-readiness/gate13br3-migration-hashes-20260724.json'
git add -- 'release/production-readiness/gate13br3-migration-hashes-20260724.md'
git add -- 'release/production-readiness/gate13br3-migration187-sequencing-analysis-20260724.json'
git add -- 'release/production-readiness/gate13br3-migration187-sequencing-analysis-20260724.md'
git add -- 'release/production-readiness/gate13br3-negative-validation-20260724.json'
git add -- 'release/production-readiness/gate13br3-negative-validation-20260724.md'
git add -- 'release/production-readiness/gate13br3-rc1-production-incompatibility-supersession-20260724.json'
git add -- 'release/production-readiness/gate13br3-rc1-production-incompatibility-supersession-20260724.md'
git add -- 'release/production-readiness/gate13br3-rc2-authorization-contracts-20260724.json'
git add -- 'release/production-readiness/gate13br3-rc2-authorization-contracts-20260724.md'
git add -- 'release/production-readiness/gate13br3-rc2-candidate-content-manifest-20260724.json'
git add -- 'release/production-readiness/gate13br3-rc2-candidate-content-manifest-20260724.md'
git add -- 'release/production-readiness/gate13br3-rc2-explicit-staging-plan-20260724.md'
git add -- 'release/production-readiness/gate13br3-rc2-explicit-staging-plan-20260724.ps1'
git add -- 'release/production-readiness/gate13br3-rc2-release-file-manifest-20260724.json'
git add -- 'release/production-readiness/gate13br3-rc2-release-file-manifest-20260724.md'
git add -- 'release/production-readiness/gate13br3-three-lineage-contract-20260724.json'
git add -- 'release/production-readiness/gate13br3-three-lineage-contract-20260724.md'
git add -- 'release/production-readiness/gate13br3-transitional-super-admin-contract-20260724.json'
git add -- 'release/production-readiness/gate13br3-transitional-super-admin-contract-20260724.md'
git add -- 'release/production-readiness/gate13br3-validation-results-20260724.json'
git add -- 'release/production-readiness/gate13br3-validation-results-20260724.md'
git add -- 'scripts/build-production-bridge-workdir.mjs'
git add -- 'scripts/build-release-baseline-workdir.mjs'
git add -- 'scripts/gate11-immutable-baseline.mjs'
git add -- 'scripts/generate-gate13b-migration187.mjs'
git add -- 'scripts/generate-gate13br3-evidence.mjs'
git add -- 'scripts/verify-release-migration-lineage-v3.mjs'
git add -- 'supabase/baselines/README.md'
git add -- 'supabase/baselines/grc_platform_baseline_v3_through_187.manifest.json'
git add -- 'supabase/baselines/grc_platform_baseline_v3_through_187.sql'
git add -- 'supabase/migrations/186_legacy_role_scope_reconciliation.sql'
git add -- 'supabase/migrations/187_legacy_runtime_and_post185_reconciliation.sql'
git add -- 'tests/sql/gate13b_dual_lineage_fixture.sql'
git add -- 'tests/sql/gate13b_post187_governance.sql'
git add -- 'tests/sql/gate13br3_forced_rotation_flow.sql'
git add -- 'tests/unit/gate13bLegacyBridgeContract.test.ts'
$expected = @(
  'package-lock.json',
  'release/production-readiness/gate13br3-baseline-v3-validation-20260724.json',
  'release/production-readiness/gate13br3-baseline-v3-validation-20260724.md',
  'release/production-readiness/gate13br3-control-traceability-20260724.json',
  'release/production-readiness/gate13br3-control-traceability-20260724.md',
  'release/production-readiness/gate13br3-decision-20260724.json',
  'release/production-readiness/gate13br3-decision-20260724.md',
  'release/production-readiness/gate13br3-dual-lineage-validation-20260724.json',
  'release/production-readiness/gate13br3-dual-lineage-validation-20260724.md',
  'release/production-readiness/gate13br3-expected-post187-catalog-fingerprint-20260724.json',
  'release/production-readiness/gate13br3-expected-post187-catalog-fingerprint-20260724.sha256',
  'release/production-readiness/gate13br3-final-clone-rehearsal-plan-20260724.json',
  'release/production-readiness/gate13br3-final-clone-rehearsal-plan-20260724.md',
  'release/production-readiness/gate13br3-forced-rotation-validation-20260724.json',
  'release/production-readiness/gate13br3-forced-rotation-validation-20260724.md',
  'release/production-readiness/gate13br3-independent-security-review-20260724.json',
  'release/production-readiness/gate13br3-independent-security-review-20260724.md',
  'release/production-readiness/gate13br3-input-verification-20260724.json',
  'release/production-readiness/gate13br3-input-verification-20260724.md',
  'release/production-readiness/gate13br3-migration-hashes-20260724.json',
  'release/production-readiness/gate13br3-migration-hashes-20260724.md',
  'release/production-readiness/gate13br3-migration187-sequencing-analysis-20260724.json',
  'release/production-readiness/gate13br3-migration187-sequencing-analysis-20260724.md',
  'release/production-readiness/gate13br3-negative-validation-20260724.json',
  'release/production-readiness/gate13br3-negative-validation-20260724.md',
  'release/production-readiness/gate13br3-rc1-production-incompatibility-supersession-20260724.json',
  'release/production-readiness/gate13br3-rc1-production-incompatibility-supersession-20260724.md',
  'release/production-readiness/gate13br3-rc2-authorization-contracts-20260724.json',
  'release/production-readiness/gate13br3-rc2-authorization-contracts-20260724.md',
  'release/production-readiness/gate13br3-rc2-candidate-content-manifest-20260724.json',
  'release/production-readiness/gate13br3-rc2-candidate-content-manifest-20260724.md',
  'release/production-readiness/gate13br3-rc2-explicit-staging-plan-20260724.md',
  'release/production-readiness/gate13br3-rc2-explicit-staging-plan-20260724.ps1',
  'release/production-readiness/gate13br3-rc2-release-file-manifest-20260724.json',
  'release/production-readiness/gate13br3-rc2-release-file-manifest-20260724.md',
  'release/production-readiness/gate13br3-three-lineage-contract-20260724.json',
  'release/production-readiness/gate13br3-three-lineage-contract-20260724.md',
  'release/production-readiness/gate13br3-transitional-super-admin-contract-20260724.json',
  'release/production-readiness/gate13br3-transitional-super-admin-contract-20260724.md',
  'release/production-readiness/gate13br3-validation-results-20260724.json',
  'release/production-readiness/gate13br3-validation-results-20260724.md',
  'scripts/build-production-bridge-workdir.mjs',
  'scripts/build-release-baseline-workdir.mjs',
  'scripts/gate11-immutable-baseline.mjs',
  'scripts/generate-gate13b-migration187.mjs',
  'scripts/generate-gate13br3-evidence.mjs',
  'scripts/verify-release-migration-lineage-v3.mjs',
  'supabase/baselines/README.md',
  'supabase/baselines/grc_platform_baseline_v3_through_187.manifest.json',
  'supabase/baselines/grc_platform_baseline_v3_through_187.sql',
  'supabase/migrations/186_legacy_role_scope_reconciliation.sql',
  'supabase/migrations/187_legacy_runtime_and_post185_reconciliation.sql',
  'tests/sql/gate13b_dual_lineage_fixture.sql',
  'tests/sql/gate13b_post187_governance.sql',
  'tests/sql/gate13br3_forced_rotation_flow.sql',
  'tests/unit/gate13bLegacyBridgeContract.test.ts'
) | Sort-Object
$actual = @(git diff --cached --name-only) | Sort-Object
if (Compare-Object $expected $actual) { throw 'Staged path set differs from approved manifest' }
$payloadOverlays = @(
  'package-lock.json',
  'release/production-readiness/gate13br3-baseline-v3-validation-20260724.json',
  'release/production-readiness/gate13br3-baseline-v3-validation-20260724.md',
  'release/production-readiness/gate13br3-control-traceability-20260724.json',
  'release/production-readiness/gate13br3-control-traceability-20260724.md',
  'release/production-readiness/gate13br3-decision-20260724.json',
  'release/production-readiness/gate13br3-decision-20260724.md',
  'release/production-readiness/gate13br3-dual-lineage-validation-20260724.json',
  'release/production-readiness/gate13br3-dual-lineage-validation-20260724.md',
  'release/production-readiness/gate13br3-expected-post187-catalog-fingerprint-20260724.json',
  'release/production-readiness/gate13br3-expected-post187-catalog-fingerprint-20260724.sha256',
  'release/production-readiness/gate13br3-final-clone-rehearsal-plan-20260724.json',
  'release/production-readiness/gate13br3-final-clone-rehearsal-plan-20260724.md',
  'release/production-readiness/gate13br3-forced-rotation-validation-20260724.json',
  'release/production-readiness/gate13br3-forced-rotation-validation-20260724.md',
  'release/production-readiness/gate13br3-independent-security-review-20260724.json',
  'release/production-readiness/gate13br3-independent-security-review-20260724.md',
  'release/production-readiness/gate13br3-input-verification-20260724.json',
  'release/production-readiness/gate13br3-input-verification-20260724.md',
  'release/production-readiness/gate13br3-migration-hashes-20260724.json',
  'release/production-readiness/gate13br3-migration-hashes-20260724.md',
  'release/production-readiness/gate13br3-migration187-sequencing-analysis-20260724.json',
  'release/production-readiness/gate13br3-migration187-sequencing-analysis-20260724.md',
  'release/production-readiness/gate13br3-negative-validation-20260724.json',
  'release/production-readiness/gate13br3-negative-validation-20260724.md',
  'release/production-readiness/gate13br3-rc1-production-incompatibility-supersession-20260724.json',
  'release/production-readiness/gate13br3-rc1-production-incompatibility-supersession-20260724.md',
  'release/production-readiness/gate13br3-three-lineage-contract-20260724.json',
  'release/production-readiness/gate13br3-three-lineage-contract-20260724.md',
  'release/production-readiness/gate13br3-transitional-super-admin-contract-20260724.json',
  'release/production-readiness/gate13br3-transitional-super-admin-contract-20260724.md',
  'release/production-readiness/gate13br3-validation-results-20260724.json',
  'release/production-readiness/gate13br3-validation-results-20260724.md',
  'scripts/build-production-bridge-workdir.mjs',
  'scripts/build-release-baseline-workdir.mjs',
  'scripts/gate11-immutable-baseline.mjs',
  'scripts/generate-gate13b-migration187.mjs',
  'scripts/generate-gate13br3-evidence.mjs',
  'scripts/verify-release-migration-lineage-v3.mjs',
  'supabase/baselines/grc_platform_baseline_v3_through_187.manifest.json',
  'supabase/baselines/grc_platform_baseline_v3_through_187.sql',
  'supabase/baselines/README.md',
  'supabase/migrations/186_legacy_role_scope_reconciliation.sql',
  'supabase/migrations/187_legacy_runtime_and_post185_reconciliation.sql',
  'tests/sql/gate13b_dual_lineage_fixture.sql',
  'tests/sql/gate13b_post187_governance.sql',
  'tests/sql/gate13br3_forced_rotation_flow.sql',
  'tests/unit/gate13bLegacyBridgeContract.test.ts'
)
foreach ($path in $payloadOverlays) {
  $workingOid = (git hash-object -- $path).Trim()
  $stagedOid = (git rev-parse (':' + $path)).Trim()
  if ($workingOid -ne $stagedOid) { throw "Staged blob differs from approved working payload: $path" }
}
git diff --cached --check
git diff --cached --stat
git diff --cached --name-status
Write-Host 'STOP BEFORE COMMIT — review the complete staged diff.'
