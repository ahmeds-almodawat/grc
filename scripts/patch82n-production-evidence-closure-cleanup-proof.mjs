import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const checks = [];
function check(name, testFn) {
  try {
    const passed = testFn();
    checks.push({ name, pass: Boolean(passed) });
    if (!passed) console.error(`❌ ${name}`);
    else console.log(`✅ ${name}`);
  } catch (error) {
    checks.push({ name, pass: false });
    console.error(`❌ ${name} (${error.message})`);
  }
}

const page = read('src/pages/ProductionEvidenceClosureCenter.tsx');
const api = read('src/lib/productionEvidenceClosureApi.ts');

check('ProductionEvidenceClosureCenter contains "Internal readiness tool"', () => {
  if (!page.includes('Internal readiness tool')) throw new Error('Missing label');
  return true;
});

check('ProductionEvidenceClosureCenter contains "No live production evidence records are attached yet"', () => {
  if (!page.includes('No live production evidence records are attached yet')) throw new Error('Missing empty state message');
  return true;
});

check('ProductionEvidenceClosureCenter no longer renders all detailed technical columns by default', () => {
  const forbidden = [
    '<th>Training/adoption/support evidence</th>',
    '<th>Backup and restore evidence</th>',
    '<th>Policy/SOP attestation evidence</th>',
    '<th>Access review evidence</th>',
    '<th>Owner state</th>',
    '<th>Reviewer state</th>',
    '<th>Blocker state</th>',
    '<th>Escalation readiness</th>'
  ];
  const violations = forbidden.filter(f => page.includes(f));
  if (violations.length > 0) throw new Error(violations.join(', '));
  return true;
});

check('productionEvidenceClosureApi has logic to avoid counting generated/fallback placeholder rows as live evidence gaps', () => {
  if (!api.includes('rawIntakeQueue.filter') && !api.includes('isGenerated')) throw new Error('Missing API filtering logic');
  return true;
});

check('no migrations/functions/auth/RLS/service-role/privileged-action/backend security files changed', () => {
  const diff = execSync('git diff --name-only', { encoding: 'utf8' });
  const forbidden = ['migrations', 'auth', 'functions', 'RLS', 'service-role', 'privileged-action'];
  const diffFiles = diff.split('\n').map(l => l.trim()).filter(Boolean);
  const violations = diffFiles.filter(file => {
    if (file === 'src/auth/authAccess.ts') return false; // Allowed from previous patches
    return forbidden.some(f => file.toLowerCase().includes(f.toLowerCase()));
  });
  if (violations.length > 0) {
    throw new Error(violations.join(', '));
  }
  return true;
});

const failed = checks.filter(c => !c.pass);
if (failed.length > 0) {
  process.exit(1);
}
