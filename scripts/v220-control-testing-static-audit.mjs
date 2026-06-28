import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [];
function addCheck(name, passed, severity = 'high', detail = '') {
  checks.push({ name, passed, severity, detail });
}
function read(rel) {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

const model = read('src/lib/v220ControlTestingCapaModel.ts');
const workflow = read('src/components/v220/ControlTestingWorkflowPanel.tsx');
const capa = read('src/components/v220/CapaExecutionPanel.tsx');
const readiness = read('src/components/v220/ControlAssuranceReadinessPanel.tsx');
const migration = read('supabase/migrations/058_v220_control_testing_capa_execution.sql');
const pkg = JSON.parse(read('package.json') || '{}');
const ci = read('.github/workflows/ci.yml');

addCheck('model file exists', exists('src/lib/v220ControlTestingCapaModel.ts'), 'critical');
addCheck('workflow component exists', exists('src/components/v220/ControlTestingWorkflowPanel.tsx'), 'critical');
addCheck('CAPA component exists', exists('src/components/v220/CapaExecutionPanel.tsx'), 'critical');
addCheck('assurance readiness component exists', exists('src/components/v220/ControlAssuranceReadinessPanel.tsx'), 'critical');
addCheck('migration exists', exists('supabase/migrations/058_v220_control_testing_capa_execution.sql'), 'critical');
addCheck('chain is explicit', model.includes('Control → Test → Result → Exception → Issue → CAPA → Evidence → Closure'), 'critical');
addCheck('workflow renders chain', workflow.includes('v220ControlTestingChain'), 'high');
addCheck('CAPA workflow is present', capa.includes('Failed test to CAPA closure discipline'), 'high');
addCheck('assurance panel is present', readiness.includes('Control assurance and closure readiness'), 'high');
addCheck('test plans table exists', migration.includes('v220_control_test_plans'), 'critical');
addCheck('test results table exists', migration.includes('v220_control_test_results'), 'critical');
addCheck('exceptions table exists', migration.includes('v220_control_exceptions'), 'critical');
addCheck('CAPA table exists', migration.includes('v220_capa_actions'), 'critical');
addCheck('RLS enabled', (migration.match(/enable row level security/g) || []).length >= 5, 'critical');
addCheck('package pilot script exists', Boolean(pkg.scripts?.['pilot:v220-control-testing']), 'critical');
addCheck('CI includes v22 pilot', ci.includes('pilot:v220-control-testing'), 'medium');

const critical = checks.filter(c => !c.passed && c.severity === 'critical').length;
const high = checks.filter(c => !c.passed && c.severity === 'high').length;
const medium = checks.filter(c => !c.passed && c.severity === 'medium').length;
const status = critical || high ? 'failed' : 'passed';
const report = {
  generated_at: new Date().toISOString(),
  version: 'v22.0',
  status,
  summary: { critical, high, medium, total: checks.length, passed: checks.filter(c => c.passed).length },
  checks,
};
fs.mkdirSync(path.join(root, 'release/v220'), { recursive: true });
fs.writeFileSync(path.join(root, 'release/v220/v220-static-audit.json'), JSON.stringify(report, null, 2));
console.log('v22.0 control testing static audit complete.');
console.log({ status, critical, high, medium });
if (status !== 'passed') process.exit(1);
