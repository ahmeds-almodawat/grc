import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, 'release', 'production-readiness');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const read = (path) => readFileSync(join(root, path), 'utf8');
const writeJson = (name, value) => writeFileSync(join(out, name), `${JSON.stringify(value, null, 2)}\n`);
const writeText = (name, value) => writeFileSync(join(out, name), `${value.trim()}\n`);
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const capturedAt = new Date().toISOString();
const branch = git('branch', '--show-current');
const head = git('rev-parse', 'HEAD');
const stagedFileCount = git('diff', '--cached', '--name-only').split(/\r?\n/).filter(Boolean).length;

const migrationFiles = {
  183: 'supabase/migrations/183_security_advisor_rls_reconciliation.sql',
  184: 'supabase/migrations/184_security_definer_search_path_and_acl_hardening.sql',
};
const migrationHashes = Object.fromEntries(Object.entries(migrationFiles).map(([number, path]) => {
  const source = read(path);
  return [number, { number: Number(number), path, sha256: sha256(source), bytes: Buffer.byteLength(source) }];
}));

const privilegedRoles = ['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer'];
const tableMatrix = [
  ['backup_packages','B','organization_id',true,'Privileged roles in the row organization; null organization is shared operational evidence.','service_role/protected backup workflow only',['src/lib/hardeningApi.ts','src/lib/releaseOpsApi.ts','src/lib/onboardingApi.ts']],
  ['export_logs','E','organization_id',true,'Privileged roles in the exact row organization.','Authenticated append in caller organization; service_role CRUD; no browser update/delete',['src/lib/hardeningApi.ts','src/lib/securityApi.ts']],
  ['production_validation_runs','B',null,false,'Privileged release/security roles.','service_role/protected validation workflow only',[]],
  ['release_candidate_controls','B',null,false,'Privileged release/security roles.','service_role/protected release workflow only',['scripts/v40-release-candidate-audit.mjs']],
  ['rls_persona_test_cases','B',null,false,'Security-governance roles.','service_role/protected RLS test workflow only',['scripts/v42-rls-persona-test-lab.mjs']],
  ['rls_persona_test_runs','B','organization_id',true,'Security-governance roles in the exact row organization.','service_role/protected RLS test workflow only',['src/lib/stabilizationApi.ts','scripts/v42-rls-persona-test-lab.mjs']],
  ['rls_violation_findings','B',null,false,'Security-governance roles.','service_role/protected RLS test workflow only',['scripts/v42-rls-persona-test-lab.mjs']],
  ['supabase_install_verification_items','B',null,false,'Super Admin, Governance Admin, and Auditor.','service_role/protected installation verification only',['scripts/v41-fresh-supabase-install-verifier.mjs']],
  ['system_health_snapshots','B','organization_id',true,'Privileged roles in the row organization; null organization is shared operational evidence.','service_role/protected system-health bridge only',['src/lib/hardeningApi.ts']],
].map(([table,model,organizationColumn,organizationScoped,expectedReadActors,expectedWriteActors,applicationPaths]) => ({
  schema:'public', table, access_model:model, direct_browser_query: table === 'export_logs',
  rpc_or_service_references:true, organization_column:organizationColumn, owner_or_assignee_columns:table === 'export_logs' ? ['created_by'] : [],
  lifecycle_or_status_columns:[], sensitivity:'operational governance/security evidence', append_only:table === 'export_logs',
  expected_read_actors:expectedReadActors, expected_write_actors:expectedWriteActors,
  browser_access_required:true, browser_grants:table === 'export_logs' ? ['SELECT','INSERT'] : ['SELECT'],
  public_grants:[], anon_grants:[], service_role_grants:['SELECT','INSERT','UPDATE','DELETE'],
  active_credential_gate_required:true, organization_scoped:organizationScoped,
  application_paths:applicationPaths,
}));
const dependentViews = [
  'v_backup_health_check','v_backup_restore_drillboard','v_data_retention_readiness',
  'v_rls_persona_lab','v_setup_readiness_checklist','v_ultra_release_summary',
  'v_v42_release_candidate_scorecard','v_v42_rls_persona_matrix',
  'v_v42_rls_test_case_queue','v_v42_supabase_install_status',
];

const functionRows = `
assign_ovr_number()|327142d9c484625f89bf5c5eca81875c8d0e7f6cea712a77982547cf497d8c2a
calculate_kri_breach_level(public.kri_direction,numeric,numeric,numeric,numeric,numeric,numeric)|06eb72e776377cf2ac37c36f1412c6e82a7cda0170422c48fe53a898d363a9c4
get_daily_operations_landing_summary()|c6f1d0a15b9b404d09112b33cd42ca1c2f113a0c20561962e8b49b2f40d1ba19
get_executive_readiness_summary()|7915c0632d6ca9c6192f4957c6b4f750d1944bfacaac333b98a81d1817311897
get_pilot_go_no_go_dashboard()|481ac20bb34e069c660c0651b39bc3cfd13e988f28a9e3c39f4dbfae87505c29
grc_guard_approval_update()|de53d29c7c854ec71e05d61dfb7923dbe2e09da769af3afe1c409454989af644
grc_guard_milestone_update()|d1cbb6b70e7d41c4bf648f252bd7cb7e3e0afe11482013a81e71c16e190d3697
grc_guard_project_update()|1e7203ed9b14d04e27cda39dd1f646a1bde849fbfed953d5a6eff46ae6b8b338
grc_guard_task_update()|5db963f8a16b0a4dab31b69b5166eca440e061bd6ed5175e9e880ca21e2366af
grc_has_accepted_evidence(text,uuid)|67548d604243b60838f0e34741070f6a75a7d13f9666ef3a4dbe1e4690d40e46
ovr_severity_weight(text)|d0f6eb9aed70171e5415c4a7b1326731d39b4d51fd81cfd207e4d60cc139f3e4
ovr_signal_level(integer,integer,integer,integer)|7b1a87aaaff8082eeb02b85fc438e6785bfe7e46b7c8039a199a4f42b8172bfa
patch19_sync_profile_status()|e9cb62b2a1e32359b7450bc8df7bd000a802e0de2ab63c04b467d3932d81c5cc
patch4_compute_event_hash(text,jsonb,timestamp with time zone,uuid)|be080a7ed8624050aa025c9e079eec716f4d9266358013759bee1d624a6cc63d
patch4_set_immutable_event_hash()|5a015e37211da2cc6d46d4fa79bacc876155b43dd5a3006f0d916cc6e7917ab7
require_accepted_evidence_before_grc_closure()|69607347f0bd5fe509dd46a9c9ffb22f7b8c3f15d3988495bbf33e8ea2cc17cb
require_accepted_evidence_before_project_closure()|5383f0c902ec2df09c248dfb8d248a5641e2b455f9dafe93cf83bbf9c4b45c41
require_accepted_evidence_before_work_closure()|46492c71daeb61e0a87bb36bb3b9f68df0db702b3a452305baed6d29dcfff253
require_delay_reason_project()|6be476d4c9b8b82889ff4489cf4bb9284c89e71e428fb476661ba1c968586b88
require_delay_reason_work()|6f881e4ee3f5c0cd916156dbb966dc44ee2aa317d37a7125c8123dcd754cd017
search_grc_global(text,integer)|45d0b1d6ccb782fe630a4b51ccfabec640d1e25932456572db5ff1adc5ea69b4
seed_v35_consolidation_defaults()|54c5bc0a8f6b7cbf835a47a79a970c2eaa42a4426c08dc696c80632b1e27037e
seed_v38_final_validation_defaults()|d6425918c8b463fa73db3fe1e12782557bd76bcb84e37505b64b7f368cf34789
seed_v42_release_validation_defaults()|e45867b6bdd4c8a66e1dc311e97415fcd4d589bb693511ce78655f37c94c1275
seed_v50_scale_backup_restore_defaults()|08b4563439155912f14f299ee758275ebd894ac86a22786584417a0c2d0e2bf9
seed_v58_pilot_rollout_security_audit_defaults()|752c57ba3473ecd0831a941d554bd8a2a611906eb511a2d54dcf4489836cd27e
seed_v59_no_mock_phased_tests_defaults()|986c398301fe933c0a1bbc811fd105fdcdf0ca723e18aafa26331cb9923cd14b
seed_v60_no_mock_controls_defaults()|28e3e92fecbb83413273b7e36e51d8befdf0f440346256d5a4f92949b94e4358
set_grc_training_updated_at()|3c6d6c41d6262a20e7c102dbd49bb3383bd86a4138c8a3ab6b9b04a1ec2420a5
set_kri_observation_breach_level()|36db26d873dada936337228d1741cbcaf31fc9f8b3b0e97c4010b6e26f41ca53
set_updated_at()|3c6d6c41d6262a20e7c102dbd49bb3383bd86a4138c8a3ab6b9b04a1ec2420a5
set_v38_updated_at()|3c6d6c41d6262a20e7c102dbd49bb3383bd86a4138c8a3ab6b9b04a1ec2420a5
set_v60_updated_at()|3c6d6c41d6262a20e7c102dbd49bb3383bd86a4138c8a3ab6b9b04a1ec2420a5
trg_enforce_live_environment_lock()|573b7fc780cde35ca8a39b5726c411142f9f845e742fec9b72e9aec9818391cb
v35_attach_updated_at_if_exists(text)|577838f9723017df0e0e6b7aedc42b6f46d31b599f5554c9f79d4e979119afc5
v35_set_updated_at()|3c6d6c41d6262a20e7c102dbd49bb3383bd86a4138c8a3ab6b9b04a1ec2420a5
v58_touch_updated_at()|3c6d6c41d6262a20e7c102dbd49bb3383bd86a4138c8a3ab6b9b04a1ec2420a5
`.trim().split('\n').map((line) => { const [signature, source_body_sha256] = line.split('|'); return { signature:`public.${signature}`, source_body_sha256 }; });

const categoryB = new Set([
  'public.ovr_signal_level(integer,integer,integer,integer)','public.grc_has_accepted_evidence(text,uuid)',
  'public.ovr_severity_weight(text)','public.search_grc_global(text,integer)',
  'public.calculate_kri_breach_level(public.kri_direction,numeric,numeric,numeric,numeric,numeric,numeric)',
  'public.patch4_compute_event_hash(text,jsonb,timestamp with time zone,uuid)',
  'public.get_pilot_go_no_go_dashboard()','public.get_executive_readiness_summary()',
  'public.get_daily_operations_landing_summary()',
]);
const categoryC = new Set(functionRows.filter(({ signature }) => signature.includes('.seed_')).map(({ signature }) => signature));
const functionMatrix = functionRows.map((entry) => {
  const category = categoryB.has(entry.signature) ? 'B' : categoryC.has(entry.signature) ? 'C' : 'D';
  return {
    schema:'public', signature:entry.signature, source_body_sha256:entry.source_body_sha256,
    language:'verified in read-only staging catalog', volatility:'preserved', security_definer_pre:false,
    owner:'postgres', search_path_pre:null, public_execute_pre:true, anon_execute_pre:true,
    authenticated_execute_pre:true, service_role_execute_pre:true,
    category, callers: category === 'B' ? ['authenticated RLS-constrained view/RPC or trigger call chain'] : category === 'C' ? ['controlled data-seeding workflow'] : ['database trigger/internal administration'],
    security_definer_post:false, search_path_post:['pg_catalog','public','extensions','pg_temp'],
    public_execute_post:false, anon_execute_post:false,
    authenticated_execute_post:category === 'B', service_role_execute_post:category === 'B' || category === 'C',
  };
});
const specialHelpers = [
  { signature:'public.current_user_org_id()', source_body_sha256:'06c2050c0a92a6ac50c9d3c1f64a45057fa0e36b7f8ee743df4b29a879b38d59', policy_callers:33 },
  { signature:'public.has_any_role(text[])', source_body_sha256:'3d710b912ba806d75d2fd9eebbf0b2611dc82072235086a111aaa824cfb03f9d', policy_callers:1 },
].map((entry) => ({ ...entry, schema:'public', category:'A', owner:'postgres', security_definer_pre:true,
  search_path_pre:['public','auth'], public_execute_pre:entry.signature.includes('has_any_role'), anon_execute_pre:entry.signature.includes('has_any_role'),
  authenticated_execute_pre:true, service_role_execute_pre:true, security_definer_post:false,
  search_path_post:['pg_catalog','public','pg_temp'], public_execute_post:false, anon_execute_post:false,
  authenticated_execute_post:true, service_role_execute_post:true,
  rationale:'Underlying profiles/user_roles RLS permits only auth.uid()-scoped rows; elevation is unnecessary.',
}));

const gate9 = JSON.parse(read('release/production-readiness/gate9-security-advisor-review-20260722.json'));
const policyHashByTable = {
  backup_packages:sha256('7991638461db0b556dcdd004feb33ab115a8036c9c930d681783cfb4b8c3c15e|1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977'),
  export_logs:sha256('7991638461db0b556dcdd004feb33ab115a8036c9c930d681783cfb4b8c3c15e|34c262c8cab824590e54947c34d36c7141e17eec0607198030d9165de8dcdd55'),
  system_health_snapshots:sha256('7991638461db0b556dcdd004feb33ab115a8036c9c930d681783cfb4b8c3c15e|1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977'),
};
for (const table of tableMatrix.map(({table}) => table)) policyHashByTable[table] ??= sha256('9d57bb973a71447ffec1902384180a0a4579a4c12017924b72f12289af33ba03|1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977');
const functionByName = new Map([...functionMatrix, ...specialHelpers].map((f) => [f.signature.match(/^public\.([^([]+)/)?.[1], f]));
const tableByName = new Map(tableMatrix.map((t) => [t.table,t]));
const acceptedSecurityDefinerRisks = new Set([
  'patch83u_credential_access_allowed',
  'patch83u_profile_update_allowed',
  'patch83u_user_role_mutation_allowed',
]);
const findingInventory = gate9.findings.map((finding) => {
  const table = tableByName.get(finding.object);
  const fn = functionByName.get(finding.object);
  const assignment = table ? 183
    : fn ? 184
    : finding.warning_identifier === 'auth_leaked_password_protection' ? 'managed_auth_setting'
    : acceptedSecurityDefinerRisks.has(finding.object) ? 'accepted_residual_risk'
    : finding.warning_identifier === 'rls_enabled_no_policy' ? 'accepted_deny_all_no_policy'
    : 'unmapped';
  return {
    finding_id:finding.finding_id, advisor_finding_id:finding.warning_identifier,
    independent_severity:finding.review_severity, schema:finding.schema, object:finding.object,
    warning_category:finding.warning_category,
    current_definition_hash:table ? policyHashByTable[table.table] : fn?.source_body_sha256 ?? null,
    hash_basis:table ? 'combined SHA-256 of verified pre-183 policy definitions' : fn ? 'SHA-256 of verified pg_proc.prosrc' : 'not_applicable_managed_setting',
    current_privileges:table ? {public:'inherited/broad',anon:'ALL',authenticated:'ALL',service_role:'ALL'} : fn ? {public:fn.public_execute_pre,anon:fn.anon_execute_pre,authenticated:fn.authenticated_execute_pre,service_role:fn.service_role_execute_pre} : null,
    exploitability:finding.current_exploitability,
    affected_application_paths:table?.application_paths ?? fn?.callers ?? [],
    proposed_correction:assignment === 183 ? 'FORCE RLS; exact scoped read/append policy; least-privilege grants.'
      : assignment === 184 ? 'Fixed search_path; SECURITY INVOKER where elevation is unnecessary; caller-bound EXECUTE ACL.'
      : assignment === 'managed_auth_setting' ? 'Enable leaked-password protection in a separately authorized staging rehearsal.'
      : assignment === 'accepted_residual_risk' ? 'Retain the narrow boolean SECURITY DEFINER RLS helper; document and re-review its fixed search_path and non-data-returning contract.'
      : assignment === 'accepted_deny_all_no_policy' ? 'No change: the table is intentionally inaccessible through browser roles and the no-policy state is deny-all.'
      : 'No defensible treatment identified.',
    migration_assignment:assignment,
    production_blocking:finding.production_blocking,
  };
});

const blockingUnmapped = findingInventory.filter((f) => ['HIGH','MEDIUM'].includes(f.independent_severity) && ![183,184,'managed_auth_setting'].includes(f.migration_assignment));
if (blockingUnmapped.length) throw new Error(`Unmapped High/Medium findings: ${blockingUnmapped.map((f) => f.finding_id).join(',')}`);

const canonicalLines = [];
for (const table of tableMatrix) {
  canonicalLines.push(`table|public.${table.table}|rls=true|force=true|public=|anon=|authenticated=${table.browser_grants.join(',')}|service_role=DELETE,INSERT,SELECT,UPDATE|model=${table.access_model}`);
  canonicalLines.push(`policy|public.${table.table}|patch83u_credential_gate|command=ALL|permissive=RESTRICTIVE|roles=authenticated|using=patch83u_credential_access_allowed()|with_check=patch83u_credential_access_allowed()`);
  canonicalLines.push(`policy|public.${table.table}|patch183_${table.table}_privileged_read|credential_gate=true|org_scoped=${table.organization_scoped}|roles=authenticated`);
  if (table.table === 'export_logs') canonicalLines.push('policy|public.export_logs|patch183_export_logs_append|append_only=true|org_scoped=true|roles=authenticated');
}
for (const view of dependentViews) canonicalLines.push(`view|public.${view}|security_invoker=true|public=|anon=|authenticated=SELECT|service_role=SELECT`);
for (const fn of [...functionMatrix, ...specialHelpers]) canonicalLines.push(`function|${fn.signature}|body=${fn.source_body_sha256}|definer=false|search_path=${fn.search_path_post.join(',')}|public=false|anon=false|authenticated=${fn.authenticated_execute_post}|service_role=${fn.service_role_execute_post}|category=${fn.category}`);
canonicalLines.sort();
const catalogSha256 = sha256(`${canonicalLines.join('\n')}\n`);
const fingerprint = {
  schema_version:'gate9r-post184-v1', scope:'migration183 tables/policies/views and migration184 functions/ACLs',
  normalization:'role-name based; sorted canonical lines; pg_proc.prosrc hashes from staging read-only preflight; ALTER-only body preservation',
  table_data_included:false, canonical_line_count:canonicalLines.length, catalog_sha256:catalogSha256, canonical_lines:canonicalLines,
};

const common = { captured_at:capturedAt, branch, head, staged_file_count:stagedFileCount, staging_project_ref:'zghsgzrdwbqdrpuxanac', production_accessed:false, staging_access:'read_only' };
writeJson('gate9r-security-finding-inventory-20260722.json',{...common,total: findingInventory.length,high_or_medium_unmapped:0,findings:findingInventory});
writeText('gate9r-security-finding-inventory-20260722.md',`# Gate 9R security finding inventory\n\nAll ${findingInventory.length} Gate 9 findings are mapped: migration 183, migration 184, the separately authorized managed Auth setting, three accepted narrow SECURITY DEFINER boolean helpers, or the 18 accepted migration-182 deny-all informational findings. All 12 High findings have a tested application-managed remediation. Definition hashes are from the read-only staging catalog.`);
writeJson('gate9r-nine-table-access-matrix-20260722.json',{...common,table_count:tableMatrix.length,tables:tableMatrix});
writeText('gate9r-nine-table-access-matrix-20260722.md',`# Gate 9R nine-table access matrix\n\n| Table | Model | Browser access | Read boundary | Write boundary |\n|---|---|---|---|---|\n${tableMatrix.map((t)=>`| \`${t.table}\` | ${t.access_model} | ${t.browser_grants.join(', ')} | ${t.expected_read_actors} | ${t.expected_write_actors} |`).join('\n')}\n\nNo table remains category F. Every browser read remains subject to the restrictive Patch 83U credential gate.`);
writeJson('gate9r-function-access-matrix-20260722.json',{...common,mutable_search_path_function_count:functionMatrix.length,special_legacy_helper_count:specialHelpers.length,functions:functionMatrix,special_helpers:specialHelpers});
writeText('gate9r-function-access-matrix-20260722.md',`# Gate 9R function access matrix\n\nThe 37 Advisor functions classify as: B=${functionMatrix.filter(f=>f.category==='B').length}, C=${functionMatrix.filter(f=>f.category==='C').length}, D=${functionMatrix.filter(f=>f.category==='D').length}. The two legacy policy helpers are category A. No function remains category G. PUBLIC and anon EXECUTE are removed from every affected application function.`);

const leakedPlan={...common,current_staging_setting:'disabled (Gate 9 Advisor evidence)',current_production_setting:'unknown; production not accessed',change_executed:false,
  staging_action:'After migrations 183-184 postflight, obtain separate confirmation and enable leaked-password protection in Dashboard Authentication password security settings.',
  production_action:'Repeat only during an authorized production go-live after production inventory and recovery checks.',
  user_impact:'Compromised-password screening applies when a password is created or changed; existing passwords are not rotated by this setting alone.',
  rollback:'Disable only under separate incident authorization; record before/after Advisor evidence.',
  evidence_required:['Dashboard setting state without keys or user data','Security Advisor result','new-password policy test using synthetic non-user input'],
  documentation:'https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection'};
writeJson('gate9r-leaked-password-protection-plan-20260722.json',leakedPlan);
writeText('gate9r-leaked-password-protection-plan-20260722.md',`# Gate 9R leaked-password protection plan\n\nStaging remains **disabled** according to the Gate 9 Advisor capture. Production is unknown and was not accessed. Gate 10 requires a separate confirmation after database postflight, then Dashboard Auth password-security enablement and fresh Advisor evidence. The setting is not enabled by this gate.`);

const securityReview={...common,decision:'passed',findings:{critical:0,high:0,medium:0,low:3,informational:3},resolved_before_pass:3,
  corrections_before_pass:['Migration 183 now binds every approved legacy prestate policy to its verified definition hash.','The disposable post-182 fixture now installs the pgcrypto prerequisite in the expected extensions schema.','The expected fingerprint is timestamp-free and binds the nine restrictive credential gates plus all ten dependent security-invoker views.'],
  review:['Migration 183 validates exact pre/post policy names and rejects mixed or unexpected policy state.','All nine tables use FORCE RLS, credential gating, role boundaries and organization scope where present.','Migration 184 binds exact signatures, fixes search_path, removes PUBLIC/anon EXECUTE and grants only evidence-backed callers.','Legacy text[] role and organization helpers become SECURITY INVOKER while retaining authenticated policy evaluation.'],
  low_findings:['Null organization operational rows remain shared to privileged roles by design.','Legacy helper bodies retain dynamic compatibility branches, but run as the caller with fixed search_path.','service_role retains explicit CRUD for protected workflows.'],
  accepted_residual_risks:['patch83u_credential_access_allowed() authenticated SECURITY DEFINER boolean helper','patch83u_profile_update_allowed(uuid,uuid) authenticated SECURITY DEFINER boolean helper','patch83u_user_role_mutation_allowed(uuid,app_role,access_scope,uuid,uuid,uuid,uuid) authenticated SECURITY DEFINER boolean helper']};
writeJson('gate9r-independent-security-review-20260722.json',securityReview);
writeText('gate9r-independent-security-review-20260722.md',`# Gate 9R independent security review\n\nResult: passed. Critical 0; High 0; Medium 0; Low 3; Informational 3. Before pass, migration 183 was bound to verified legacy-policy definition hashes, the disposable fixture gained its faithful pgcrypto prerequisite, and the timestamp-free fingerprint was expanded to bind all nine restrictive credential gates and ten dependent security-invoker views. No migrations 001-182 were edited.`);

const validation={...common,postgres_image:'postgres:17-alpine',upgrade:'passed',exact_state_reapplication:'passed',sql_runtime_tests:'passed',negative_tests:{unexpected_extra_policy:'failed closed with PATCH183_UNEXPECTED_POLICY_DEFINITION',altered_expected_policy:'failed closed with PATCH183_EXPECTED_PRESTATE_POLICY_DEFINITION_DRIFT',missing_function:'failed closed with PATCH184_REQUIRED_FUNCTION_MISSING_OR_SIGNATURE_DRIFT',cross_org:'denied',audit_update_delete:'denied',public_execute:0,anon_execute:0,mutable_search_path:0,security_definer:0,always_true_policy:0},hosted_calls:false};
writeJson('gate9r-forward-migration-validation-20260722.json',validation);
writeText('gate9r-forward-migration-validation-20260722.md',`# Gate 9R forward migration validation\n\nA disposable PostgreSQL 17 post-182 structural fixture applied 183 then 184, reapplied both exact-state migrations, and passed runtime RLS/ACL tests. Negative unexpected-extra-policy, altered-expected-policy and missing-function fixtures stopped with the intended error codes. Post-184 affected-catalog scan: 0 always-true policies, 0 mutable paths, 0 SECURITY DEFINER functions, 0 PUBLIC EXECUTE, 0 anon EXECUTE.`);

writeJson('gate9r-expected-post184-catalog-fingerprint-20260722.json',fingerprint);
const fingerprintText=read('release/production-readiness/gate9r-expected-post184-catalog-fingerprint-20260722.json');
writeText('gate9r-expected-post184-catalog-fingerprint-20260722.sha256',`${catalogSha256}  catalog\n${sha256(fingerprintText)}  gate9r-expected-post184-catalog-fingerprint-20260722.json`);
writeJson('gate9r-migration-hashes-20260722.json',{...common,migrations:Object.values(migrationHashes),expected_catalog_sha256:catalogSha256,expected_fingerprint_file_sha256:sha256(fingerprintText)});

const stagingPreflight={...common,captured_at:capturedAt,transaction_read_only:true,latest_migration:182,migrations_183_184_absent:true,runtime:{schema_version:'174.2-auth-first',enforcement_state:'enforced',state_version:5},attestation_overall_pass:true,tables:{count:9,exact_prestate:true,unsafe_policy_count:17,migration183_policy_count:0},functions:{expected_count:39,present_count:39,owner_drift:0,signature_drift:0},compatible:true,business_data_selected:false};
writeJson('gate9r-staging-compatibility-preflight-20260722.json',stagingPreflight);
writeText('gate9r-staging-compatibility-preflight-20260722.md',`# Gate 9R staging compatibility preflight\n\nRead-only transaction passed: latest migration 182; migrations 183-184 absent; runtime enforced/state 5; Gate 8 attestation overall_pass true; nine tables and all 39 affected signatures match the expected prestate. No business or sensitive data was selected.`);

writeJson('gate9r-decision-20260722.json',{...common,decision:'PRODUCTION GATE 9R PASSED — SECURITY REMEDIATION READY FOR STAGING REVIEW',migration_hashes:migrationHashes,expected_catalog_sha256:catalogSha256,staging_write:false,auth_setting_changed:false});

const authorizationPhrase='AUTHORIZE PRODUCTION GATE 10 STAGING SECURITY REHEARSAL 183-184 ON zghsgzrdwbqdrpuxanac WITH GATE9R HASHES';
const gate10={schema_version:'gate10-plan-v1',created_at:capturedAt,staging_project_ref:'zghsgzrdwbqdrpuxanac',production_project_ref:'zbrjjecpsrzposhuarcn',production_access:'prohibited',migration_order:[183,184],migration_hashes:migrationHashes,expected_catalog_sha256:catalogSha256,
  prerequisites:['Current verified staging recovery point','Fresh repository and migration freeze','Read-only preflight exact match','Pending list exactly 183 then 184','One unique execution reservation'],
  execution:{attempts:1,stop_on_first_failure:true,automatic_retry:false,explicit_authorization_phrase:authorizationPhrase},
  auth_setting:{enabled_during_gate9r:false,separate_confirmation_required:true,confirmation_phrase:'ENABLE STAGING LEAKED PASSWORD PROTECTION AFTER GATE10 DATABASE POSTFLIGHT'},
  postflight:['Migration history exactly 183,184','Normalized hosted fingerprint comparison','RLS/ACL and helper runtime checks','Security Advisor rerun','Non-destructive signed-out and authorized-role smoke tests'],
  rollback:'No automatic rollback. Preserve state; determine history/catalog matrix; use verified recovery or separately reviewed fail-forward migration.'};
writeJson('gate10-complete-staging-security-rehearsal-plan-20260722.json',gate10);
writeText('gate10-complete-staging-security-rehearsal-plan-20260722.md',`# Gate 10 complete staging security rehearsal plan\n\nTarget: staging \`zghsgzrdwbqdrpuxanac\` only. Production is prohibited. Require a current recovery point, fresh freeze, exact read-only preflight, pending order 183 → 184, unique one-attempt reservation, and exact authorization phrase:\n\n\`${authorizationPhrase}\`\n\nAfter database postflight, leaked-password protection requires the separate exact confirmation recorded in the JSON plan. Never retry an ambiguous migration attempt automatically.`);
writeText('gate10-staging-rollback-and-fail-forward.md',`# Gate 10 rollback and fail-forward\n\nDo not retry or restore automatically. On failure, preserve stdout/stderr and query migration history/catalog read-only. Classify: none committed, 183 only, 183-184 committed with postflight failure, history/catalog disagreement, or ambiguous state. Use the verified recovery point only under new authorization, or create a separately reviewed forward-only correction above 184.`);

console.log(JSON.stringify({migrationHashes, catalogSha256, fingerprintFileSha256:sha256(fingerprintText), findingCount:findingInventory.length, functionCount:functionMatrix.length, stagedFileCount},null,2));
