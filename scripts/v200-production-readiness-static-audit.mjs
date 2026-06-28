import fs from 'node:fs';

const checks = [];
const add = (id, severity, passed, detail) => checks.push({ id, severity, passed, detail });
const exists = (path) => fs.existsSync(path);
const read = (path) => exists(path) ? fs.readFileSync(path, 'utf8') : '';

const requiredFiles = [
  'src/lib/v200ProductionReadinessModel.ts',
  'src/components/v200/UatClosureDashboard.tsx',
  'src/components/v200/ProductionReadinessGatePanel.tsx',
  'src/components/v200/SecurityBackupHardeningPanel.tsx',
  'src/styles/v200-production-readiness.css',
  'scripts/v200-production-readiness-report.mjs',
  'scripts/v200-final-proof.mjs',
];

for (const file of requiredFiles) add(`file:${file}`, 'critical', exists(file), `${file} must exist`);

const model = read('src/lib/v200ProductionReadinessModel.ts');
add('chain-present', 'critical', model.includes('UAT → Issues → Approvals → Security/RLS → Backup/Restore → Confidentiality → Production Go/No-Go'), 'v20 readiness chain must be present');
add('no-fake-uat-pass', 'high', !model.includes("status: 'passed'") || model.includes('Manual approval evidence summary'), 'v20 must not fake UAT scenario passes');
add('review-required-recommendation', 'high', model.includes('Controlled production start: review required'), 'v20 must keep readiness honest until real UAT closure');

const pages = [
  ['src/pages/ControlledUatWorkbench.tsx', 'UatClosureDashboard'],
  ['src/pages/ProductionReleaseCenter.tsx', 'ProductionReadinessGatePanel'],
  ['src/pages/ProductionProofCenter.tsx', 'ProductionReadinessGatePanel'],
  ['src/pages/SecurityAuditCenter.tsx', 'SecurityBackupHardeningPanel'],
];

for (const [page, marker] of pages) {
  if (exists(page)) add(`injection:${page}`, 'high', read(page).includes(marker), `${page} should render ${marker}`);
}

const pkg = read('package.json');
add('package-script', 'critical', pkg.includes('pilot:v200-production-readiness'), 'package.json must include pilot:v200-production-readiness');

const critical = checks.filter(check => !check.passed && check.severity === 'critical').length;
const high = checks.filter(check => !check.passed && check.severity === 'high').length;
const medium = checks.filter(check => !check.passed && check.severity === 'medium').length;
const report = {
  generated_at: new Date().toISOString(),
  status: critical || high ? 'failed' : 'passed',
  critical,
  high,
  medium,
  checks,
};

fs.mkdirSync('release/v200', { recursive: true });
fs.writeFileSync('release/v200/v200-static-audit.json', `${JSON.stringify(report, null, 2)}\n`);
console.log('v20.0 production readiness static audit complete.');
console.log({ status: report.status, critical, high, medium });
if (report.status !== 'passed') process.exit(1);
