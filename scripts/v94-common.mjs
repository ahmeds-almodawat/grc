import fs from 'node:fs';
import path from 'node:path';

export const status = 'technical_ready_pending_human_approval';
export const productionReady = false;
export const outDir = path.join('release', 'v94');

export function ensureOutDir() {
  fs.mkdirSync(outDir, { recursive: true });
}

export function writeText(fileName, content) {
  ensureOutDir();
  fs.writeFileSync(path.join(outDir, fileName), content);
}

export function writeJson(fileName, value) {
  ensureOutDir();
  fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(value, null, 2) + '\n');
}

export function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { exists: false, data: null, error: 'missing' };
    return { exists: true, data: JSON.parse(fs.readFileSync(filePath, 'utf8')), error: null };
  } catch (error) {
    return { exists: true, data: null, error: String(error.message || error) };
  }
}

export function get(obj, dotted) {
  return dotted.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), obj);
}

export function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

export function isPlaceholder(value) {
  if (isBlank(value)) return true;
  const lowered = String(value).trim().toLowerCase();
  return ['tbd', 'todo', 'placeholder', 'name', 'role', 'pending', 'example', 'n/a'].includes(lowered) || lowered.includes('placeholder');
}

export function validPastOrTodayDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const input = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(input.getTime())) return false;
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return input.getTime() <= todayUtc.getTime();
}

export function controlledScope(value) {
  if (isBlank(value)) return false;
  const text = String(value).toLowerCase();
  return text.includes('controlled') && text.includes('pilot') && text.includes('internal');
}

export function maxPilotUsersValid(value) {
  return Number.isInteger(value) && value >= 1 && value <= 15;
}

export function boolTrue(value) {
  return value === true;
}

const signoffFields = [
  ['pilot-signoff', 'management_admin.name', 'Real Management/Admin name', 'person'],
  ['pilot-signoff', 'management_admin.role', 'Real Management/Admin role', 'role'],
  ['pilot-signoff', 'management_admin.date', 'Management/Admin approval date, YYYY-MM-DD, not future', 'date'],
  ['pilot-signoff', 'management_admin.decision', 'Management/Admin decision: approved/approve/go/accepted', 'pilotDecision'],
  ['pilot-signoff', 'management_admin.scope', 'Management/Admin controlled internal pilot scope', 'scope'],
  ['pilot-signoff', 'it.name', 'Real IT approver name', 'person'],
  ['pilot-signoff', 'it.role', 'Real IT approver role', 'role'],
  ['pilot-signoff', 'it.date', 'IT approval date, YYYY-MM-DD, not future', 'date'],
  ['pilot-signoff', 'it.decision', 'IT decision: approved/approve/go/accepted', 'pilotDecision'],
  ['pilot-signoff', 'it.scope', 'IT controlled internal pilot scope', 'scope'],
  ['pilot-signoff', 'quality.name', 'Real Quality approver name', 'person'],
  ['pilot-signoff', 'quality.role', 'Real Quality approver role', 'role'],
  ['pilot-signoff', 'quality.date', 'Quality approval date, YYYY-MM-DD, not future', 'date'],
  ['pilot-signoff', 'quality.decision', 'Quality decision: approved/approve/go/accepted', 'pilotDecision'],
  ['pilot-signoff', 'quality.scope', 'Quality controlled internal pilot scope', 'scope'],
  ['pilot-signoff', 'pilot_scope', 'Overall controlled internal pilot scope', 'scope'],
  ['pilot-signoff', 'maximum_pilot_users', 'Maximum pilot users from 1 to 15', 'maxUsers'],
  ['pilot-signoff', 'reviewed_evidence.local_staging_sql_proofs_reviewed', 'Local staging SQL proofs reviewed', 'true'],
  ['pilot-signoff', 'reviewed_evidence.restore_integrity_dryrun_reviewed', 'Restore integrity dry-run reviewed', 'true'],
  ['pilot-signoff', 'reviewed_evidence.security_definer_audit_reviewed', 'Security definer audit reviewed', 'true'],
  ['confidentiality', 'it_reviewer.name', 'Real IT confidentiality reviewer name', 'person'],
  ['confidentiality', 'it_reviewer.role', 'Real IT confidentiality reviewer role', 'role'],
  ['confidentiality', 'it_reviewer.date', 'IT confidentiality review date, YYYY-MM-DD, not future', 'date'],
  ['confidentiality', 'it_reviewer.decision', 'IT confidentiality decision: confirmed/approved/accepted', 'confDecision'],
  ['confidentiality', 'it_reviewer.scope', 'IT confidentiality controlled internal pilot scope', 'scope'],
  ['confidentiality', 'quality_reviewer.name', 'Real Quality confidentiality reviewer name', 'person'],
  ['confidentiality', 'quality_reviewer.role', 'Real Quality confidentiality reviewer role', 'role'],
  ['confidentiality', 'quality_reviewer.date', 'Quality confidentiality review date, YYYY-MM-DD, not future', 'date'],
  ['confidentiality', 'quality_reviewer.decision', 'Quality confidentiality decision: confirmed/approved/accepted', 'confDecision'],
  ['confidentiality', 'quality_reviewer.scope', 'Quality confidentiality controlled internal pilot scope', 'scope'],
  ['confidentiality', 'statements.no_real_patient_identifiers', 'No real patient identifiers statement', 'true'],
  ['confidentiality', 'statements.no_confidential_ovr_details', 'No confidential OVR details statement', 'true'],
  ['confidentiality', 'statements.controlled_pilot_users_only', 'Controlled pilot users only statement', 'true'],
  ['confidentiality', 'statements.local_staging_proof_reviewed', 'Local staging proof reviewed statement', 'true'],
  ['confidentiality', 'scope', 'Overall confidentiality controlled internal pilot scope', 'scope']
];

export function approvalFiles() {
  return {
    'pilot-signoff': readJsonSafe(path.join('release', 'v674', 'approvals', 'pilot-signoff.json')),
    confidentiality: readJsonSafe(path.join('release', 'v674', 'approvals', 'ovr-confidentiality-confirmation.json'))
  };
}

export function evaluateApprovals() {
  const files = approvalFiles();
  const rows = [];
  let passed = 0;
  let failed = 0;

  for (const [fileKey, field, description, kind] of signoffFields) {
    const file = files[fileKey];
    const value = file.data ? get(file.data, field) : undefined;
    let ok = false;
    if (file.error) ok = false;
    else if (kind === 'person' || kind === 'role') ok = !isPlaceholder(value);
    else if (kind === 'date') ok = validPastOrTodayDate(value);
    else if (kind === 'pilotDecision') ok = ['approved', 'approve', 'go', 'accepted'].includes(String(value || '').toLowerCase());
    else if (kind === 'confDecision') ok = ['confirmed', 'approved', 'accepted'].includes(String(value || '').toLowerCase());
    else if (kind === 'scope') ok = controlledScope(value);
    else if (kind === 'maxUsers') ok = maxPilotUsersValid(value);
    else if (kind === 'true') ok = boolTrue(value);

    if (ok) passed += 1;
    else failed += 1;
    rows.push({ file: fileKey, field, description, status: ok ? 'passed' : 'missing_or_invalid', value: typeof value === 'object' ? JSON.stringify(value) : value });
  }

  return { required: signoffFields.length, passed, failed, rows, status: failed === 0 ? 'approval_files_complete_pending_strict_proof' : 'manual_approval_pending' };
}

export function readProofSuite() {
  const proof = readJsonSafe(path.join('release', 'v700', 'proof-suite-all.json'));
  if (!proof.data) return { exists: proof.exists, failed_count: null, passed_count: null, failed_commands: [], status: 'proof_summary_unavailable' };
  return {
    exists: true,
    failed_count: proof.data.failed_count ?? null,
    passed_count: proof.data.passed_count ?? null,
    failed_commands: proof.data.failed_commands || [],
    status: proof.data.status || 'unknown'
  };
}

export function mdTable(headers, rows) {
  return [
    '| ' + headers.join(' | ') + ' |',
    '| ' + headers.map(() => '---').join(' | ') + ' |',
    ...rows.map((row) => '| ' + row.map((cell) => String(cell ?? '').replace(/\n/g, ' ')).join(' | ') + ' |')
  ].join('\n');
}
