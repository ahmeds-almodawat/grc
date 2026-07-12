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

const evidence = read('src/pages/Evidence.tsx');

check('Evidence.tsx no longer imports/renders illustrative panels and text', () => {
  const forbidden = [
    'ScenarioFillButton',
    'GrcTraceabilityMap',
    'FrameworkCrosswalkBackbonePanel',
    'AuditorEvidencePackPanel',
    'createScenarioLabScenario',
    'V99_SCENARIO_TAG',
    'Test-fill Evidence',
    'Synthetic evidence test fill',
    'Patch 23 Evidence governance',
    'Evidence rule'
  ];
  const violations = forbidden.filter(panel => evidence.includes(panel));
  if (violations.length > 0) throw new Error(violations.join(', '));
  return true;
});

check('Evidence.tsx still contains real features', () => {
  const required = [
    'Evidence Library',
    'Evidence review queue',
    'Evidence gap dashboard',
    'Evidence closure gate status',
    'Evidence pack index',
    'Evidence detail',
    'Generate pack index'
  ];
  const missing = required.filter(text => !evidence.includes(text));
  if (missing.length > 0) throw new Error(missing.join(', '));
  return true;
});

check('No migrations/functions/auth/RLS/service-role/privileged-action/backend security files changed', () => {
  const diff = execSync('git diff --name-only', { encoding: 'utf8' });
  const forbidden = ['migrations', 'auth', 'functions', 'RLS', 'service-role', 'privileged-action'];
  const diffFiles = diff.split('\n').map(l => l.trim()).filter(Boolean);
  const violations = diffFiles.filter(file => {
    if (file === 'src/auth/authAccess.ts') return false; // Allowed from previous patch
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
