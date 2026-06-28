import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v140');
fs.mkdirSync(releaseDir, { recursive: true });

const requiredFiles = [
  'src/lib/v140ProfessionalGrcModel.ts',
  'src/components/v140/ProfessionalGrcWorkflowMap.tsx',
  'src/components/v140/ProfessionalGrcMaturityPanel.tsx',
  'src/styles/v140-professional-grc.css',
  'src/pages/Risks.tsx',
  'src/pages/Compliance.tsx',
  'src/pages/Audit.tsx',
  'src/pages/Governance.tsx',
];

const requiredTerms = [
  'Enterprise Risk Register',
  'Risk Assessment and Scoring',
  'Risk Appetite / KRI Monitoring',
  'Controls Library',
  'Control Testing',
  'Evidence Management',
  'CAPA / Corrective Action Management',
  'Audit Universe',
  'Audit Planning',
  'Audit Engagements / Workpapers',
  'Audit Findings and Follow-up',
  'Compliance Obligations Register',
  'Policy and Document Control',
  'Issue / Finding Register',
  'Executive GRC Dashboard',
  'Risk → Control → Test → Evidence → Issue → CAPA → Audit / Compliance Reporting',
];

const pageRequirements = {
  'src/pages/Risks.tsx': ['ProfessionalGrcMaturityPanel', 'ProfessionalGrcWorkflowMap', 'Enterprise risk register'],
  'src/pages/Compliance.tsx': ['ProfessionalGrcMaturityPanel', 'ProfessionalGrcWorkflowMap', 'Compliance obligations register'],
  'src/pages/Audit.tsx': ['ProfessionalGrcMaturityPanel', 'ProfessionalGrcWorkflowMap', 'Audit universe'],
  'src/pages/Governance.tsx': ['ProfessionalGrcMaturityPanel', 'ProfessionalGrcWorkflowMap', 'Executive GRC dashboard'],
};

const findings = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    findings.push({ severity: 'critical', file, message: 'Required v14 file is missing.' });
  }
}

const modelPath = path.join(root, 'src/lib/v140ProfessionalGrcModel.ts');
const model = fs.existsSync(modelPath) ? fs.readFileSync(modelPath, 'utf8') : '';
for (const term of requiredTerms) {
  if (!model.includes(term)) {
    findings.push({ severity: 'high', file: 'src/lib/v140ProfessionalGrcModel.ts', message: `Missing professional module term: ${term}` });
  }
}

for (const [file, terms] of Object.entries(pageRequirements)) {
  const filePath = path.join(root, file);
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  for (const term of terms) {
    if (!content.includes(term)) {
      findings.push({ severity: 'medium', file, message: `Missing page integration marker: ${term}` });
    }
  }
}

const packagePath = path.join(root, 'package.json');
const packageJson = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, 'utf8')) : { scripts: {} };
for (const script of ['v140:grc-audit', 'v140:grc-report', 'v140:final-proof', 'pilot:v140-professional-grc']) {
  if (!packageJson.scripts?.[script]) {
    findings.push({ severity: 'critical', file: 'package.json', message: `Missing package script: ${script}` });
  }
}

const workflowPath = path.join(root, '.github/workflows/ci.yml');
const workflow = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, 'utf8') : '';
if (!workflow.includes('npm run pilot:v140-professional-grc')) {
  findings.push({ severity: 'medium', file: '.github/workflows/ci.yml', message: 'CI does not yet run v14 professional GRC proof.' });
}

const report = {
  generated_at: new Date().toISOString(),
  release: 'v14.0 Professional GRC Workflow Maturity Pack',
  status: findings.some(f => ['critical', 'high'].includes(f.severity)) ? 'failed' : 'passed',
  critical_count: findings.filter(f => f.severity === 'critical').length,
  high_count: findings.filter(f => f.severity === 'high').length,
  medium_count: findings.filter(f => f.severity === 'medium').length,
  findings,
  note: 'Static proof only. This pack adds workflow maturity surfaces and does not assert broad production readiness.',
};

fs.writeFileSync(path.join(releaseDir, 'v140-static-audit.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(releaseDir, 'v140-static-audit.md'), [
  '# v14.0 Professional GRC Static Audit',
  '',
  `- Generated: ${report.generated_at}`,
  `- Status: **${report.status}**`,
  `- Critical: ${report.critical_count}`,
  `- High: ${report.high_count}`,
  `- Medium: ${report.medium_count}`,
  '',
  '## Findings',
  ...(findings.length ? findings.map(f => `- ${f.severity.toUpperCase()} ${f.file}: ${f.message}`) : ['- None']),
  '',
].join('\n'));

console.log('v14.0 professional GRC static audit complete.');
console.log({ status: report.status, critical: report.critical_count, high: report.high_count, medium: report.medium_count });

if (report.status !== 'passed') {
  process.exitCode = 1;
}
