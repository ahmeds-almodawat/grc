import fs from 'node:fs';
import path from 'node:path';

export const STATUS_PENDING = 'technical_ready_pending_human_approval';
export const OUT_DIR = path.join('release', 'v96');

export function ensureOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

export function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { exists: false, data: null, error: null };
    return { exists: true, data: JSON.parse(fs.readFileSync(filePath, 'utf8')), error: null };
  } catch (error) {
    return { exists: true, data: null, error: error.message };
  }
}

export function getByPath(obj, dottedPath) {
  return dottedPath.split('.').reduce((acc, key) => (acc && Object.prototype.hasOwnProperty.call(acc, key) ? acc[key] : undefined), obj);
}

export function isPlaceholder(value) {
  if (typeof value !== 'string') return true;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return ['tbd', 'todo', 'placeholder', 'name', 'role', 'date', 'pending', 'n/a', 'na'].includes(normalized);
}

export const signoffRequiredPaths = [
  'management_admin.name',
  'management_admin.role',
  'management_admin.date',
  'management_admin.decision',
  'management_admin.scope',
  'it.name',
  'it.role',
  'it.date',
  'it.decision',
  'it.scope',
  'quality.name',
  'quality.role',
  'quality.date',
  'quality.decision',
  'quality.scope',
  'pilot_scope',
  'maximum_pilot_users',
  'reviewed_evidence.local_staging_sql_proofs_reviewed',
  'reviewed_evidence.restore_integrity_dryrun_reviewed',
  'reviewed_evidence.security_definer_audit_reviewed'
];

export const confidentialityRequiredPaths = [
  'it_reviewer.name',
  'it_reviewer.role',
  'it_reviewer.date',
  'it_reviewer.decision',
  'it_reviewer.scope',
  'quality_reviewer.name',
  'quality_reviewer.role',
  'quality_reviewer.date',
  'quality_reviewer.decision',
  'quality_reviewer.scope',
  'statements.no_real_patient_identifiers',
  'statements.no_confidential_ovr_details',
  'statements.controlled_pilot_users_only',
  'statements.local_staging_proof_reviewed',
  'scope'
];

export function summarizeApprovals() {
  const signoffPath = path.join('release', 'v674', 'approvals', 'pilot-signoff.json');
  const confidentialityPath = path.join('release', 'v674', 'approvals', 'ovr-confidentiality-confirmation.json');
  const signoff = readJsonSafe(signoffPath);
  const confidentiality = readJsonSafe(confidentialityPath);

  const signoffMissing = signoffRequiredPaths.filter((field) => {
    if (!signoff.data) return true;
    const value = getByPath(signoff.data, field);
    if (typeof value === 'boolean') return value !== true;
    if (typeof value === 'number') return !(Number.isInteger(value) && value >= 1 && value <= 15);
    return isPlaceholder(value);
  });

  const confidentialityMissing = confidentialityRequiredPaths.filter((field) => {
    if (!confidentiality.data) return true;
    const value = getByPath(confidentiality.data, field);
    if (typeof value === 'boolean') return value !== true;
    return isPlaceholder(value);
  });

  return {
    signoff_exists: signoff.exists,
    signoff_parse_error: signoff.error,
    confidentiality_exists: confidentiality.exists,
    confidentiality_parse_error: confidentiality.error,
    signoff_missing: signoffMissing,
    confidentiality_missing: confidentialityMissing,
    missing_total: signoffMissing.length + confidentialityMissing.length,
    approval_complete: signoffMissing.length === 0 && confidentialityMissing.length === 0 && !signoff.error && !confidentiality.error
  };
}

export function writeReport(fileName, title, sections) {
  ensureOutDir();
  const generatedAt = new Date().toISOString();
  const body = [
    `# ${title}`,
    '',
    `Generated: ${generatedAt}`,
    '',
    ...sections,
    '',
    '## Safety boundary',
    '',
    'This report does not modify approval values, bypass strict proof, change RLS, change migrations, change runtime bridge logic, or mark production ready.',
    '',
    '## Final status',
    '',
    'The project remains technical_ready_pending_human_approval until the real approval files are completed and the existing strict proof passes.',
    ''
  ].join('\n');
  const outPath = path.join(OUT_DIR, fileName);
  fs.writeFileSync(outPath, body);
  return outPath.replaceAll('\\\\', '/');
}
