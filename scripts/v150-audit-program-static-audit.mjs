import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v150');
fs.mkdirSync(releaseDir, { recursive: true });

const requiredFiles = [
  'src/pages/Audit.tsx',
  'src/lib/v150AuditProgramModel.ts',
  'src/components/v150/AuditProgramWorkflowMap.tsx',
  'src/components/v150/AuditEngagementChecklist.tsx',
  'src/components/v150/AuditAssuranceCoveragePanel.tsx',
  'src/styles/v150-audit-program.css',
  'scripts/v150-audit-program-static-audit.mjs',
  'scripts/v150-audit-program-report.mjs',
  'scripts/v150-final-proof.mjs',
  'release/v150/README.md',
];

const requiredTerms = [
  'Audit Universe',
  'Annual Audit Plan',
  'Engagement Planning',
  'Workpapers',
  'Evidence Requests',
  'Findings',
  'Management Response',
  'Action Plan Follow-up',
  'Closure',
  'Assurance Reporting',
  'Audit Universe → Annual Audit Plan → Engagement Planning → Workpapers → Evidence Requests → Findings → Management Response → Action Plan Follow-up → Closure → Assurance Reporting',
];

const checks = [];

for (const file of requiredFiles) {
  const exists = fs.existsSync(path.join(root, file));
  checks.push({ id: `file:${file}`, severity: exists ? 'none' : 'critical', status: exists ? 'passed' : 'failed', message: exists ? 'Required file exists.' : 'Required file is missing.' });
}

const auditSourceFiles = [
  'src/pages/Audit.tsx',
  'src/lib/v150AuditProgramModel.ts',
  'src/components/v150/AuditProgramWorkflowMap.tsx',
  'src/components/v150/AuditEngagementChecklist.tsx',
  'src/components/v150/AuditAssuranceCoveragePanel.tsx',
].filter((file) => fs.existsSync(path.join(root, file)));

const combined = auditSourceFiles.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

for (const term of requiredTerms) {
  const exists = combined.includes(term);
  checks.push({ id: `term:${term}`, severity: exists ? 'none' : 'high', status: exists ? 'passed' : 'failed', message: exists ? `Found ${term}.` : `Missing ${term}.` });
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const requiredScripts = [
  'v150:audit-program-audit',
  'v150:audit-program-report',
  'v150:final-proof',
  'pilot:v150-audit-program',
];

for (const script of requiredScripts) {
  const exists = Boolean(packageJson.scripts?.[script]);
  checks.push({ id: `script:${script}`, severity: exists ? 'none' : 'high', status: exists ? 'passed' : 'failed', message: exists ? 'Package script is registered.' : 'Package script is missing.' });
}

const critical = checks.filter((check) => check.status === 'failed' && check.severity === 'critical').length;
const high = checks.filter((check) => check.status === 'failed' && check.severity === 'high').length;
const medium = checks.filter((check) => check.status === 'failed' && check.severity === 'medium').length;
const status = critical === 0 && high === 0 ? 'passed' : 'failed';

const report = {
  version: 'v15.0',
  name: 'Audit Program Execution Pack',
  status,
  generated_at: new Date().toISOString(),
  professional_workflow_chain: 'Audit Universe → Annual Audit Plan → Engagement Planning → Workpapers → Evidence Requests → Findings → Management Response → Action Plan Follow-up → Closure → Assurance Reporting',
  summary: { critical, high, medium, passed: checks.filter((check) => check.status === 'passed').length, total: checks.length },
  checks,
  scope: {
    database_migration: 'not required',
    data_policy: 'synthetic/static workflow scaffolding only',
    approval_files_touched: false,
    proof_all_logic_touched: false,
  },
};

fs.writeFileSync(path.join(releaseDir, 'v150-static-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log('v15.0 audit program static audit complete.');
console.log({ status, critical, high, medium });

if (status !== 'passed') {
  process.exit(1);
}
