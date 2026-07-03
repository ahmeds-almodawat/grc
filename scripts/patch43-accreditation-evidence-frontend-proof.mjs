import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, 'release/patch43');
const outPath = path.join(outDir, 'patch43-frontend-proof.json');

const files = {
  api: 'src/lib/accreditationAssuranceApi.ts',
  page: 'src/pages/AccreditationWarRoomCenter.tsx',
  app: 'src/App.tsx',
  queueApi: 'src/lib/unifiedWorkQueueApi.ts',
  myWork: 'src/pages/MyWorkCenter.tsx',
  packageJson: 'package.json',
};

function read(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
}

const content = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));
const combined = Object.values(content).join('\n');

const requiredApiMethods = [
  'getAccreditationWarRoom',
  'getClauseReadinessRegister',
  'getDepartmentReadinessRegister',
  'getEvidenceGapRegister',
  'getEvidenceGateFailureRegister',
  'getEvidenceWaiverRegister',
  'getMockSurveyFindingRegister',
  'getIncidentEvidenceChain',
  'getAuditEvidenceChain',
  'getCapaEvidenceChain',
  'getTrainingDocumentEvidenceChain',
  'getSurveyBlockerSummary',
  'getExecutiveSurveyReadinessSummary',
  'getQueueEvidenceGateOverlay',
  'evaluateEvidenceGate',
  'requestEvidenceGateWaiver',
  'approveEvidenceGateWaiver',
  'rejectEvidenceGateWaiver',
  'revokeEvidenceGateWaiver',
];

const requiredSections = [
  'Clause Readiness Register',
  'Department Readiness Register',
  'Evidence Gate Failure Register',
  'Evidence Gap Register',
  'Evidence Waiver Register',
  'Survey Blocker Summary',
  'Mock Survey Finding Register',
  'Queue Evidence Gate Overlay',
  'Incident / OVR Evidence Chain',
  'Audit Evidence Chain',
  'CAPA Evidence Chain',
  'Training and Document Evidence Chain',
];

const checks = [
  ...Object.values(files).map(file => ({ name: `${file} exists`, passed: fs.existsSync(path.join(repoRoot, file)) })),
  ...requiredApiMethods.map(method => ({ name: `API method present: ${method}`, passed: content.api.includes(method) })),
  ...requiredSections.map(section => ({ name: `War room section present: ${section}`, passed: content.page.includes(section) })),
  { name: 'Quality/Safety navigation tab exists', passed: content.app.includes('accreditationWarRoom') && content.app.includes('Accreditation War Room') },
  { name: 'Patch 42 queue overlay API exists', passed: content.queueApi.includes('fetchEvidenceGateOverlay') && content.queueApi.includes('v_patch43_queue_evidence_gate_overlay') },
  { name: 'My Work renders evidence gate overlay', passed: content.myWork.includes('Evidence Gate Overlay') && content.myWork.includes('EvidenceGateOverlayTable') },
  { name: 'package scripts exist', passed: ['patch43:schema-proof','patch43:workflow-proof','patch43:frontend-proof','patch43:all'].every(script => content.packageJson.includes(script)) },
  { name: 'no frontend service-role exposure', passed: !/service[_-]?role/i.test(`${content.api}\n${content.page}\n${content.queueApi}\n${content.myWork}`) },
  { name: 'no conflict markers', passed: !/^(<<<<<<<|=======|>>>>>>>)$/m.test(combined) },
  { name: 'no seeded UI records introduced', passed: !/\b(sampleRows|seedRows|staticRows)\b/.test(`${content.page}\n${content.myWork}`) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '43',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  check_count: checks.length,
  failed_count: failed.length,
  failed,
  files,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
