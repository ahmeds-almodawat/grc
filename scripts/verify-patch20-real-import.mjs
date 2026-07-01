import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const expectedInputs = [
  '01_departments.csv',
  '02_committees.csv',
  '03_role_matrix.csv',
  '04_users_owners.csv',
  '05_evidence_taxonomy.csv',
  '06_control_library.csv',
  '07_kpi_indicators.csv',
  '08_tracer_templates.csv',
  '09_audit_universe.csv',
  '10_compliance_obligations.csv',
  '11_document_register.csv',
  '12_standards_metadata.csv',
  '13_uat_scenarios.csv',
  '14_go_no_go_signoffs.csv',
  '15_payroll_department_map.csv',
];

const requiredArtifacts = [
  'scripts/import-real-grc-pack.mjs',
  'scripts/verify-patch20-real-import.mjs',
  'docs/PATCH20_REAL_DATA_IMPORT_CENTER.md',
  'docs/PATCH20_REAL_IMPORT_ORCHESTRATOR.md',
  'src/lib/realDataImportApi.ts',
  'src/pages/RealDataImportCenter.tsx',
  'src/pages/RealDataImportRunner.tsx',
  'supabase/migrations/081_patch20_real_data_import_orchestrator.sql',
  'release/import/patch20-dry-run-summary.json',
  'release/import/patch20-dry-run-summary.csv',
  'release/import/patch20-validation-errors.csv',
  'release/import/patch20-validation-warnings.csv',
  'release/import/patch20-pending-auth-users.csv',
  'release/import/patch20-generated-email-review.csv',
  'release/import/patch20-payroll-discovered-departments-review.csv',
  'release/import/patch20-import-plan.json',
];

const checks = [];

function relPath(file) {
  return path.join(root, file);
}

function read(file) {
  return fs.readFileSync(relPath(file), 'utf8');
}

function assert(condition, message) {
  checks.push({ ok: Boolean(condition), message });
  if (!condition) {
    throw new Error(message);
  }
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, files);
    } else {
      files.push(absolute);
    }
  }
  return files;
}

for (const artifact of requiredArtifacts) {
  assert(fs.existsSync(relPath(artifact)), `${artifact} exists`);
}

const importer = read('scripts/import-real-grc-pack.mjs');
const migration = read('supabase/migrations/081_patch20_real_data_import_orchestrator.sql');
const app = read('src/App.tsx');
const center = read('src/pages/RealDataImportCenter.tsx');
const importApi = read('src/lib/realDataImportApi.ts');
const centerDocs = read('docs/PATCH20_REAL_DATA_IMPORT_CENTER.md');
const orchestratorDocs = read('docs/PATCH20_REAL_IMPORT_ORCHESTRATOR.md');
const userManagement = read('src/pages/UserManagementCenter.tsx');
const dryRunReport = JSON.parse(read('release/import/patch20-dry-run-summary.json'));
const importPlan = JSON.parse(read('release/import/patch20-import-plan.json'));
const proofSuite = fs.existsSync(relPath('release/v700/proof-suite-all.json'))
  ? JSON.parse(read('release/v700/proof-suite-all.json'))
  : null;

for (const flag of ['--dry-run', '--apply', '--folder', '--organization-id', '--create-auth-users', '--skip-auth-user-creation', '--limit']) {
  assert(importer.includes(flag), `importer supports ${flag}`);
}

for (const file of expectedInputs) {
  assert(importer.includes(file), `importer references ${file}`);
  assert(importApi.includes(file), `Real Data Import API references ${file}`);
  assert(centerDocs.includes(file), `Real Data Import Center docs list ${file}`);
}

assert(importPlan.length === expectedInputs.length, 'import plan includes every expected input');
assert(importPlan.every((item, index) => item.file === expectedInputs[index]), 'import plan preserves dependency order');

const checkSyntax = spawnSync(process.execPath, ['--check', relPath('scripts/import-real-grc-pack.mjs')], {
  cwd: root,
  encoding: 'utf8',
});
assert(checkSyntax.status === 0, `importer syntax passes node --check${checkSyntax.stderr ? `: ${checkSyntax.stderr}` : ''}`);

for (const [label, source] of [
  ['Patch 20 importer', importer],
  ['Patch 20 migration', migration],
  ['Patch 20 import API', importApi],
  ['Patch 20 center page', center],
]) {
  assert(!/\.delete\s*\(/i.test(source), `${label} does not call Supabase delete()`);
  assert(!/\bdelete\s+from\b/i.test(source), `${label} does not contain SQL deletion statements`);
  assert(!/drop\s+table\b/i.test(source), `${label} does not drop tables`);
}

for (const sensitive of ['salary', 'bank', 'iqama', 'deduction', 'allowance', 'nationality']) {
  assert(importer.toLowerCase().includes(sensitive), `importer detects ${sensitive} sensitive fields`);
}
assert(importer.includes('SENSITIVE_FIELD_PATTERNS'), 'importer centralizes payroll-sensitive field patterns');
assert(importer.includes('sanitizeRow') && importer.includes('if (hasSensitiveHeader(key)) continue'), 'importer excludes sensitive fields from sanitized payloads');
assert(importer.includes('organization-id must be a real organization UUID'), 'importer rejects placeholder organization IDs with a PowerShell-safe hint');

assert(importer.includes('LONG_STANDARD_TEXT_LIMIT'), 'importer has long standards text limit');
assert(importer.includes('copyright_text_risk'), 'importer blocks long copyrighted standards text');
assert(importer.includes('metadata_only'), 'standards import is metadata-only by default');

const srcFiles = walk(relPath('src')).filter(file => /\.(ts|tsx|js|jsx)$/.test(file));
const clientServiceRoleHits = srcFiles.filter(file => /SUPABASE_SERVICE_ROLE_KEY|service_role_key/i.test(fs.readFileSync(file, 'utf8')));
assert(clientServiceRoleHits.length === 0, `client code does not expose service-role key${clientServiceRoleHits.length ? `: ${clientServiceRoleHits.join(', ')}` : ''}`);

assert(app.includes("import { RealDataImportCenter } from './pages/RealDataImportCenter';"), 'App imports RealDataImportCenter');
assert(app.includes("id: 'realDataImportCenter'") && app.includes('Real Data Import Center') && app.includes('<RealDataImportCenter />'), 'Admin Hub has Real Data Import Center tab');
assert(center.includes('Overview') && center.includes('File Checklist') && center.includes('Dry Run') && center.includes('Validation Errors') && center.includes('Warnings') && center.includes('Pending Auth Users') && center.includes('Apply Results') && center.includes('Rollback / Snapshot') && center.includes('Production Readiness'), 'Real Data Import Center has requested sections');
assert(center.includes('Real Data Activation') && center.includes('Real UAT Execution') && center.includes('Production Go/No-Go'), 'Real Data Import Center links workflow to activation, UAT, and go/no-go');
assert(!center.includes('<organization_uuid>') && !importApi.includes('<organization_uuid>') && !centerDocs.includes('<organization_uuid>') && !orchestratorDocs.includes('<organization_uuid>'), 'operator commands avoid PowerShell-hostile angle-bracket placeholders');
assert(importApi.includes('$env:GRC_ORGANIZATION_ID') && centerDocs.includes('$env:GRC_ORGANIZATION_ID') && orchestratorDocs.includes('$env:GRC_ORGANIZATION_ID'), 'operator commands use PowerShell-safe organization ID variable');
assert(app.includes("id: 'realDataActivation'") && app.includes('<RealDataActivationCenter />'), 'Real Data Activation tab remains');
assert(app.includes("id: 'realProductionGoNoGo'") && app.includes('<ProductionGoNoGoCenter />'), 'Production Go/No-Go tab remains');
assert(app.includes("id: 'userManagement'") && app.includes('<UserManagementCenter />'), 'User Management tab remains');
assert(app.includes("id: 'realUatExecution'") && app.includes('<RealUatExecutionCenter />'), 'Real UAT Execution tab remains');
assert(app.includes('UAT Evidence Pack') && app.includes('<UatAccreditationEvidenceCenter />'), 'UAT Evidence Pack remains');
assert(userManagement.includes('never hard-deleted'), 'User Management keeps no-hard-delete messaging');

assert(migration.includes('alter table public.patch20_real_import_runs enable row level security'), 'import runs table has RLS');
assert(migration.includes('alter table public.patch20_real_import_rows enable row level security'), 'import rows table has RLS');
assert(migration.includes('alter table public.patch20_pending_auth_users enable row level security'), 'pending auth users table has RLS');
assert(migration.includes('has_any_role'), 'Patch 20 policies keep admin role checks');

assert(dryRunReport.blocking_error_count === 0, 'latest dry-run has no blocking errors');
assert(dryRunReport.mode === 'dry_run', 'latest report is a dry-run report');
assert(dryRunReport.input_available === true || dryRunReport.environment_precheck_only === true, 'dry-run records input availability or environment precheck');
assert(!proofSuite || proofSuite.status === 'passed', 'latest proof suite report remains clean when present');

const summary = {
  generated_at: new Date().toISOString(),
  checks: checks.length,
  status: 'passed',
  dry_run_input_available: dryRunReport.input_available,
  dry_run_can_apply: dryRunReport.can_apply,
  dry_run_warning_count: dryRunReport.warning_count,
};

fs.mkdirSync(relPath('release/import'), { recursive: true });
fs.writeFileSync(relPath('release/import/patch20-verification-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
