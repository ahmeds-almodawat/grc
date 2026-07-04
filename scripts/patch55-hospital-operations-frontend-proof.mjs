import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pageRel = 'src/pages/ProductionReadinessCenter.tsx';
const apiRel = 'src/lib/productionReadinessApi.ts';
const packageRel = 'package.json';
const reportPath = path.join(root, 'release', 'patch55', 'patch55-frontend-proof.json');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

const page = read(pageRel);
const api = read(apiRel);
const pkg = JSON.parse(read(packageRel));
const hospitalSectionStart = page.indexOf('hospitalOperationsTitle');
const hospitalSectionEnd = page.indexOf('{/* Signoff Register */}', hospitalSectionStart);
const hospitalSection = hospitalSectionStart >= 0 && hospitalSectionEnd > hospitalSectionStart
  ? page.slice(hospitalSectionStart, hospitalSectionEnd)
  : '';

const requiredApiFunctions = [
  'getHospitalOperationsReadinessOverlay',
  'getHospitalOperationsLaunchBlockers',
  'getHospitalDepartmentLaunchPacks',
  'getHospitalLaunchChecklistItems',
  'getHospitalSupportReadinessRecords',
  'getHospitalPolicyAttestationReadiness',
  'getHospitalAdoptionReadinessReviews',
];

const requiredViews = [
  'v_patch55_production_readiness_hospital_operations_overlay',
  'v_patch55_department_launch_blocker_register',
  'v_patch55_department_launch_pack_register',
  'v_patch55_department_launch_checklist_register',
  'v_patch55_department_support_readiness_register',
  'v_patch55_policy_attestation_readiness_register',
  'v_patch55_department_adoption_readiness_register',
];

const requiredPageTerms = [
  'hospitalOperationsTitle',
  'hospitalBlockersTitle',
  'departmentLaunchRegisterTitle',
  'launchChecklistTitle',
  'supportReadinessTitle',
  'policyAttestationTitle',
  'adoptionReadinessTitle',
  'missingOwners',
  'supportBlockers',
  'policyGaps',
  'trainingIncomplete',
  'failedWorkflowAttempts',
];

const technicalVisibleTerms = [
  'RPC',
  'edge bridge',
  'schema proof',
  'unknown_requires_review',
];

function conflictMarkers(source) {
  return /^(<<<<<<<|=======|>>>>>>>)$/m.test(source);
}

const checks = [
  { name: 'ProductionReadinessCenter exists', passed: fs.existsSync(path.join(root, pageRel)) },
  { name: 'production readiness API exists', passed: fs.existsSync(path.join(root, apiRel)) },
  ...requiredApiFunctions.map(name => ({ name: `api function present: ${name}`, passed: api.includes(`function ${name}`) })),
  ...requiredViews.map(name => ({ name: `api view reference present: ${name}`, passed: api.includes(name) })),
  ...requiredPageTerms.map(name => ({ name: `page displays hospital operations term: ${name}`, passed: page.includes(name) })),
  { name: 'package patch55:schema-proof exists', passed: pkg.scripts?.['patch55:schema-proof'] === 'node scripts/patch55-hospital-operations-schema-proof.mjs' },
  { name: 'package patch55:workflow-proof exists', passed: pkg.scripts?.['patch55:workflow-proof'] === 'node scripts/patch55-hospital-operations-workflow-proof.mjs' },
  { name: 'package patch55:frontend-proof exists', passed: pkg.scripts?.['patch55:frontend-proof'] === 'node scripts/patch55-hospital-operations-frontend-proof.mjs' },
  { name: 'package patch55:all chains patch54 and runtime security', passed: (pkg.scripts?.['patch55:all'] || '').includes('patch54:all') && (pkg.scripts?.['patch55:all'] || '').includes('v700:runtime-security') },
  { name: 'no conflict markers in patched frontend files', passed: !conflictMarkers(page) && !conflictMarkers(api) },
  { name: 'no service-role frontend exposure introduced in Patch 55 section', passed: !/service[_-]?role/i.test(hospitalSection) },
  { name: 'normal Patch 55 surface avoids technical proof wording', passed: !technicalVisibleTerms.some(term => hospitalSection.includes(term)) },
  { name: 'no fake/demo/fallback pilot records in Patch 55 frontend', passed: !/\b(fake|demo|fallback)\s+(record|pilot|data)\b/i.test(hospitalSection + api) },
];

const report = {
  generated_at: new Date().toISOString(),
  strict_passed: checks.every(check => check.passed),
  check_count: checks.length,
  failed_count: checks.filter(check => !check.passed).length,
  failed: checks.filter(check => !check.passed),
  checks,
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.strict_passed) process.exit(1);
