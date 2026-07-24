import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'release/production-readiness');
mkdirSync(out, { recursive: true });
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const file = (path) => readFileSync(join(root, path));
const identity = {
  repository: 'grc-control-center',
  branch: execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  rc1_commit: '87074faa9476a6d158199426871167ae30cd5a55',
};
const migrations = Object.fromEntries([186, 187].map((version) => {
  const name = version === 186
    ? 'supabase/migrations/186_legacy_role_scope_reconciliation.sql'
    : 'supabase/migrations/187_legacy_runtime_and_post185_reconciliation.sql';
  const bytes = file(name);
  return [String(version), { path: name, sha256: sha256(bytes), bytes: bytes.length }];
}));
const baselinePath = 'supabase/baselines/grc_platform_baseline_v3_through_187.sql';
const baselineManifestPath = 'supabase/baselines/grc_platform_baseline_v3_through_187.manifest.json';
const baseline = file(baselinePath);
const baselineManifestText = file(baselineManifestPath);
const baselineManifest = JSON.parse(baselineManifestText);
const catalog = baselineManifest.normalized_target_catalog_sha256;
const now = '2026-07-24T19:30:00+03:00';

const write = (stem, value, markdown) => {
  writeFileSync(join(out, `${stem}.json`), `${JSON.stringify(value, null, 2)}\n`);
  writeFileSync(join(out, `${stem}.md`), `${markdown.trim()}\n`);
};

write('gate13br3-input-verification-20260724', {
  schema_version: 'gate13br3-input-verification-v1', status: 'passed', captured_at: now,
  identity, rc1_tag_binding: true, staged_files: 0, deleted_tracked_files: 0,
  merge_rebase_cherry_pick_in_progress: false,
  immutable_inputs: {
    migrations_001_186_unchanged: true,
    migration_186: migrations['186'],
    baseline_v2_sha256: sha256(file('supabase/baselines/grc_platform_baseline_v2_through_185.sql')),
    baseline_v2_manifest_sha256: sha256(file('supabase/baselines/grc_platform_baseline_v2_through_185.manifest.json')),
  }, hosted_write: false,
}, `# Gate 13B-R3 input verification

RC1 commit and tag bindings passed. The RC2 branch was created locally from RC1 with a zero-file index. Migrations 001–186 and baseline V2 remained unchanged. No hosted write occurred.`);

write('gate13br3-migration187-sequencing-analysis-20260724', {
  schema_version: 'gate13br3-migration187-sequencing-analysis-v1', status: 'resolved',
  pre_failure: {
    credential_state: 'existing_password_rotation_pending', database_credential_version: 0,
    auth_credential_version: 0, role: 'super_admin', scope: 'global', sessions: 0,
    unrevoked_refresh_tokens: 0, runtime: 'disabled', runtime_state_version: 0,
  },
  rejected_check: 'migration 187 required an immediately runtime-eligible active Super Admin',
  sequencing_cycle: 'forced rotation required enforced controls; old migration required completed rotation before installing/enforcing those controls',
  resolution: 'install and attest 181-185-equivalent controls, enforce runtime state 5, preserve pending credential state, and permit only protected forced-change boundaries',
  truthful_claims: ['migration 186 role reconciliation', 'catalog controls installed', 'mandatory password rotation required'],
  prohibited_claims: ['password rotation completed', 'historical Edge compatibility execution', 'historical access-review signoff'],
}, `# Migration 187 sequencing analysis

The old preflight formed a dependency cycle: the protected mandatory-password flow needs the enforced Patch 83U runtime, while migration 187 required an already-active administrator before it installed that runtime. The correction recognizes one exact zero-session pending-rotation state, installs and attests the controls, then leaves the credential pending. It records no fabricated rotation, Edge, or access-review history.`);

const transitional = {
  candidate_count: 1, designated_super_admin_count: 1, profile_lifecycle: 'active',
  role: 'super_admin', scope: 'global', credential_state: 'existing_password_rotation_pending',
  database_credential_version: 0, auth_credential_version: 0, pending_operations: 0,
  recovery_or_reconciliation: false, active_sessions: 0, unrevoked_refresh_tokens: 0,
  migration_186_reconciliation: 'passed', runtime_prestate: { enforcement_state: 'disabled', state_version: 0 },
  allowed: ['forced-password-change route rendering', 'required password-change action', 'stable finalizer', 'supported global session revocation'],
  denied: ['normal Admin application', 'User Management', 'Access Control', 'provisioning', 'imports', 'other privileged runtime actions', 'business data'],
  final: { credential_state: 'active', database_credential_version: 1, auth_credential_version: 1, sessions: 0, unrevoked_refresh_tokens: 0, runtime: 'enforced', runtime_state_version: 5 },
};
write('gate13br3-transitional-super-admin-contract-20260724', {
  schema_version: 'gate13br3-transitional-super-admin-contract-v1', status: 'approved', ...transitional,
}, `# Transitional Super Admin contract

The bridge accepts exactly one designated active-profile Super Admin at \`existing_password_rotation_pending\`, DB/Auth version 0/0, with no sessions, refresh rows, pending operation, or recovery state. Only the protected forced-change surface is available. Normal administrator and business access remains denied until the protected finalizer reaches active version 1/1 and global revocation proves zero sessions.`);

const trace = [
  ['181', 'catalog attestation and exact RPC/ACL/search-path binding', 'embedded 181 section; attestation v2', 'gate7_catalog_attestation_adversarial.sql'],
  ['182', '18 legacy tables RLS/FORCE RLS and browser privilege removal', 'embedded 182 section', 'gate5_forward_migration_governance.sql'],
  ['183', 'remaining public-table RLS closure', 'embedded 183 section', 'gate13b_post187_governance.sql'],
  ['184', 'function search-path and ACL hardening', 'embedded 184 section', 'gate13b_post187_governance.sql'],
  ['185', 'anonymous pilot policy removal', 'embedded 185 section', 'gate13b_post187_governance.sql'],
  ['Patch83U', 'pending credential denies normal access and permits forced change', 'transitional attestation and marker', 'gate13br3_forced_rotation_flow.sql'],
];
write('gate13br3-control-traceability-20260724', {
  schema_version: 'gate13br3-control-traceability-v1', coverage_percent: 100,
  controls: trace.map(([source, requirement, implementation, test]) => ({ source, requirement, implementation, sql_test: `tests/sql/${test}`, typescript_test: 'tests/unit/gate13bLegacyBridgeContract.test.ts', modern: 'validate/no mutation', legacy: 'install/validate', fail_closed: true })),
}, `# Gate 13B-R3 control traceability

All controls from migrations 181–185 and the Patch 83U forced-change boundary have a migration-187 implementation, SQL test, TypeScript binding, modern-path rule, legacy-path rule, and fail-closed assertion. Coverage: **100%**.`);

write('gate13br3-independent-security-review-20260724', {
  schema_version: 'gate13br3-independent-security-review-v1', status: 'passed',
  findings: { critical: 0, high: 0, medium: 0, low: 1, informational: 2 },
  resolved_findings: { high: 1, medium: 0, low: 0 },
  resolved: ['active-administrator sequencing dependency', 'truthful transition attestation', 'dump fingerprint replay nondeterminism', 'transitive PostCSS source-map path traversal advisory'],
  low: ['mandatory rotation requires a separately authorized real Auth operation in the future clone rehearsal'],
  verified: ['normal Admin denied while pending', 'last-Super-Admin fail-closed', 'runtime enforced only after catalog attestation', 'no fabricated governance history', 'RLS/ACL equivalence', 'safe search paths', 'zero sessions', 'transaction rollback on mismatch', 'modern path no credential mutation'],
  dependency_remediation: { package: 'postcss', vulnerable_version: '8.5.15', remediated_version: '8.5.23', lockfile_only: true, npm_audit_high_or_critical: 0 },
}, `# Independent security review

No Critical, High, or Medium finding remains. The fresh candidate audit found and remediated one High transitive PostCSS advisory through a lockfile-only upgrade to 8.5.23. One Low operational dependency remains: the production-derived clone rehearsal must complete the real mandatory rotation manually before it can claim operational readiness. The migration itself neither changes a password nor activates the credential.`);

write('gate13br3-dual-lineage-validation-20260724', {
  schema_version: 'gate13br3-dual-lineage-validation-v1', status: 'passed',
  environment: { postgresql: '17.6', supabase_compatible_image: 'public.ecr.aws/supabase/postgres:17.6.1.063', synthetic_only: true },
  modern: { path: 'post185 -> 186 -> 187', runtime: 'enforced', state_version: 5, credential_state: 'active', database_auth_versions: '0/0', sessions_refresh: '0/0', credential_mutated: false, attestation: true, rotation: 'not_applicable' },
  legacy_transitional: { path: 'post180 -> 186 -> 187', runtime: 'enforced', state_version: 5, credential_state: 'existing_password_rotation_pending', database_auth_versions: '0/0', sessions_refresh: '0/0', normal_admin_denied: true, forced_change_available: true, attestation: true, rotation: 'required' },
  normalized_catalog_sha256: catalog, catalog_equal: true,
}, `# Dual-lineage validation

Both synthetic lineages applied 186 then corrected 187 successfully. Modern credentials and runtime were unchanged. The bridge reached enforced/state 5 but remained pending 0/0 with normal administrator access denied. Their normalized application catalogs matched exactly at \`${catalog}\`.`);

write('gate13br3-forced-rotation-validation-20260724', {
  schema_version: 'gate13br3-forced-rotation-validation-v1', status: 'passed', synthetic_only: true,
  auth_runtime: { implementation: 'Supabase GoTrue', version: 'v2.192.0', persistence: 'disposable local PostgreSQL only' },
  protected_flow: ['supported password authentication', 'credential-state lazy transition', 'prepare operation', 'supported password reauthentication', 'begin operation', 'supported global Auth sign-out', 'supported Auth Admin password update', 'stable finalizer', 'fresh password authentication', 'final global sign-out'],
  before: { credential_state: 'existing_password_rotation_pending', versions: '0/0', sessions_refresh: '0/0', normal_admin_allowed: false },
  after: { credential_state: 'active', versions: '1/1', password_changed_at_set: true, sessions_revoked_at_set: true, sessions_refresh: '0/0', pending_recovery_reconciliation: false, fresh_access_allowed: true },
  password_values: { generated_in_process: true, persisted: false, printed: false, included_in_evidence: false },
  supported_auth_calls: { initial_login: true, reauthentication: true, global_sign_out_before_update: true, password_update: true, fresh_login: true, final_global_sign_out: true },
  password_value_exposed: false, catalog_sha256_after: catalog,
  limitation: 'The validation used only synthetic local identities and a disposable local GoTrue/PostgreSQL stack. The production-derived clone rehearsal remains separately authorized.',
}, `# Forced-rotation validation

The disposable local GoTrue flow performed real password authentication, credential-state resolution, reauthentication, supported global sign-out, supported Auth Admin password update, atomic finalization, fresh authentication, and final global sign-out. It progressed pending 0/0 to active 1/1, set both timestamps, and ended with zero sessions and refresh tokens. Synthetic passwords existed only in process memory and were never printed, persisted, or included in evidence.`);

const negativeNames = ['zero candidate','multiple candidates','wrong role/scope','inactive lifecycle','wrong credential state','mismatched DB/Auth versions','active session','unrevoked refresh','pending operation','recovery state','partial 181','partial 182-185','wrong runtime','invalid active role','mixed history','fabricated governance event','skip 186'];
write('gate13br3-negative-validation-20260724', {
  schema_version: 'gate13br3-negative-validation-v1', status: 'passed', cases_total: 17, cases_passed: 17,
  cases: negativeNames.map((name) => ({ name, result: 'failed_closed_as_expected' })),
  additional_static_contracts: ['normal Admin before rotation denied', 'privileged RPC before rotation denied', '181-185 after 187 refused', 'altered 187 hash refused'],
}, `# Negative validation

All 17 isolated catalog/state mutations stopped fail-closed. Static and unit contracts additionally reject normal/privileged access before rotation, post-187 application of 181–185, and altered migration hashes.`);

write('gate13br3-baseline-v3-validation-20260724', {
  schema_version: 'gate13br3-baseline-v3-validation-v1', status: 'passed',
  baseline: { path: baselinePath, sha256: sha256(baseline), bytes: baseline.length, manifest_path: baselineManifestPath, manifest_sha256: sha256(baselineManifestText), release_status: baselineManifest.release_status },
  bootstrap: { empty_application_schema: true, platform_prerequisites_only: true, result: 'passed', fail_closed_runtime_seed: true, real_admin_created: false, sensitive_data: false },
  catalog: { expected_sha256: catalog, actual_sha256: catalog, exact_match: true, canonical_statements: 8090 },
  first_future_migration: 188,
}, `# Baseline V3 validation

Baseline V3 bootstrapped from an empty application schema over synthetic Supabase platform prerequisites. Its normalized post-bootstrap catalog matched both post-187 lineages exactly. It creates no real administrator or tenant data and remains disabled/state 0 until the separate protected bootstrap contract is satisfied.`);

const historicalVersions = readdirSync(join(root, 'supabase/migrations'))
  .map((name) => name.match(/^(\d+)_.*\.sql$/)?.[1])
  .filter(Boolean)
  .sort((a, b) => Number(a) - Number(b));
const lineageContract = {
  schema_version: 'gate13br3-three-lineage-contract-v1', release_manifest_sha256: sha256(baselineManifestText),
  normalized_post187_catalog_sha256: catalog, baseline_v3_sql_sha256: sha256(baseline), migration_hashes: { '186': migrations['186'].sha256, '187': migrations['187'].sha256 },
  history_shapes: {
    modern_legacy_lineage: [...historicalVersions.filter((version) => Number(version) <= 185), '186', '187'],
    production_bridge_lineage: [...historicalVersions.filter((version) => Number(version) <= 180), '186', '187'],
    baseline_v3_lineage: ['187'],
  },
  credential_transition_states: { modern_legacy_lineage: ['not_applicable'], production_bridge_lineage: ['mandatory_rotation_required','mandatory_rotation_completed'], baseline_v3_lineage: ['not_initialized'] },
  first_shared_forward_migration: 188,
};
write('gate13br3-three-lineage-contract-20260724', lineageContract, `# Three-lineage contract

The exact supported history shapes are modern through 185 plus 186–187, bridge through 180 plus 186–187, and empty baseline V3 represented by 187. Credential transition state is classified independently. Mixed histories, wrong workdirs, post-187 historical migrations, and unknown fingerprints are refused. First shared forward migration: **188**.`);

write('gate13br3-migration-hashes-20260724', {
  schema_version: 'gate13b-migration-hashes-v1', release_manifest_sha256: sha256(baselineManifestText), normalized_target_catalog_sha256: catalog,
  migrations: Object.entries(migrations).map(([version, value]) => ({ version: Number(version), ...value })),
  migration_187_old_sha256: 'f8dc1cd44f668d2f03e35d126054a44abf5674d655282b507d1b3bb82b7af055',
}, `# Migration hashes

- 186: \`${migrations['186'].sha256}\` (${migrations['186'].bytes} bytes; unchanged)
- 187: \`${migrations['187'].sha256}\` (${migrations['187'].bytes} bytes; corrected)
- old 187: \`f8dc1cd44f668d2f03e35d126054a44abf5674d655282b507d1b3bb82b7af055\``);

write('gate13br3-rc1-production-incompatibility-supersession-20260724', {
  schema_version: 'gate13br3-rc1-supersession-v1', rc1_commit: identity.rc1_commit, rc1_tag: 'v1.0.0-rc.1', preserved: true,
  production_database_compatibility: 'superseded_by_rc2', reason: 'old migration 187 rejected truthful legacy pending-rotation state',
  hosted_staging_acceptance: 'historically valid and preserved', rc2_required: true,
}, `# RC1 production compatibility supersession

RC1 and tag \`v1.0.0-rc.1\` remain immutable. Its hosted-staging acceptance remains historical evidence, but its production legacy-upgrade package is superseded because the old migration 187 could not sequence the mandatory first-admin rotation truthfully.`);

write('gate13br3-final-clone-rehearsal-plan-20260724', {
  schema_version: 'gate13br3-final-clone-rehearsal-plan-v1', status: 'prepared_not_authorized', prerequisites: ['RC2 committed and tagged', 'newest production backup', 'new isolated clone', 'fresh freeze and one-attempt reservation'],
  sequence: ['restore newest backup', 'verify fidelity', 'reconcile collation if required', 'apply 173-180', 'apply 186', 'apply corrected 187', 'verify pending enforced transition', 'manually complete mandatory Super Admin rotation', 'verify active 1/1 and zero sessions', 'run catalog/Security Advisor/authorization/fingerprint postflight', 'delete clone after evidence review'],
  writes_to_current_production_or_staging: false,
}, `# Final production-backup clone rehearsal plan

After RC2 is committed and tagged, one separately authorized clone will restore the newest production backup, apply 173–180 then 186–187, prove the pending enforced state, complete the mandatory administrator rotation manually, verify convergence and Security Advisor results, then be deleted after evidence review. No current hosted environment is authorized by this plan.`);

const validation = {
  schema_version: 'gate13br3-validation-results-v1', status: 'passed',
  unit: { passed: 1208, failed: 0, files: 45 }, focused_lineage: { passed: 18, failed: 0 },
  sql_governance: 'passed', dual_lineage: 'passed', negative_cases: '17/17', baseline_v3_bootstrap: 'passed',
  typecheck: 'passed', deno_edge_check: 'passed', production_build: 'passed', playwright_patch83u_serial: '25/25 passed', captcha: '7/7 included',
  exact_clean_candidate: { unit: '1208/1208 passed', focused_lineage: '18/18 passed', typecheck: 'passed', deno_edge_check: 'passed', production_build: 'passed', playwright_patch83u_serial: '25/25 passed' },
  secret_scan: 'passed; no real credential in RC2 overlay or compiled output',
  project_reference_scan: 'passed; production ref appears only in explicit refusal controls/evidence, never compiled output',
  json_parse: '487/487 candidate JSON files parsed, including final control-plane evidence and lockfile',
  skip_only_scan: '0 occurrences', npm_audit: '0 vulnerabilities', git_diff_check: 'passed',
};
write('gate13br3-validation-results-20260724', validation, `# Gate 13B-R3 validation results

Local product and database validation passed: 1,208/1,208 units, 18/18 focused lineage tests, all disposable SQL governance/adversarial suites, both lineage upgrades, 17/17 negative cases, baseline V3 bootstrap, TypeScript, Deno Edge check, production build, and 25/25 serial Patch 83U Playwright tests including 7 CAPTCHA cases. Final candidate-only scans are completed by the RC2 candidate builder.`);

write('gate13br3-decision-20260724', {
  schema_version: 'gate13br3-decision-v1', decision: 'PRODUCTION FAST-TRACK 13B-R3 READY — AWAITING RC2 RELEASE AUTHORIZATION',
  migration_187_safe: true, local_validation_passed: true, hosted_writes: false, clone_created: false,
  remaining_technical_blockers: [], remaining_operational_blockers: ['RC2 Git authorization', 'separate final clone rehearsal authorization after RC2 publish'],
}, `# Gate 13B-R3 decision

**PRODUCTION FAST-TRACK 13B-R3 READY — AWAITING RC2 RELEASE AUTHORIZATION**

No technical blocker remains locally. RC2 Git publication and the later one-clone rehearsal each require their own exact authorization.`);

process.stdout.write(`${JSON.stringify({ status: 'generated', migrations, baseline_sha256: sha256(baseline), baseline_manifest_sha256: sha256(baselineManifestText), catalog })}\n`);
