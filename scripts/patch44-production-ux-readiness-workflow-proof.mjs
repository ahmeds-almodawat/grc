import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, 'release/patch44');
const outPath = path.join(outDir, 'patch44-workflow-proof.json');
const apiPath = path.join(repoRoot, 'src/lib/productionReadinessApi.ts');
const migrationPath = path.join(repoRoot, 'supabase/migrations/104_patch44_production_ux_readiness_pilot_hardening.sql');

const apiSource = fs.existsSync(apiPath) ? fs.readFileSync(apiPath, 'utf8') : '';
const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';

const checks = [
  { name: 'createPilotGoNoGoReview exposed in frontend API', passed: apiSource.includes('createPilotGoNoGoReview(') },
  { name: 'updatePilotGoNoGoReviewStatus exposed in frontend API', passed: apiSource.includes('updatePilotGoNoGoReviewStatus(') },
  { name: 'recordPilotGoNoGoEvent exposed in frontend API', passed: apiSource.includes('recordPilotGoNoGoEvent(') },
  { name: 'getGoNoGoDashboard uses patch44 view', passed: apiSource.includes('v_patch44_pilot_go_no_go_dashboard') },
  { name: 'getBilingualReadinessDashboard uses patch44 view', passed: apiSource.includes('v_patch44_bilingual_readiness_summary') },
  { name: 'invokePrivilegedAction used for mutations', passed: apiSource.includes('invokePrivilegedAction') && apiSource.includes('create_pilot_go_no_go_review') },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '44',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  check_count: checks.length,
  failed_count: failed.length,
  failed,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
