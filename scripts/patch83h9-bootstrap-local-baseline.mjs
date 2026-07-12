import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';

console.log('--- Patch 83H.9 Local Bootstrap ---');

try {
  execSync('node scripts/patch83h9-check-local-baseline-environment.mjs', { stdio: 'inherit' });
} catch (e) {
  console.error('❌ Safety checks failed.');
  process.exit(1);
}

const baselinePath = 'local-baseline/schema-baseline.sql';
const shaPath = 'local-baseline/schema-baseline.sha256';

if (!fs.existsSync(baselinePath)) {
  console.error('❌ Baseline SQL not found. Execution BLOCKED.');
  process.exit(1);
}

if (!fs.existsSync(shaPath)) {
  console.error('❌ SHA-256 file not found. Execution BLOCKED.');
  process.exit(1);
}

const expectedSha = fs.readFileSync(shaPath, 'utf8').trim();
const fileBuffer = fs.readFileSync(baselinePath);
const hashSum = crypto.createHash('sha256');
hashSum.update(fileBuffer);
const actualSha = hashSum.digest('hex');

if (expectedSha !== actualSha) {
  console.error('❌ SHA-256 mismatch. Execution BLOCKED.');
  process.exit(1);
}

console.log('✅ Baseline is verified. Ready to load into local disposable database.');
// Intentionally omitting 'supabase db reset' or 'psql' calls because we are BLOCKED in Phase 1.
console.log('❌ Implementation BLOCKED due to lack of approved non-production schema source.');
process.exit(1);
