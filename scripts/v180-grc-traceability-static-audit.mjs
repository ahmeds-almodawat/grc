import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v180');
fs.mkdirSync(releaseDir, { recursive: true });

const requiredFiles = [
  'src/lib/v180GrcTraceabilityModel.ts',
  'src/components/v180/GrcTraceabilityMap.tsx',
  'src/components/v180/AssuranceMapPanel.tsx',
  'src/components/v180/TraceabilityGapPanel.tsx',
  'src/styles/v180-grc-traceability.css',
  'scripts/v180-grc-traceability-static-audit.mjs',
  'scripts/v180-grc-traceability-report.mjs',
  'scripts/v180-final-proof.mjs',
];

const checks = [];
function check(id, severity, passed, detail) {
  checks.push({ id, severity, passed, detail });
}

for (const file of requiredFiles) {
  check(`file:${file}`, 'critical', fs.existsSync(path.join(root, file)), `${file} must exist`);
}

const modelPath = path.join(root, 'src/lib/v180GrcTraceabilityModel.ts');
const model = fs.existsSync(modelPath) ? fs.readFileSync(modelPath, 'utf8') : '';
check(
  'chain:exact-professional-traceability',
  'critical',
  model.includes('Risk → Control → Test → Evidence → Issue → CAPA → Audit → Compliance → Board Reporting'),
  'Professional traceability chain must be explicit.',
);
check('model:assurance-map', 'high', model.includes('v180AssuranceMap'), 'Assurance map model must exist.');
check('model:traceability-gaps', 'high', model.includes('v180TraceabilityGaps'), 'Traceability gap model must exist.');
check('model:three-lines', 'medium', model.includes('firstLine') && model.includes('secondLine') && model.includes('thirdLine'), 'Three-line assurance fields must exist.');

const componentFiles = [
  'src/components/v180/GrcTraceabilityMap.tsx',
  'src/components/v180/AssuranceMapPanel.tsx',
  'src/components/v180/TraceabilityGapPanel.tsx',
];
for (const file of componentFiles) {
  const content = fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : '';
  check(`component:${file}:css`, 'medium', content.includes("../../styles/v180-grc-traceability.css"), `${file} should import v180 CSS.`);
}

const governancePath = path.join(root, 'src/pages/Governance.tsx');
const evidencePath = path.join(root, 'src/pages/Evidence.tsx');
const executivePath = path.join(root, 'src/pages/ExecutiveCommandCenter.tsx');
const governance = fs.existsSync(governancePath) ? fs.readFileSync(governancePath, 'utf8') : '';
const evidence = fs.existsSync(evidencePath) ? fs.readFileSync(evidencePath, 'utf8') : '';
const executive = fs.existsSync(executivePath) ? fs.readFileSync(executivePath, 'utf8') : '';

check('integration:governance', 'high', governance.includes('GrcTraceabilityMap') && governance.includes('AssuranceMapPanel'), 'Governance page should show traceability and assurance map panels.');
check('integration:evidence', 'medium', evidence.includes('GrcTraceabilityMap') || evidence.includes('TraceabilityGapPanel'), 'Evidence page should show evidence closure traceability context.');
check('integration:executive', 'medium', executive.includes('AssuranceMapPanel') || executive.includes('TraceabilityGapPanel'), 'Executive command center should include assurance/gap context.');

const critical = checks.filter(item => !item.passed && item.severity === 'critical').length;
const high = checks.filter(item => !item.passed && item.severity === 'high').length;
const medium = checks.filter(item => !item.passed && item.severity === 'medium').length;
const status = critical === 0 && high === 0 ? 'passed' : 'failed';

const result = {
  version: 'v18.0',
  name: 'GRC Traceability + Assurance Map Pack',
  status,
  generated_at: new Date().toISOString(),
  summary: { critical, high, medium, total_checks: checks.length },
  checks,
};

fs.writeFileSync(path.join(releaseDir, 'v180-static-audit.json'), JSON.stringify(result, null, 2));
console.log('v18.0 GRC traceability static audit complete.');
console.log({ status, critical, high, medium });
if (status !== 'passed') process.exit(1);
