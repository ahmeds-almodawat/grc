import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release/patch70');
const outPath = path.join(outDir, 'patch70-handover-proof.json');

const checks = [
  { name: 'MockData deleted', passed: !fs.existsSync(path.join(root, 'src/data/mockData.ts')) },
  { name: 'NoMockAutoTestCenter deleted', passed: !fs.existsSync(path.join(root, 'src/pages/NoMockAutoTestCenter.tsx')) },
  { name: 'v59 script deleted', passed: !fs.existsSync(path.join(root, 'scripts/v59-clean-mock-suggestions.mjs')) },
  { name: 'v60 script deleted', passed: !fs.existsSync(path.join(root, 'scripts/v60-install-no-mock-scripts.mjs')) },
  { name: 'LIVE_HANDOVER.md exists', passed: fs.existsSync(path.join(root, 'LIVE_HANDOVER.md')) },
  { name: 'Freeze migration exists', passed: fs.existsSync(path.join(root, 'supabase/migrations/116_patch70_live_hospital_freeze.sql')) }
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '70',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (failed.length > 0) {
  console.error('\n❌ patch70 handover proof failed:');
  failed.forEach(f => console.error(`  - ${f.name}`));
  process.exit(1);
}

console.log(`\n✅ patch70 handover proof passed. (${checks.length} checks)`);
