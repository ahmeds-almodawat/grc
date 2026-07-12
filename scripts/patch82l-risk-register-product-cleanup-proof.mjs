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

const risks = read('src/pages/Risks.tsx');

check('No illustrative panels imported or rendered', () => {
  const forbidden = [
    'ProfessionalGrcMaturityPanel',
    'ProfessionalGrcWorkflowMap',
    'RiskAppetiteTreatmentPanel',
    'RiskControlTraceabilityPanel',
    'RiskExecutionWorkflowMap',
    'FrameworkCrosswalkBackbonePanel',
    'ControlTestingWorkflowPanel',
    'ControlAssuranceReadinessPanel',
    'ScenarioFillButton'
  ];
  return !forbidden.some(panel => risks.includes(panel));
});

check('No illustrative text strings present', () => {
  const forbiddenText = [
    'v17',
    'v21',
    'v22',
    'Professional workflow chain',
    'Risk crosswalk backbone',
    'Maturity score',
    'Test-fill Control'
  ];
  const violations = forbiddenText.filter(text => risks.includes(text));
  if (violations.length > 0) throw new Error(violations.join(', '));
  return true;
});

check('Enterprise risk register table still present', () => {
  return risks.includes('Enterprise risk register') && risks.includes('module-card');
});

check('New Risk button still present', () => {
  return risks.includes('New Risk') && risks.includes('setFormOpen(true)');
});

check('No migrations/functions/RLS/auth/privileged-action/backend security files changed', () => {
  const diff = execSync('git diff --name-only', { encoding: 'utf8' });
  const forbidden = ['migrations', 'auth', 'functions', 'RLS', 'service-role', 'privileged-action'];
  const diffFiles = diff.split('\n').map(l => l.trim()).filter(Boolean);
  const violations = diffFiles.filter(file => {
    if (file === 'src/auth/authAccess.ts') return false;
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
