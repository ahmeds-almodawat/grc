import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let failed = false;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function check(name, condition) {
  console.log(`${condition ? 'PASS' : 'FAIL'}: ${name}`);
  if (!condition) failed = true;
}

const expectedEvidence = [
  'patch83p-frontend-activation-readiness.md',
  'patch83p-frontend-activation-readiness.json',
  'patch83p-vercel-activation-procedure.md',
  'patch83p-rollback-procedure.md',
  'patch83p-production-smoke-checklist.md',
  'patch83p-activation-decision.md',
];

const flags = read('src/config/featureFlags.ts');
const departments = read('src/pages/Departments.tsx');
const grcApi = read('src/lib/grcApi.ts');
const tests = read('tests/unit/featureFlags.test.ts');
const smoke = read('scripts/run-patch83p-local-smoke.ps1');
const packageJson = JSON.parse(read('package.json'));
const app = read('src/App.tsx');
const importExport = read('src/pages/ImportExport.tsx');
const releaseDir = path.join(root, 'release', 'patch83p');
const evidenceFiles = fs.readdirSync(releaseDir).sort();
const evidenceText = evidenceFiles.map((file) => read(path.join('release', 'patch83p', file))).join('\n');
const readiness = JSON.parse(read('release/patch83p/patch83p-frontend-activation-readiness.json'));

console.log('\n--- Running Patch 83P Frontend Activation Proof ---\n');

check('Feature flag helper is centralized and exact-match fail-closed', flags.includes('value: unknown = import.meta.env.VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED') && flags.includes('return value === "true"'));
check('Department page uses the centralized feature flag helper', departments.includes('isDepartmentImportExecutionEnabled()') && !departments.includes('import.meta.env.VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED'));
check('Eligibility requires enabled flag, authorized role, preview, valid rows, no blockers, organization, and allowed mode', ['featureEnabled', 'hasAuthorizedRole', 'previewExists', 'validRowCount > 0', '!hasBlockingValidationErrors', 'organizationResolved', 'modeAllowed'].every((token) => flags.includes(token)));
check('Preview remains independent of execution configuration', departments.includes('Prepare Import Batch') && departments.includes('Preview does not modify data.') && !departments.match(/isExecutionEnabledByConfiguration[\s\S]{0,160}Prepare Import Batch/));
check('Execution UI explains deployment and administrator gates', departments.includes('Execution is disabled by deployment configuration.') && departments.includes('Execution is available only to authorized administrators.'));
check('Frontend execution uses only department_import_execute privileged action', grcApi.includes("invokePrivilegedAction<ExecuteDepartmentImportOutput>('department_import_execute', input)") && !departments.includes('apply_department_import_batch'));
check('No direct apply_department_import_batch call exists in client source', !departments.match(/\.rpc\s*\(\s*['\"]apply_department_import_batch/) && !grcApi.match(/\.rpc\s*\(\s*['\"]apply_department_import_batch/));
check('No client service-role key variable exists', !/VITE_[A-Z0-9_]*SERVICE[_-]?ROLE|SUPABASE_SERVICE_ROLE_KEY/i.test([departments, grcApi, flags, importExport].join('\n')));
check('Focused flag and eligibility cases are present', ['undefined', '""', '"false"', '"TRUE"', '"1"', '"true"', 'department_manager', 'hasBlockingValidationErrors: true', 'validRowCount: 0', 'replace_all'].every((token) => tests.includes(token)));
check('Smoke runner uses process-only dual-mode builds and restores the flag', smoke.includes("Set-Item -LiteralPath $flagPath -Value 'false'") && smoke.includes("Set-Item -LiteralPath $flagPath -Value 'true'") && smoke.includes('finally') && smoke.includes('PATCH83P_PROCESS_FLAG_RESTORED') && !/\.env(?:\.local)?/.test(smoke));
check('Smoke runner performs no authentication or network mutation', !/signIn|password|Bearer|Authorization|supabase|Invoke-RestMethod|curl|fetch\s*\(/i.test(smoke));
check('Patch 83P package commands are exact', packageJson.scripts['patch83p:smoke'] === 'powershell -ExecutionPolicy Bypass -File scripts/run-patch83p-local-smoke.ps1' && packageJson.scripts['patch83p:proof'] === 'node scripts/patch83p-frontend-activation-proof.mjs');
check('Exactly the six requested evidence files exist', JSON.stringify(evidenceFiles) === JSON.stringify(expectedEvidence.sort()));
check('Readiness decision fields are controlled and non-production', readiness.activation_decision === 'ready_for_controlled_vercel_enablement' && readiness.frontend_execution_enabled_in_repository === false && readiness.production_deployment_executed === false && readiness.production_environment_modified === false && readiness.production_readiness_claim === false);
check('Vercel instructions contain only approved variable shapes', evidenceText.includes('VITE_SUPABASE_URL=https://zbrjjecpsrzposhuarcn.supabase.co') && evidenceText.includes('VITE_SUPABASE_ANON_KEY=<existing public anon key>') && evidenceText.includes('VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED=true'));
check('Evidence contains no stored secret or test credential', !/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|(?:password|service[_-]?role[_-]?key)\s*[:=]\s*\S+/i.test(evidenceText));
check('Rollback disables the flag, redeploys the reviewed commit, preserves preview, and keeps migrations', ['VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED=false', 'Redeploy the same reviewed commit', 'preview remains available', 'Do not roll back migrations 168 or 169'].every((token) => evidenceText.includes(token)));
check('User Import remains available', app.includes('content: <ImportExport />') && importExport.includes("title: 'Employee staging template'"));

console.log('\n---------------------------------------------');
console.log(failed ? 'Patch 83P Proof Failed.' : 'Patch 83P Proof Passed.');
process.exit(failed ? 1 : 0);
