import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const evidenceDir = path.join(root, 'release', 'patch83q');
const requiredEvidence = [
  'patch83q-root-cause.md',
  'patch83q-live-security-definer-inventory.json',
  'patch83q-live-security-definer-inventory.md',
  'patch83q-function-classification.md',
  'patch83q-corrective-migration.md',
  'patch83q-managed-schema-review.md',
  'patch83q-regression-results.md',
  'patch83q-deployment-result.md',
  'patch83q-security-posture.md',
  'patch83q-activation-decision.md',
];
const findings = [];
const pass = [];
function check(name, condition) {
  (condition ? pass : findings).push(name);
}

for (const file of requiredEvidence) check(`evidence exists: ${file}`, fs.existsSync(path.join(evidenceDir, file)));
const inventoryText = read('release/patch83q/patch83q-live-security-definer-inventory.json');
const inventory = JSON.parse(inventoryText);
const migration = read('supabase/migrations/170_patch83q_security_definer_grant_closure.sql');
const migrationCode = migration.replace(/^\s*--.*$/gm, '');
const classification = read('release/patch83q/patch83q-function-classification.md');
const deployment = read('release/patch83q/patch83q-deployment-result.md');
const posture = read('release/patch83q/patch83q-security-posture.md');
const activation = read('release/patch83q/patch83q-activation-decision.md');
const registry = read('src/lib/runtimeActionRegistry.ts');
const edge = read('supabase/functions/privileged-action/index.ts');
function walkSource(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkSource(full);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [fs.readFileSync(full, 'utf8')] : [];
  });
}
const srcFiles = walkSource(path.join(root, 'src')).join('\n');

check('inventory is schema-only and sanitized', inventory.contains_table_data === false
  && !/(service[_-]?role[_-]?key|password|bearer\s+[a-z0-9._-]+|postgres(?:ql)?:\/\/)/i.test(inventoryText));
check('383 public SECURITY DEFINER functions recorded', inventory.security_definer_function_count === 383);
check('every public SECURITY DEFINER function has an exact signature and category', inventory.functions.length === 383
  && inventory.functions.every((fn) => fn.function_signature?.startsWith('public.') && fn.final_category));
check('focused browser-executable count is authoritative', inventory.broad_security_definer_execute_count >= 2
  && inventory.broad_security_definer_execute_count <= 6);

const targets = [...migration.matchAll(/(?:revoke|grant)\s+(?:all|execute)\s+on\s+function\s+([^\n]+?)\s+(?:from|to)\s+/gi)]
  .map((match) => match[1].trim().toLowerCase());
const expectedTargets = [
  'public.create_pilot_go_no_go_review(text, uuid)',
  'public.record_pilot_go_no_go_event(uuid, text, text, uuid)',
  'public.update_pilot_go_no_go_review_status(uuid, text, text, uuid)',
  'public.record_executive_production_signoff(uuid, text, text, text)',
];
check('migration targets only four verified user-owned privileged write functions',
  new Set(targets).size === expectedTargets.length && expectedTargets.every((target) => targets.includes(target)));
check('migration does not target managed schemas', !/\b(?:graphql|net|supabase_functions)\./i.test(migrationCode));
check('migration contains no table/data/function-body DDL or DML',
  !/\b(?:create|alter|drop|truncate)\s+(?:table|function|policy|trigger)|\b(?:insert\s+into|update\s+\S+\s+set|delete\s+from|merge\s+into)\b/i.test(migrationCode));
for (const target of expectedTargets) {
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  check(`${target} revokes PUBLIC/anon/authenticated and preserves service_role`,
    new RegExp(`revoke all on function ${escaped} from public`, 'i').test(migration)
    && new RegExp(`revoke execute on function ${escaped} from anon`, 'i').test(migration)
    && new RegExp(`revoke execute on function ${escaped} from authenticated`, 'i').test(migration)
    && new RegExp(`grant execute on function ${escaped} to service_role`, 'i').test(migration));
}
check('verified read-only exceptions are documented', classification.includes('public.current_user_org_id()')
  && classification.includes('public.has_any_role(text[])') && classification.includes('public.search_grc_global(text, integer)'));
check('department import action is privileged_admin over authenticated bridge',
  /actionName:\s*'department_import_execute'[\s\S]*?actionTransport:\s*'authenticated_edge_bridge'[\s\S]*?classification:\s*'privileged_admin'/.test(registry));
check('no direct browser apply_department_import_batch call', !/\.rpc\s*\(\s*['"]apply_department_import_batch['"]/.test(srcFiles)
  && edge.includes("'apply_department_import_batch'"));

for (const number of [167, 168, 169]) {
  const relative = execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' })
    .split(/\r?\n/).find((file) => file.startsWith(`supabase/migrations/${number}_`));
  let unchanged = true;
  try {
    execFileSync('git', ['diff', '--quiet', 'HEAD', '--', relative], { cwd: root });
  } catch {
    unchanged = false;
  }
  check(`migration ${number} unchanged`, unchanged);
}
check('Department Import feature flag remains fail-closed', /return value === ["']true["'];/.test(read('src/config/featureFlags.ts')));
check('Vercel and production deployment remain untouched', /Vercel environment modified:\s*false/i.test(deployment)
  && /Production application deployment executed:\s*false/i.test(deployment));
check('no unrestricted production-readiness claim', posture.includes('not an unrestricted production-readiness claim'));
check('activation decision uses controlled vocabulary', /`(?:blocked_unresolved_security_grants|ready_for_controlled_pilot_security_gate|manual_security_acceptance_required)`/.test(activation));

const runtimePath = path.join(root, 'release', 'v700', 'runtime-security-bridge-audit.json');
if (fs.existsSync(runtimePath)) {
  const runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
  check('critical status is absent only after live unsafe count reaches zero',
    inventory.confirmed_unsafe_browser_exposure_count === 0
      ? runtime.status !== 'critical_remediation_required'
      : runtime.status === 'critical_remediation_required');
}

for (const name of pass) console.log(`PASS: ${name}`);
if (findings.length) {
  for (const name of findings) console.error(`FAIL: ${name}`);
  process.exit(1);
}
console.log('\nPatch 83Q proof passed.');
