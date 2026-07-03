import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const apiPath = path.join(root, 'src/lib/hospitalGovernanceApi.ts');
const pagePath = path.join(root, 'src/pages/HospitalGovernanceCenter.tsx');
const appPath = path.join(root, 'src/App.tsx');
const packagePath = path.join(root, 'package.json');
const reportPath = path.join(root, 'release/patch39/patch39-frontend-proof.json');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

const failures = [];
const api = fs.existsSync(apiPath) ? fs.readFileSync(apiPath, 'utf8') : '';
const page = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, 'utf8') : '';
const app = fs.existsSync(appPath) ? fs.readFileSync(appPath, 'utf8') : '';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

if (!fs.existsSync(apiPath)) failures.push('hospitalGovernanceApi missing');
if (!fs.existsSync(pagePath)) failures.push('HospitalGovernanceCenter missing');
if (!api.includes('invokePrivilegedAction')) failures.push('API does not use authenticated bridge wrapper');
if (api.includes('.rpc(')) failures.push('API uses direct browser RPC');
if (/service[_-]?role/i.test(api + page)) failures.push('service-role wording exposed in frontend');

const requiredViews = [
  'v_patch39_infection_control_register',
  'v_patch39_infection_control_open_actions',
  'v_patch39_quality_indicator_performance',
  'v_patch39_quality_indicator_off_target_register',
  'v_patch39_committee_meeting_register',
  'v_patch39_committee_action_queue',
  'v_patch39_overdue_committee_actions',
  'v_patch39_credentialing_expiry_register',
  'v_patch39_privileging_competency_gap_register',
  'v_patch39_facility_biomedical_safety_register',
  'v_patch39_facility_safety_evidence_gap_register',
  'v_patch39_hospital_governance_work_queue',
  'v_patch39_accreditation_blocker_summary',
  'v_patch39_department_hospital_governance_scorecard',
  'v_patch39_executive_hospital_quality_summary',
];
for (const view of requiredViews) if (!api.includes(view)) failures.push(`API missing ${view}`);

const requiredPageText = [
  'Infection control register',
  'Clinical quality indicator performance',
  'Committee actions',
  'Credentialing expiry register',
  'Facility and biomedical safety register',
  'Accreditation blocker summary',
  'Department hospital governance scorecard',
];
for (const marker of requiredPageText) if (!page.includes(marker)) failures.push(`page missing ${marker}`);

if (!app.includes('HospitalGovernanceCenter')) failures.push('App route/navigation import missing');
if (!app.includes('hospitalGovernancePack')) failures.push('Quality/Safety tab missing');
if (!pkg.scripts['patch39:schema-proof'] || !pkg.scripts['patch39:workflow-proof'] || !pkg.scripts['patch39:frontend-proof'] || !pkg.scripts['patch39:all']) failures.push('package scripts missing');
if (/fake|demo|fallback records|mock/i.test(page)) failures.push('fake/demo/fallback wording introduced in page');
if (/^(<<<<<<<|=======|>>>>>>>)$/m.test(api + page + app)) failures.push('conflict marker found');

const report = {
  patch: 39,
  status: failures.length === 0 ? 'passed' : 'failed',
  checked_at: new Date().toISOString(),
  views_checked: requiredViews.length,
  failures,
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error('Patch 39 frontend proof failed.');
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log('Patch 39 frontend proof passed.');
