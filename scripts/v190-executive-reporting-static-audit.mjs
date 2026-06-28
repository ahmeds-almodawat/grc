import fs from 'node:fs';

const requiredFiles = [
  'src/lib/v190ExecutiveGrcReportingModel.ts',
  'src/components/v190/ExecutiveGrcScorecard.tsx',
  'src/components/v190/BoardReportingPackPanel.tsx',
  'src/components/v190/AutomationAlertPanel.tsx',
  'src/styles/v190-executive-reporting.css',
  'scripts/v190-executive-reporting-report.mjs',
  'scripts/v190-final-proof.mjs',
];

const requiredStrings = [
  ['src/lib/v190ExecutiveGrcReportingModel.ts', 'Risk → KRI → Control → Evidence → Issue/CAPA → Audit/Compliance → Committee Action → Board Pack'],
  ['src/lib/v190ExecutiveGrcReportingModel.ts', 'KRI breach alert'],
  ['src/lib/v190ExecutiveGrcReportingModel.ts', 'Board pack readiness alert'],
  ['src/components/v190/ExecutiveGrcScorecard.tsx', 'Executive GRC scorecard'],
  ['src/components/v190/BoardReportingPackPanel.tsx', 'Board-ready reporting structure'],
  ['src/components/v190/AutomationAlertPanel.tsx', 'Executive escalation and aging alerts'],
];

const packageScripts = [
  'v190:executive-reporting-audit',
  'v190:executive-reporting-report',
  'v190:final-proof',
  'pilot:v190-executive-reporting',
];

const findings = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    findings.push({ severity: 'critical', file, message: 'Required v19 file missing.' });
  }
}

for (const [file, text] of requiredStrings) {
  const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (!content.includes(text)) {
    findings.push({ severity: 'high', file, message: `Missing required text: ${text}` });
  }
}

if (fs.existsSync('package.json')) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  for (const script of packageScripts) {
    if (!pkg.scripts?.[script]) {
      findings.push({ severity: 'high', file: 'package.json', message: `Missing script ${script}` });
    }
  }
} else {
  findings.push({ severity: 'critical', file: 'package.json', message: 'package.json missing.' });
}

const optionalPageChecks = [
  ['src/pages/ExecutiveCommandCenter.tsx', 'ExecutiveGrcScorecard'],
  ['src/pages/BoardPackCenter.tsx', 'BoardReportingPackPanel'],
  ['src/pages/CommitteeActionAutomationCenter.tsx', 'AutomationAlertPanel'],
];

for (const [file, text] of optionalPageChecks) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes(text)) {
      findings.push({ severity: 'medium', file, message: `v19 panel not injected: ${text}` });
    }
  }
}

const summary = {
  generated_at: new Date().toISOString(),
  pack: 'v19.0 Executive Reporting + Automation Pack',
  status: findings.some(f => f.severity === 'critical' || f.severity === 'high') ? 'failed' : 'passed',
  critical: findings.filter(f => f.severity === 'critical').length,
  high: findings.filter(f => f.severity === 'high').length,
  medium: findings.filter(f => f.severity === 'medium').length,
  findings,
};

fs.mkdirSync('release/v190', { recursive: true });
fs.writeFileSync('release/v190/v190-static-audit.json', `${JSON.stringify(summary, null, 2)}\n`);

console.log('v19.0 executive reporting static audit complete.');
console.log({ status: summary.status, critical: summary.critical, high: summary.high, medium: summary.medium });

if (summary.status !== 'passed') process.exit(1);
