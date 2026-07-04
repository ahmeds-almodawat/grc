import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationRel = 'supabase/migrations/113_patch55_hospital_operations_readiness_pack.sql';
const migrationPath = path.join(root, migrationRel);
const reportPath = path.join(root, 'release', 'patch55', 'patch55-schema-proof.json');

const requiredTables = [
  'hospital_department_launch_packs',
  'hospital_department_launch_checklist_items',
  'hospital_support_readiness_records',
  'hospital_policy_attestation_readiness',
  'hospital_adoption_readiness_reviews',
  'hospital_operations_readiness_events',
];

const requiredViews = [
  'v_patch55_department_launch_pack_register',
  'v_patch55_department_launch_checklist_register',
  'v_patch55_incomplete_launch_checklist_register',
  'v_patch55_department_support_readiness_register',
  'v_patch55_support_readiness_blocker_register',
  'v_patch55_policy_attestation_readiness_register',
  'v_patch55_missing_policy_attestation_register',
  'v_patch55_department_adoption_readiness_register',
  'v_patch55_low_adoption_department_register',
  'v_patch55_department_launch_blocker_register',
  'v_patch55_hospital_operations_readiness_summary',
  'v_patch55_production_readiness_hospital_operations_overlay',
];

const requiredFunctions = [
  'create_hospital_department_launch_pack',
  'update_hospital_department_launch_pack_status',
  'create_hospital_department_launch_checklist_item',
  'update_hospital_department_launch_checklist_item_status',
  'create_hospital_support_readiness_record',
  'update_hospital_support_readiness_status',
  'create_hospital_policy_attestation_readiness',
  'update_hospital_policy_attestation_status',
  'create_hospital_adoption_readiness_review',
  'update_hospital_adoption_readiness_status',
  'record_hospital_operations_readiness_event',
  'get_hospital_operations_readiness_summary',
  'get_production_readiness_hospital_operations_overlay',
];

const source = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = source.toLowerCase();

function hasTable(name) {
  return new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${name}\\b`, 'i').test(source);
}

function hasRls(name) {
  return new RegExp(`alter\\s+table\\s+public\\.${name}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(source);
}

function hasPolicy(name) {
  return new RegExp(`create\\s+policy\\s+.*?\\s+on\\s+public\\.${name}\\b`, 'is').test(source);
}

function hasView(name) {
  return new RegExp(`create\\s+or\\s+replace\\s+view\\s+public\\.${name}\\b`, 'i').test(source);
}

function hasSecurityInvoker(name) {
  return new RegExp(`alter\\s+view\\s+if\\s+exists\\s+public\\.${name}\\s+set\\s*\\(\\s*security_invoker\\s*=\\s*true\\s*\\)`, 'i').test(source);
}

function hasFunction(name) {
  return new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\b`, 'i').test(source);
}

const mutatingFunctions = requiredFunctions.filter(name => !name.startsWith('get_'));
const broadGrantFindings = mutatingFunctions.filter(name => {
  const pattern = new RegExp(`^\\s*grant\\s+execute\\s+on\\s+function\\s+public\\.${name}\\b.*\\s+to\\s+(public|anon|authenticated)\\s*;\\s*$`, 'im');
  return pattern.test(source);
});

const checks = [
  { name: 'migration exists', passed: fs.existsSync(migrationPath), path: migrationRel },
  ...requiredTables.map(table => ({ name: `table exists: ${table}`, passed: hasTable(table) })),
  ...requiredTables.map(table => ({ name: `rls enabled: ${table}`, passed: hasRls(table) })),
  ...requiredTables.map(table => ({ name: `policy exists: ${table}`, passed: hasPolicy(table) })),
  ...requiredViews.map(view => ({ name: `view exists: ${view}`, passed: hasView(view) })),
  ...requiredViews.map(view => ({ name: `security_invoker view: ${view}`, passed: hasSecurityInvoker(view) })),
  ...requiredFunctions.map(fn => ({ name: `function exists: ${fn}`, passed: hasFunction(fn) })),
  { name: 'no broad execute grants for mutating Patch 55 functions', passed: broadGrantFindings.length === 0, findings: broadGrantFindings },
  { name: 'service role guard present', passed: lower.includes('patch55_service_role_required') },
];

const report = {
  generated_at: new Date().toISOString(),
  strict_passed: checks.every(check => check.passed),
  check_count: checks.length,
  failed_count: checks.filter(check => !check.passed).length,
  failed: checks.filter(check => !check.passed),
  tables: requiredTables,
  views: requiredViews,
  functions: requiredFunctions,
  checks,
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.strict_passed) process.exit(1);
