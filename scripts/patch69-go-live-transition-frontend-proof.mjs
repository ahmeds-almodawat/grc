import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release/patch69');
const outPath = path.join(outDir, 'patch69-frontend-proof.json');

const appVersionPath = path.join(root, 'src/lib/appVersion.ts');
const appVersionSource = fs.existsSync(appVersionPath) ? fs.readFileSync(appVersionPath, 'utf8') : '';

const checks = [
  { name: 'appVersion exists', passed: fs.existsSync(appVersionPath) },
  { name: 'Baseline name updated', passed: appVersionSource.includes("APP_BASELINE_NAME = 'Live Hospital Operating Baseline'") },
  { name: 'Production label updated', passed: appVersionSource.includes("APP_PRODUCTION_READINESS_LABEL = 'live-hospital-operating'") },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '69',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (failed.length > 0) {
  console.error('\n❌ patch69 frontend proof failed:');
  failed.forEach(f => console.error(`  - ${f.name}`));
  process.exit(1);
}

console.log(`\n✅ patch69 frontend proof passed. (${checks.length} checks)`);
