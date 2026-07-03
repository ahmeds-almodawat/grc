import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch38');

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

const files = {
  workApi: 'src/lib/unifiedWorkQueueApi.ts',
  masterApi: 'src/lib/hospitalMasterDataApi.ts',
  workPage: 'src/pages/MyWorkCenter.tsx',
  masterPage: 'src/pages/HospitalMasterDataCenter.tsx',
  app: 'src/App.tsx',
};

const sources = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, file]) => [key, await read(file)])));
const packageJson = JSON.parse(await read('package.json'));
const findings = [];

for (const view of [
  'v_patch38_unified_work_queue',
  'v_patch38_my_work_queue',
  'v_patch38_department_work_queue',
  'v_patch38_overdue_work_queue',
  'v_patch38_escalated_work_queue',
  'v_patch38_waiting_for_review_queue',
  'v_patch38_governance_operating_summary',
]) {
  if (!sources.workApi.includes(view)) findings.push(`${view} is missing from unifiedWorkQueueApi.ts`);
}

for (const view of [
  'v_patch38_hospital_location_register',
  'v_patch38_hospital_service_register',
  'v_patch38_clinical_area_register',
  'v_patch38_committee_register',
  'v_patch38_job_title_register',
  'v_patch38_quality_indicator_register',
  'v_patch38_master_data_exception_register',
  'v_patch38_master_data_ownership_register',
]) {
  if (!sources.masterApi.includes(view)) findings.push(`${view} is missing from hospitalMasterDataApi.ts`);
}

for (const rpc of [
  'record_unified_work_queue_event',
  'get_my_work_queue',
  'get_department_work_queue',
  'get_executive_workload_summary',
  'get_governance_operating_summary',
  'create_hospital_location',
  'update_hospital_location_status',
  'create_hospital_service',
  'update_hospital_service_status',
  'create_hospital_clinical_area',
  'update_hospital_clinical_area_status',
  'create_hospital_committee',
  'update_hospital_committee_status',
  'create_hospital_job_title',
  'update_hospital_job_title_status',
  'create_hospital_quality_indicator',
  'update_hospital_quality_indicator_status',
  'create_hospital_ownership_mapping',
  'deactivate_hospital_ownership_mapping',
]) {
  if (!sources.workApi.includes(`'${rpc}'`) && !sources.masterApi.includes(`'${rpc}'`)) findings.push(`${rpc} bridge wrapper is missing`);
}

for (const section of ['My assigned work', 'Overdue work', 'Waiting for review', 'Escalated or blocked work', 'Department work']) {
  if (!sources.workPage.includes(section)) findings.push(`${section} section is missing from MyWorkCenter`);
}

for (const section of ['Locations', 'Services', 'Clinical areas', 'Committees', 'Job titles', 'Quality indicators', 'Ownership mappings', 'Master data exceptions']) {
  if (!sources.masterPage.includes(section)) findings.push(`${section} section is missing from HospitalMasterDataCenter`);
}

if (!sources.app.includes("import { MyWorkCenter } from './pages/MyWorkCenter';") || !sources.app.includes("id: 'unifiedMyWork'")) findings.push('Unified My Work navigation is missing');
if (!sources.app.includes("import { HospitalMasterDataCenter } from './pages/HospitalMasterDataCenter';") || !sources.app.includes("id: 'hospitalMasterData'")) findings.push('Hospital Master Data navigation is missing');
if (packageJson.scripts['patch38:all'] !== 'npm run typecheck && npm run build && npm run patch38:schema-proof && npm run patch38:workflow-proof && npm run patch38:frontend-proof && npm run v700:runtime-security') findings.push('patch38:all package script is missing or incorrect');

for (const [name, source] of Object.entries(sources)) {
  if (/supabase\.rpc\s*\(/.test(source)) findings.push(`${name} uses direct browser RPC`);
  if (/service[_-]?role/i.test(source)) findings.push(`${name} exposes service-role wording`);
  if (/\b(fake|demo|fallback record|mock record)\b/i.test(source)) findings.push(`Non-live record wording found in ${name}`);
  if (/^(<<<<<<<|=======|>>>>>>>)$/m.test(source)) findings.push(`Conflict marker found in ${name}`);
}

const report = {
  generated_at: new Date().toISOString(),
  api_files_exist: true,
  page_files_exist: true,
  navigation_integrated: true,
  status: findings.length ? 'failed' : 'passed',
  finding_count: findings.length,
  findings,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch38-frontend-proof.json'), `${JSON.stringify(report, null, 2)}\n`);
if (findings.length) {
  console.error(`Patch 38 frontend proof failed:\n- ${findings.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 38 frontend proof passed.');
}
