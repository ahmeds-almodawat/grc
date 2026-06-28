import fs from 'node:fs';
import path from 'node:path';

const requiredFiles = [
  'src/lib/v130ExecutivePolish.ts',
  'src/components/v130/ExecutivePolishWorkbench.tsx',
  'src/styles/v130-executive-polish.css',
  'release/v130/README.md',
];

const forbiddenPatterns = [
  { pattern: /enter real patient identifier/i, reason: 'Pilot copy must not encourage real patient identifiers.' },
  { pattern: /evidence_items/i, reason: 'Avoid fragile references to non-existent evidence_items table.' },
  { pattern: /supabase\/migrations\/055/i, reason: 'v13 patch intentionally has no DB migration.' },
];

const findings = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    findings.push({ severity: 'high', file, issue: 'Required file missing.' });
  }
}

for (const file of requiredFiles.filter((f) => fs.existsSync(f))) {
  const body = fs.readFileSync(file, 'utf8');
  for (const rule of forbiddenPatterns) {
    if (rule.pattern.test(body)) {
      findings.push({ severity: 'medium', file, issue: rule.reason });
    }
  }
}

const source = fs.existsSync('src/lib/v130ExecutivePolish.ts') ? fs.readFileSync('src/lib/v130ExecutivePolish.ts', 'utf8') : '';
const requiredSignals = [
  'v130WorkbenchCards',
  'v130GuidedUatSteps',
  'v130RoleCoachPrompts',
  'buildV130ExecutiveNarrative',
  'Do not claim full production readiness'
];
for (const signal of requiredSignals) {
  if (!source.includes(signal)) {
    findings.push({ severity: 'high', file: 'src/lib/v130ExecutivePolish.ts', issue: `Missing expected signal: ${signal}` });
  }
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const expectedScript = 'npm run v130:ux-audit && npm run v130:polish-report && npm run v130:guided-uat && npm run v130:final-proof';
if (packageJson.scripts?.['pilot:v130-polish'] !== expectedScript) {
  findings.push({ severity: 'high', file: 'package.json', issue: 'pilot:v130-polish script is not installed. Run node scripts/v130-install-package-scripts.mjs.' });
}

const highFindings = findings.filter((finding) => finding.severity === 'high').length;
const result = {
  generated_at: new Date().toISOString(),
  status: highFindings === 0 ? 'passed' : 'failed',
  high_findings: highFindings,
  findings_count: findings.length,
  findings,
  note: 'Static UX/polish audit only. No database migration is included in v13.0.',
};

fs.mkdirSync('release/v130', { recursive: true });
fs.writeFileSync('release/v130/v130-ux-static-audit.json', `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync('release/v130/v130-ux-static-audit.md', `# v13.0 UX Static Audit\n\nStatus: **${result.status}**\n\nFindings: ${result.findings_count}\n\nHigh findings: ${result.high_findings}\n\nNo database migration is included in v13.0.\n`);

console.log('v13.0 UX static audit complete.');
console.log(JSON.stringify({ status: result.status, findings_count: result.findings_count, report: 'release/v130/v130-ux-static-audit.json' }, null, 2));

if (result.status !== 'passed') process.exit(1);
