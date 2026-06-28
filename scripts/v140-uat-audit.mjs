import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v140');
fs.mkdirSync(releaseDir, { recursive: true });

const scopeStatement = 'Controlled internal pilot using synthetic and non-confidential operational data only. No real patient identifiers. No confidential OVR details. No production-wide rollout.';

const requiredFiles = [
  'src/pages/ControlledUatWorkbench.tsx',
  'src/pages/UatIssueCapture.tsx',
  'src/lib/uatIssueApi.ts',
  'src/App.tsx',
  'src/components/Layout.tsx',
  'src/auth/authAccess.ts',
  'src/i18n/I18nContext.tsx',
  'src/styles.css',
  '.github/workflows/ci.yml',
  'package.json',
];

const requiredSignals = [
  { file: 'src/pages/ControlledUatWorkbench.tsx', signal: scopeStatement, severity: 'high' },
  { file: 'src/pages/ControlledUatWorkbench.tsx', signal: 'UAT-D1-18', severity: 'high' },
  { file: 'src/pages/ControlledUatWorkbench.tsx', signal: 'Not ready - complete UAT evidence first', severity: 'high' },
  { file: 'src/pages/ControlledUatWorkbench.tsx', signal: 'listRecentUatIssues', severity: 'high' },
  { file: 'src/pages/UatIssueCapture.tsx', signal: 'Screenshot available', severity: 'high' },
  { file: 'src/pages/UatIssueCapture.tsx', signal: 'Owner', severity: 'high' },
  { file: 'src/lib/uatIssueApi.ts', signal: 'owner_name', severity: 'high' },
  { file: 'src/lib/uatIssueApi.ts', signal: 'issue_code', severity: 'high' },
  { file: 'src/lib/uatIssueApi.ts', signal: 'screenshotAvailable', severity: 'high' },
  { file: 'src/App.tsx', signal: 'ControlledUatWorkbench', severity: 'high' },
  { file: 'src/components/Layout.tsx', signal: 'controlledUatWorkbench', severity: 'high' },
  { file: 'src/auth/authAccess.ts', signal: "controlledUatWorkbench: 'admin'", severity: 'high' },
  { file: '.github/workflows/ci.yml', signal: 'npm run pilot:v140-uat-execution', severity: 'high' },
];

const requiredScenarioTitles = [
  'Super Admin login',
  'Governance Admin login',
  'Quality user login',
  'Auditor login',
  'Department Manager login',
  'Employee login',
  'Same-department OVR',
  'Cross-department OVR',
  'Quality validation',
  'Referred department reply',
  'Quality close/escalate',
  'CAPA from OVR',
  'Risk creation',
  'Control linked to risk',
  'Control test',
  'Auditor read-only confirmation',
  'Employee restricted access confirmation',
  'External/unauthorized denial confirmation',
];

const forbiddenPatterns = [
  {
    file: 'src/pages/ControlledUatWorkbench.tsx',
    pattern: /\bproduction-wide rollout\b(?!\.)/i,
    severity: 'medium',
    issue: 'Pilot wording should stay bounded and not imply rollout expansion.',
  },
  {
    file: 'src/pages/ControlledUatWorkbench.tsx',
    pattern: /\b(enter|use|paste|upload)\s+real\s+patient/i,
    severity: 'medium',
    issue: 'Pilot copy must not encourage real patient data entry.',
  },
];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const findings = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    findings.push({ severity: 'high', file, issue: 'Required v14.0 file is missing.' });
  }
}

for (const rule of requiredSignals) {
  const fullPath = path.join(root, rule.file);
  if (!fs.existsSync(fullPath)) continue;
  const body = read(rule.file);
  if (!body.includes(rule.signal)) {
    findings.push({ severity: rule.severity, file: rule.file, issue: `Missing required signal: ${rule.signal}` });
  }
}

const workbenchPath = 'src/pages/ControlledUatWorkbench.tsx';
if (fs.existsSync(path.join(root, workbenchPath))) {
  const body = read(workbenchPath);
  const scenarioCount = (body.match(/id:\s*'UAT-D1-/g) || []).length;
  if (scenarioCount !== 18) {
    findings.push({ severity: 'high', file: workbenchPath, issue: `Expected exactly 18 Day 1 scenarios, found ${scenarioCount}.` });
  }
  for (const title of requiredScenarioTitles) {
    if (!body.includes(title)) {
      findings.push({ severity: 'high', file: workbenchPath, issue: `Missing required Day 1 scenario: ${title}` });
    }
  }
}

for (const rule of forbiddenPatterns) {
  const fullPath = path.join(root, rule.file);
  if (!fs.existsSync(fullPath)) continue;
  if (rule.pattern.test(read(rule.file))) {
    findings.push({ severity: rule.severity, file: rule.file, issue: rule.issue });
  }
}

const migrationFiles = fs.existsSync(path.join(root, 'supabase', 'migrations'))
  ? fs.readdirSync(path.join(root, 'supabase', 'migrations')).filter(file => /v140|_140_/.test(file))
  : [];
if (migrationFiles.length) {
  findings.push({
    severity: 'medium',
    file: 'supabase/migrations',
    issue: `v14.0 should avoid new migrations unless required; found ${migrationFiles.join(', ')}.`,
  });
}

const packageJson = JSON.parse(read('package.json'));
const expectedScripts = {
  'v140:uat-audit': 'node scripts/v140-uat-audit.mjs',
  'v140:uat-report': 'node scripts/v140-uat-scenario-report.mjs',
  'v140:final-proof': 'node scripts/v140-final-proof.mjs',
  'pilot:v140-uat-execution': 'npm run v140:uat-audit && npm run v140:uat-report && npm run v140:final-proof',
};
for (const [name, command] of Object.entries(expectedScripts)) {
  if (packageJson.scripts?.[name] !== command) {
    findings.push({ severity: 'high', file: 'package.json', issue: `Package script ${name} is missing or does not match expected command.` });
  }
}

const highFindings = findings.filter(finding => finding.severity === 'high').length;
const report = {
  generated_at: new Date().toISOString(),
  status: highFindings === 0 ? 'passed' : 'failed',
  high_findings: highFindings,
  findings_count: findings.length,
  findings,
  day_one_scenarios_expected: 18,
  database_migration_included: migrationFiles.length > 0,
  uat_results_asserted: false,
  note: 'Static controlled-UAT execution pack audit only. It does not claim manual UAT scenarios passed.',
};

fs.writeFileSync(path.join(releaseDir, 'v140-static-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(
  path.join(releaseDir, 'v140-static-audit.md'),
  `# v14.0 Controlled UAT Static Audit\n\nStatus: **${report.status}**\n\nHigh findings: ${highFindings}\n\nFindings: ${findings.length}\n\nManual UAT results asserted: **no**\n\nDatabase migration included: **${report.database_migration_included ? 'yes' : 'no'}**\n`,
);

console.log('v14.0 UAT static audit complete.');
console.log(JSON.stringify({
  status: report.status,
  high_findings: highFindings,
  findings_count: findings.length,
  report: 'release/v140/v140-static-audit.json',
}, null, 2));

if (report.status !== 'passed') process.exit(1);
