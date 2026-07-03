import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/100_patch39_hospital_quality_infection_governance_pack.sql');
const reportPath = path.join(root, 'release/patch39/patch39-workflow-proof.json');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = sql.toLowerCase();
const failures = [];

const serviceRoleFunctions = [
  'create_infection_control_surveillance_event(uuid, jsonb)',
  'update_infection_control_event_status(uuid, text, uuid)',
  'close_infection_control_event(uuid, uuid)',
  'record_clinical_quality_indicator_result(uuid, jsonb)',
  'update_clinical_quality_indicator_status(uuid, text, uuid)',
  'create_hospital_committee_meeting(uuid, jsonb)',
  'update_committee_meeting_status(uuid, text, uuid)',
  'create_hospital_committee_action(uuid, jsonb)',
  'update_committee_action_status(uuid, text, uuid)',
  'complete_committee_action(uuid, uuid)',
  'create_clinical_credentialing_record(uuid, jsonb)',
  'update_credentialing_record_status(uuid, text, uuid)',
  'mark_credentialing_record_reviewed(uuid, uuid)',
  'create_facility_biomedical_safety_evidence(uuid, jsonb)',
  'update_facility_biomedical_safety_status(uuid, text, uuid)',
  'mark_facility_biomedical_safety_checked(uuid, date, date, uuid)',
  'link_hospital_governance_item_to_evidence_bridge(text, uuid, uuid, uuid)',
  'link_hospital_governance_item_to_accreditation_clause(text, uuid, uuid, uuid)',
  'record_hospital_governance_event(text, uuid, text, text, uuid)',
  'get_hospital_quality_summary(uuid)',
  'get_department_hospital_governance_scorecard(uuid, uuid)',
];

if (!lower.includes('auth.role() <> \'service_role\'')) failures.push('service role guard missing');
if (!lower.includes('patch39_actor_has_hospital_governance_authority')) failures.push('actor authority helper missing');
if (!lower.includes('set search_path = public, pg_temp')) failures.push('safe function search_path missing');
if (!lower.includes('security definer')) failures.push('security definer functions missing');
if (!lower.includes('hospital_governance_events')) failures.push('event table missing');
if (!lower.includes('record_hospital_governance_event')) failures.push('event logging function missing');

for (const signature of serviceRoleFunctions) {
  if (!lower.includes(`revoke all on function public.${signature} from public, anon, authenticated`)) failures.push(`missing revoke for ${signature}`);
  if (!lower.includes(`grant execute on function public.${signature} to service_role`)) failures.push(`missing service_role grant for ${signature}`);
}

const broadGrantRegex = /grant\s+execute\s+on\s+function\s+public\.[^(]+\([^)]*\)\s+to\s+(public|anon|authenticated)\b/i;
if (broadGrantRegex.test(sql)) failures.push('broad execute grant introduced');

const apiPath = path.join(root, 'src/lib/hospitalGovernanceApi.ts');
const api = fs.existsSync(apiPath) ? fs.readFileSync(apiPath, 'utf8') : '';
if (api.includes('.rpc(')) failures.push('direct browser rpc found in hospitalGovernanceApi');
if (!api.includes('invokePrivilegedAction')) failures.push('authenticated edge bridge wrapper missing');
if (/service[_-]?role/i.test(api)) failures.push('service-role wording exposed in frontend API');

let runtimeSecurity = 'not_run';
try {
  execFileSync(process.execPath, ['scripts/v700-runtime-security-bridge-audit.mjs'], { cwd: root, stdio: 'pipe' });
  runtimeSecurity = 'passed';
} catch (error) {
  runtimeSecurity = 'failed';
  failures.push('v700 runtime security failed');
}

const report = {
  patch: 39,
  status: failures.length === 0 ? 'passed' : 'failed',
  checked_at: new Date().toISOString(),
  runtime_security: runtimeSecurity,
  service_role_functions_checked: serviceRoleFunctions.length,
  failures,
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error('Patch 39 workflow proof failed.');
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log('Patch 39 workflow proof passed.');
