import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const migration = read('supabase/migrations/171_patch83r_department_lifecycle.sql');
const migration170 = read('supabase/migrations/170_patch83q_security_definer_grant_closure.sql');
const edge = read('supabase/functions/privileged-action/index.ts');
const api = read('src/lib/grcApi.ts');
const departmentsPage = read('src/pages/Departments.tsx');
const departmentImport = read('src/utils/departmentImportValidation.ts');
const userImport = read('src/lib/userManagementApi.ts');
const databaseTests = read('supabase/tests/patch83r_department_lifecycle_tests.sql');
const flags = read('src/config/featureFlags.ts');
const evidenceDir = path.join(root, 'release', 'patch83r');
const checks = [];
const check = (name, passed) => checks.push({ name, passed: Boolean(passed) });

function block(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  return startIndex >= 0 && endIndex > startIndex ? source.slice(startIndex, endIndex) : '';
}

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [fs.readFileSync(full, 'utf8')] : [];
  });
}

const actions = [
  'department_lifecycle_preview',
  'department_lifecycle_rename',
  'department_lifecycle_archive',
  'department_lifecycle_restore',
];
const setMatch = edge.match(/const patch83rDepartmentLifecycleActions = new Set\(\[([\s\S]*?)\]\);/);
const setActions = [...(setMatch?.[1] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1]);
check('exactly four lifecycle actions are registered',
  setActions.length === actions.length && actions.every((action) => setActions.includes(action)));
check('fixed lifecycle action set is included in the allowlist', edge.includes('...patch83rDepartmentLifecycleActions'));

const handler = block(edge, 'if (patch83rDepartmentLifecycleActions.has(action))', 'if (patch83q1ProductionReadinessActions.has(action))');
check('validated JWT precedes lifecycle dispatch', edge.indexOf('auth.getUser(token)') < edge.indexOf('if (patch83rDepartmentLifecycleActions.has(action))'));
check('server derives actor identity for every lifecycle RPC',
  (handler.match(/p_actor_id:\s*userData\.user\.id/g) ?? []).length === 4 && !handler.includes('payload.actor_id'));
check('organization-scoped active administrator role is required',
  edge.includes('authorizePatch83rActor') && edge.includes("['super_admin', 'governance_admin']")
  && edge.includes("assignment.scope === 'global'") && edge.includes('assignment.organization_id === actorProfile.organization_id'));
check('arbitrary RPC dispatch is impossible',
  !/\.rpc\s*\(\s*(?:payload|requestBody)\./.test(edge)
  && !/(?:rpc_name|rpcName)\s*[:=]\s*(?:payload|requestBody)/.test(edge));
check('lifecycle database errors are not leaked raw',
  handler.includes('No raw database detail is exposed') && !handler.includes('errorResponse(error.message'));

for (const action of actions) {
  check(`service-role-only RPC exists: ${action}`,
    migration.includes(`function public.${action}(`)
    && new RegExp(`revoke all on function public\\.${action}\\([^;]+from public, anon, authenticated`, 'i').test(migration)
    && new RegExp(`grant execute on function public\\.${action}\\([^;]+to service_role`, 'i').test(migration));
  check(`browser uses Edge bridge only: ${action}`,
    !new RegExp(`\\.rpc\\s*\\(\\s*['\"]${action}['\"]`).test(sourceFiles(path.join(root, 'src')).join('\n')));
}

check('no hard delete action or department deletion exists',
  !setActions.some((action) => /delete|remove|drop/.test(action))
  && !/delete\s+from\s+public\.departments/i.test(migration)
  && !/drop\s+table\s+(?:if\s+exists\s+)?public\.departments/i.test(migration)
  && !departmentsPage.includes('Delete department'));
check('department code is immutable',
  migration.includes('PATCH83R_DEPARTMENT_CODE_IMMUTABLE')
  && migration.includes('new.code is distinct from old.code')
  && departmentsPage.includes('is immutable'));
check('rename is organization-scoped and blocks archived departments',
  migration.includes('d.id = p_department_id and d.organization_id = v_actor_org')
  && migration.includes('PATCH83R_ARCHIVED_DEPARTMENT_RENAME_DENIED'));
check('normalized active duplicate names are denied',
  migration.includes('PATCH83R_ACTIVE_DEPARTMENT_NAME_CONFLICT')
  && migration.includes("regexp_replace(pg_catalog.btrim(d.name_en), '\\s+', ' ', 'g')"));
check('archive reason is mandatory',
  migration.includes('PATCH83R_ARCHIVE_REASON_REQUIRED') && handler.includes('DEPARTMENT_ARCHIVE_REASON_INVALID'));
check('active users require a valid non-self active successor',
  migration.includes('PATCH83R_ACTIVE_USERS_REQUIRE_SUCCESSOR')
  && migration.includes('PATCH83R_SUCCESSOR_SELF_DENIED')
  && migration.includes('PATCH83R_ACTIVE_SUCCESSOR_REQUIRED'));
check('active-user reassignment is transactional and verified',
  migration.includes('update public.profiles')
  && migration.includes('get diagnostics v_reassigned = row_count')
  && migration.includes('PATCH83R_USER_REASSIGNMENT_INCOMPLETE'));
check('historical department references are preserved',
  !/update\s+public\.(projects|policies|controlled_documents|training_programs|evidence_bridge_links|risks|audit_findings)/i.test(migration)
  && migration.includes("'impact', v_impact"));
check('restore checks active conflicts and preserves identity',
  migration.includes('function public.department_lifecycle_restore')
  && migration.includes('PATCH83R_ACTIVE_DEPARTMENT_NAME_CONFLICT')
  && !/update public\.departments set[^;]*code\s*=/is.test(block(migration, 'function public.department_lifecycle_restore', 'revoke all on function')));
check('archived departments are hidden by default and visibly labeled',
  departmentsPage.includes('if (!showArchived && !row.is_active) return false')
  && departmentsPage.includes('Show archived') && departmentsPage.includes('Archived'));
check('active assignment dropdowns exclude archived departments',
  api.includes(".eq('is_active', true)") && userImport.includes(".eq('is_active', true)"));
check('database guards reject new archived department assignments',
  migration.includes('PATCH83R_ARCHIVED_DEPARTMENT_ASSIGNMENT_DENIED')
  && migration.includes('trg_patch83r_profile_department_assignment')
  && migration.includes('trg_patch83r_role_department_assignment'));
check('Department Import blocks archived code and normalized-name recreation',
  departmentImport.includes('archived_department_match')
  && edge.includes("'archived_department_match'")
  && migration.includes('PATCH83R_ARCHIVED_DEPARTMENT_MATCH'));
check('User Import clearly rejects archived departments',
  userImport.includes('Archived department cannot be assigned')
  && userImport.includes("status: 'archived' as const"));
check('lifecycle audit captures actor, old/new values, reason, successor, reassignment and request id',
  ['DEPARTMENT_RENAMED', 'DEPARTMENT_ARCHIVED', 'DEPARTMENT_RESTORED', 'old_data', 'new_data',
    'archive_reason', 'successor_department_id', 'reassigned_user_count', 'request_id']
    .every((value) => migration.includes(value)));
check('existing department RLS is not weakened',
  !/disable row level security/i.test(migration) && !/drop policy/i.test(migration));
check('focused database lifecycle tests cover authorization, conflicts, successor rules, reassignment, and restore',
  ['TEST_FAILED_UNAUTHORIZED_RENAME_ALLOWED', 'TEST_FAILED_CROSS_ORG_RENAME_ALLOWED',
    'TEST_FAILED_DUPLICATE_NAME_ALLOWED', 'TEST_FAILED_EMPTY_REASON_ALLOWED',
    'TEST_FAILED_MISSING_SUCCESSOR_ALLOWED', 'TEST_FAILED_SELF_SUCCESSOR_ALLOWED',
    'TEST_FAILED_ARCHIVED_SUCCESSOR_ALLOWED', 'TEST_FAILED_USER_NOT_REASSIGNED',
    'TEST_FAILED_ARCHIVED_HISTORY_VIEW_MISSING', 'TEST_FAILED_RESTORE_CONFLICT_ALLOWED',
    'TEST_FAILED_RESTORE_IDENTITY'].every((value) => databaseTests.includes(value)));

const committedMigration170 = execFileSync('git', ['show', 'main:supabase/migrations/170_patch83q_security_definer_grant_closure.sql'], { cwd: root, encoding: 'utf8' });
check('migration 170 is unchanged', migration170.replace(/\r\n/g, '\n') === committedMigration170.replace(/\r\n/g, '\n'));
check('Department Import remains disabled by default', /return value === ['"]true['"]/.test(flags));
const changedFiles = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
check('Vercel files and environment configuration are untouched',
  !changedFiles.some((file) => /(^|\/)(vercel\.json|\.vercel\/|\.env(?:\.|$))/i.test(file)));

for (const file of [
  'patch83r-root-cause.md',
  'patch83r-schema-review.md',
  'patch83r-security-design.md',
  'patch83r-lifecycle-behavior.md',
  'patch83r-import-compatibility.md',
  'patch83r-validation-results.md',
  'patch83r-deployment-decision.md',
]) check(`evidence exists: ${file}`, fs.existsSync(path.join(evidenceDir, file)));

const evidenceText = fs.existsSync(evidenceDir)
  ? fs.readdirSync(evidenceDir).filter((file) => file.endsWith('.md')).map((file) => read(`release/patch83r/${file}`)).join('\n')
  : '';
check('evidence makes no unrestricted production-readiness claim',
  !/unrestricted production ready|fully production ready|approved for unrestricted production/i.test(evidenceText));

const failed = checks.filter((item) => !item.passed);
const result = {
  patch: '83R',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  check_count: checks.length,
  failed_count: failed.length,
  failed: failed.map((item) => item.name),
  checks,
};
fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'patch83r-proof.json'), `${JSON.stringify(result, null, 2)}\n`);
for (const item of checks) console.log(`${item.passed ? 'PASS' : 'FAIL'}: ${item.name}`);
if (failed.length) process.exit(1);
console.log('\nPatch 83R proof passed.');
