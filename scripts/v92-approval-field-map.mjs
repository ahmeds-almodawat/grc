import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('release', 'v92');
fs.mkdirSync(outDir, { recursive: true });

const generatedAt = new Date().toISOString();
const approvalFiles = [
  'release/v674/approvals/pilot-signoff.json',
  'release/v674/approvals/ovr-confidentiality-confirmation.json'
];

function readJson(file) {
  try {
    return { exists: true, data: JSON.parse(fs.readFileSync(file, 'utf8')), error: null };
  } catch (error) {
    return { exists: fs.existsSync(file), data: null, error: error.message };
  }
}

function get(obj, dotted) {
  return dotted.split('.').reduce((acc, key) => acc && Object.prototype.hasOwnProperty.call(acc, key) ? acc[key] : undefined, obj);
}

const requirements = [
  ['pilot-signoff.json', 'management_admin.name', 'Real Management/Admin approver name'],
  ['pilot-signoff.json', 'management_admin.role', 'Real Management/Admin role'],
  ['pilot-signoff.json', 'management_admin.date', 'Real approval date, YYYY-MM-DD, not future'],
  ['pilot-signoff.json', 'management_admin.decision', 'approved / approve / go / accepted'],
  ['pilot-signoff.json', 'management_admin.scope', 'Controlled pilot scope'],
  ['pilot-signoff.json', 'it.name', 'Real IT approver name'],
  ['pilot-signoff.json', 'it.role', 'Real IT role'],
  ['pilot-signoff.json', 'it.date', 'Real approval date, YYYY-MM-DD, not future'],
  ['pilot-signoff.json', 'it.decision', 'approved / approve / go / accepted'],
  ['pilot-signoff.json', 'it.scope', 'Controlled pilot scope'],
  ['pilot-signoff.json', 'quality.name', 'Real Quality approver name'],
  ['pilot-signoff.json', 'quality.role', 'Real Quality role'],
  ['pilot-signoff.json', 'quality.date', 'Real approval date, YYYY-MM-DD, not future'],
  ['pilot-signoff.json', 'quality.decision', 'approved / approve / go / accepted'],
  ['pilot-signoff.json', 'quality.scope', 'Controlled pilot scope'],
  ['pilot-signoff.json', 'pilot_scope', 'Controlled internal pilot scope'],
  ['pilot-signoff.json', 'maximum_pilot_users', 'Integer from 1 to 15'],
  ['pilot-signoff.json', 'reviewed_evidence.local_staging_sql_proofs_reviewed', 'Must be true'],
  ['pilot-signoff.json', 'reviewed_evidence.restore_integrity_dryrun_reviewed', 'Must be true'],
  ['pilot-signoff.json', 'reviewed_evidence.security_definer_audit_reviewed', 'Must be true'],
  ['ovr-confidentiality-confirmation.json', 'it_reviewer.name', 'Real IT reviewer name'],
  ['ovr-confidentiality-confirmation.json', 'it_reviewer.role', 'Real IT reviewer role'],
  ['ovr-confidentiality-confirmation.json', 'it_reviewer.date', 'Real confirmation date, YYYY-MM-DD, not future'],
  ['ovr-confidentiality-confirmation.json', 'it_reviewer.decision', 'confirmed / approved / accepted'],
  ['ovr-confidentiality-confirmation.json', 'it_reviewer.scope', 'Controlled pilot scope'],
  ['ovr-confidentiality-confirmation.json', 'quality_reviewer.name', 'Real Quality reviewer name'],
  ['ovr-confidentiality-confirmation.json', 'quality_reviewer.role', 'Real Quality reviewer role'],
  ['ovr-confidentiality-confirmation.json', 'quality_reviewer.date', 'Real confirmation date, YYYY-MM-DD, not future'],
  ['ovr-confidentiality-confirmation.json', 'quality_reviewer.decision', 'confirmed / approved / accepted'],
  ['ovr-confidentiality-confirmation.json', 'quality_reviewer.scope', 'Controlled pilot scope'],
  ['ovr-confidentiality-confirmation.json', 'statements.no_real_patient_identifiers', 'Must be true'],
  ['ovr-confidentiality-confirmation.json', 'statements.no_confidential_ovr_details', 'Must be true'],
  ['ovr-confidentiality-confirmation.json', 'statements.controlled_pilot_users_only', 'Must be true'],
  ['ovr-confidentiality-confirmation.json', 'statements.local_staging_proof_reviewed', 'Must be true'],
  ['ovr-confidentiality-confirmation.json', 'scope', 'Controlled internal pilot scope']
];

const dataByFile = new Map();
for (const file of approvalFiles) {
  dataByFile.set(path.basename(file), readJson(file));
}

const rows = [];
let presentCount = 0;
for (const [file, field, requirement] of requirements) {
  const entry = dataByFile.get(file);
  const value = entry && entry.data ? get(entry.data, field) : undefined;
  const present = value !== undefined && value !== null && String(value).trim() !== '';
  if (present) presentCount += 1;
  rows.push('| ' + file + ' | ' + field + ' | ' + requirement + ' | ' + (present ? 'Present' : 'Missing or placeholder') + ' |');
}

const md = [
  '# v9.2 Approval Field Map',
  '',
  'Generated: ' + generatedAt,
  '',
  '## Status',
  '',
  '| Item | Value |',
  '| --- | --- |',
  '| Required fields | ' + requirements.length + ' |',
  '| Fields with visible values | ' + presentCount + ' |',
  '| Production ready | No |',
  '| Approval gate bypassed | No |',
  '',
  '## Field map',
  '',
  '| File | Field | Requirement | Current visible status |',
  '| --- | --- | --- | --- |',
  rows.join('\n'),
  '',
  '## Reminder',
  '',
  'This map is not the authority for final acceptance. The authoritative validator remains npm run v674:signoff-check.',
  ''
].join('\n');

fs.writeFileSync(path.join(outDir, 'approval-field-map.md'), md);
console.log('v9.2 approval field map generated.');
console.log(JSON.stringify({ status: 'technical_ready_pending_human_approval', production_ready: false, required_fields: requirements.length, report: 'release/v92/approval-field-map.md' }, null, 2));
