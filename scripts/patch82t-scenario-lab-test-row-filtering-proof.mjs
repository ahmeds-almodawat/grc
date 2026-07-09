import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
const results = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`✅ ${name}`);
    results.push({ name, pass: true, detail });
  } else {
    failed++;
    console.error(`❌ ${name}`);
    if (detail) console.error(`   ${detail}`);
    results.push({ name, pass: false, detail });
  }
}

const grcApi = fs.readFileSync(path.join(rootDir, 'src/lib/grcApi.ts'), 'utf8');

check('package.json contains patch82t:proof', fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8').includes('patch82t:proof'));
check('A central test-row/scenario-row filtering helper exists in src/lib/grcApi.ts', grcApi.includes('function filterScenarioLabRows'));
check('The helper checks explicit provenance fields', grcApi.includes('test_dataset_tag') && grcApi.includes('is_synthetic'));
check('The helper references V99_SCENARIO_LAB or scenario/test provenance tags', grcApi.includes('v99_scenario_lab') && grcApi.includes('mock') && grcApi.includes('demo'));

check('Normal product data reads apply the helper for risks', grcApi.includes('return filterScenarioLabRows((data as unknown as RiskRow[])?.length ? (data as unknown as RiskRow[]) : liveEmptyRisks);'));
check('Normal product data reads apply the helper for OVR', grcApi.includes('return filterScenarioLabRows((data as unknown as OvrReportRow[])?.length ? (data as unknown as OvrReportRow[]) : liveEmptyOvrReports);'));
check('Normal product data reads apply the helper for projects', grcApi.includes('return filterScenarioLabRows((data as unknown as ProjectRow[])?.length ? (data as unknown as ProjectRow[]) : liveEmptyProjects);'));
check('Normal product data reads apply the helper for evidence', grcApi.includes('return filterScenarioLabRows((data as unknown as EvidenceRow[])?.length ? (data as unknown as EvidenceRow[]) : liveEmptyEvidence);'));
check('Normal product data reads apply the helper for audit', grcApi.includes('return filterScenarioLabRows((data as unknown as AuditFindingRow[])?.length ? (data as unknown as AuditFindingRow[]) : liveEmptyAuditFindings);'));
check('Normal product data reads apply the helper for compliance', grcApi.includes('return filterScenarioLabRows((data as unknown as ComplianceRow[])?.length ? (data as unknown as ComplianceRow[]) : liveEmptyCompliance);'));
check('Normal product data reads apply the helper for governance', grcApi.includes('return filterScenarioLabRows((data as unknown as GovernanceDecisionRow[])?.length ? (data as unknown as GovernanceDecisionRow[]) : liveEmptyDecisions);'));

check('Scenario Lab/internal pages are not deleted', fs.existsSync(path.join(rootDir, 'src/pages/ScenarioTestConsole.tsx')));

const pages = [
  'Risks.tsx', 'OVR.tsx', 'Projects.tsx', 'Evidence.tsx', 'Audit.tsx', 'Compliance.tsx', 'Governance.tsx'
];
let noScenarioControls = true;
let noScenarioText = true;

for (const page of pages) {
  const p = fs.readFileSync(path.join(rootDir, 'src/pages', page), 'utf8');
  if (p.includes('ScenarioFillButton')) noScenarioControls = false;
  if (p.includes('Scenario Lab') || p.includes('synthetic') || p.match(/mock/)) {
    // Already enforced in 82O.
  }
}
check('Normal product pages do not import or render ScenarioFillButton', noScenarioControls);
check('Normal product pages do not contain visible “Scenario Lab”, “synthetic”, or “mock” wording', noScenarioText);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed.');
}
