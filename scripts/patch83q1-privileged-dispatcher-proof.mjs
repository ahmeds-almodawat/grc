import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const edge = read('supabase/functions/privileged-action/index.ts');
const registry = read('src/lib/runtimeActionRegistry.ts');
const frontendApi = read('src/lib/productionReadinessApi.ts');
const migration170 = read('supabase/migrations/170_patch83q_security_definer_grant_closure.sql');
const evidenceDir = path.join(root, 'release', 'patch83q1');
const proofPath = path.join(evidenceDir, 'patch83q1-proof.json');
const checks = [];
const check = (name, passed) => checks.push({ name, passed: Boolean(passed) });

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [fs.readFileSync(full, 'utf8')] : [];
  });
}

function block(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  return startIndex >= 0 && endIndex > startIndex ? source.slice(startIndex, endIndex) : '';
}

const targetActions = [
  'create_pilot_go_no_go_review',
  'update_pilot_go_no_go_review_status',
  'record_pilot_go_no_go_event',
  'record_executive_production_signoff',
];
const setMatch = edge.match(/const patch83q1ProductionReadinessActions = new Set\(\[([\s\S]*?)\]\);/);
const setActions = [...(setMatch?.[1] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1]);
check('all four and only four Patch 83Q.1 action mappings exist',
  setActions.length === targetActions.length
  && targetActions.every((action) => setActions.includes(action)));
check('Patch 83Q.1 action set is included in the fixed server allowlist',
  edge.includes('...patch83q1ProductionReadinessActions'));

const handler = block(
  edge,
  'if (patch83q1ProductionReadinessActions.has(action))',
  "if (action === 'create_department')",
);
for (const action of targetActions) {
  const rpcPattern = new RegExp(`serviceClient\\.rpc\\('${action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`);
  check(`fixed RPC mapping exists: ${action}`, rpcPattern.test(handler));
}
check('caller cannot select an arbitrary RPC name',
  !/\.rpc\s*\(\s*(?:action|payload\.|requestBody\.)/.test(edge)
  && !/(?:rpc_name|rpcName)\s*[:=]\s*(?:payload|requestBody)/.test(edge)
  && edge.includes('UNSUPPORTED_PRIVILEGED_ACTION'));
check('JWT is required before dispatch',
  edge.includes('AUTH_TOKEN_REQUIRED')
  && edge.indexOf('AUTH_TOKEN_REQUIRED') < edge.indexOf('auth.getUser(token)'));
check('invalid JWT is denied before service-role dispatch',
  edge.includes('AUTH_TOKEN_INVALID')
  && edge.indexOf('AUTH_TOKEN_INVALID') < edge.indexOf("if (patch83q1ProductionReadinessActions.has(action))"));
check('unauthorized roles are denied with organization scope',
  handler.includes('PRODUCTION_READINESS_ROLE_REQUIRED')
  && handler.includes("['governance_admin', 'super_admin']")
  && handler.includes("['governance_admin', 'executive']")
  && edge.includes('assignment.organization_id === actorProfile.organization_id'));
check('caller-supplied actor identity is ignored',
  !handler.includes('payload.actor_id')
  && (handler.match(/p_actor_id:\s*userData\.user\.id/g) ?? []).length === 4);
check('invalid UUID is denied',
  edge.includes('const uuidPattern =') && handler.includes('PILOT_REVIEW_UUID_INVALID'));
check('statuses match the exact live Patch 44 table constraint',
  ['draft', 'ready_for_review', 'approved_for_controlled_pilot', 'approved_with_limitations', 'blocked', 'rejected']
    .every((status) => edge.includes(`'${status}'`))
  && handler.includes('PILOT_REVIEW_STATUS_INVALID'));
check('invalid event type is denied without inventing a database enum',
  edge.includes('const pilotEventTypePattern =') && handler.includes('PILOT_EVENT_TYPE_INVALID'));
check('required titles, notes, summaries, decisions, and snapshot hashes are validated',
  ['PILOT_REVIEW_TITLE_INVALID', 'PILOT_REVIEW_NOTES_INVALID', 'PILOT_EVENT_SUMMARY_INVALID',
    'EXECUTIVE_PRODUCTION_DECISION_INVALID', 'EXECUTIVE_PRODUCTION_NOTES_INVALID',
    'EXECUTIVE_PRODUCTION_SNAPSHOT_HASH_INVALID'].every((code) => handler.includes(code)));
check('RPC errors are returned without raw database messages',
  handler.includes('PRODUCTION_READINESS_ACTION_FAILED')
  && !/errorResponse\(\s*rpcResult\.error\.message/.test(handler));

for (const action of targetActions.slice(0, 3)) {
  check(`frontend uses privileged-action for ${action}`,
    frontendApi.includes(`invokePrivilegedAction<string>('${action}'`)
    || frontendApi.includes(`invokePrivilegedAction<void>('${action}'`));
}
check('all four actions remain registered as authenticated edge bridge actions',
  targetActions.every((action) => new RegExp(
    `actionName:\\s*'${action}'[\\s\\S]*?actionTransport:\\s*'authenticated_edge_bridge'`,
  ).test(registry)));

const browserSource = sourceFiles(path.join(root, 'src')).join('\n');
for (const action of targetActions) {
  check(`direct browser RPC remains absent: ${action}`,
    !new RegExp(`\\.rpc\\s*\\(\\s*['\"]${action}['\"]`).test(browserSource));
}

const currentUserImport = block(edge, "if (action.startsWith('patch19_'))", 'if (patch22RiskActions.has(action))');
check('User Import mapping remains unchanged',
  currentUserImport.includes("serviceClient.rpc('patch19_user_management_bridge'")
  && currentUserImport.includes('p_actor_id: userData.user.id')
  && currentUserImport.includes('p_action: action')
  && currentUserImport.includes('p_payload: requestBody.payload ?? {}'));
const currentDepartmentImport = block(edge, "if (action === 'department_import_execute')", "const { data, error } = await serviceClient.rpc('v72_execute_privileged_action'");
check('Department Import mapping remains unchanged',
  currentDepartmentImport.includes("serviceClient.rpc('apply_department_import_batch'")
  && currentDepartmentImport.includes('p_actor_id: userData.user.id')
  && currentDepartmentImport.includes('p_organization_id: payload.organization_id')
  && currentDepartmentImport.includes('p_source_filename: payload.source_filename')
  && currentDepartmentImport.includes('p_import_mode: payload.import_mode')
  && currentDepartmentImport.includes('p_rows: rows'));
check('Department Import remains disabled by default',
  /return value === ["']true["'];/.test(read('src/config/featureFlags.ts')));

for (const action of targetActions) {
  const signatures = {
    create_pilot_go_no_go_review: 'public.create_pilot_go_no_go_review(text, uuid)',
    update_pilot_go_no_go_review_status: 'public.update_pilot_go_no_go_review_status(uuid, text, text, uuid)',
    record_pilot_go_no_go_event: 'public.record_pilot_go_no_go_event(uuid, text, text, uuid)',
    record_executive_production_signoff: 'public.record_executive_production_signoff(uuid, text, text, text)',
  };
  const signature = signatures[action].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  check(`migration 170 keeps ${action} service-role-only`,
    new RegExp(`revoke all on function ${signature} from public`, 'i').test(migration170)
    && new RegExp(`revoke execute on function ${signature} from anon`, 'i').test(migration170)
    && new RegExp(`revoke execute on function ${signature} from authenticated`, 'i').test(migration170)
    && new RegExp(`grant execute on function ${signature} to service_role`, 'i').test(migration170));
}

for (const file of [
  'patch83q1-input-contract.md',
  'patch83q1-security-design.md',
  'patch83q1-validation-results.md',
  'patch83q1-deployment-result.md',
  'patch83q1-activation-decision.md',
]) {
  check(`evidence exists: ${file}`, fs.existsSync(path.join(evidenceDir, file)));
}

const failed = checks.filter((item) => !item.passed);
const result = {
  patch: '83Q.1',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  check_count: checks.length,
  failed_count: failed.length,
  failed: failed.map((item) => item.name),
  checks,
};
fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(proofPath, `${JSON.stringify(result, null, 2)}\n`);
for (const item of checks) console.log(`${item.passed ? 'PASS' : 'FAIL'}: ${item.name}`);
if (failed.length) process.exit(1);
console.log('\nPatch 83Q.1 proof passed.');
