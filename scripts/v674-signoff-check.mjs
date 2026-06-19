import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const approvalsDir = path.join(root, 'release', 'v674', 'approvals');
const evidenceDir = path.join(root, 'release', 'v66', 'evidence-attachments');
const reportDir = path.join(root, 'release', 'v674');
const signoffPath = path.join(approvalsDir, 'pilot-signoff.json');
const confidentialityPath = path.join(approvalsDir, 'ovr-confidentiality-confirmation.json');
const strict = process.argv.includes('--strict');

fs.mkdirSync(approvalsDir, { recursive: true });
fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function sha256(file) {
  return fs.existsSync(file)
    ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    : null;
}

const placeholderPattern = /^(?:\s*|todo|tbd|pending|placeholder|enter\b.*|your\b.*|name|role|date|decision|n\/a|na|unknown|draft)$/i;
const allowedApprovalDecisions = new Set(['approved', 'approve', 'go', 'accepted']);
const allowedConfirmationDecisions = new Set(['confirmed', 'approved', 'accepted']);

function meaningful(value) {
  return typeof value === 'string'
    && value.trim().length >= 2
    && !placeholderPattern.test(value.trim());
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date <= new Date();
}

function validatePerson(label, person, decisions) {
  const errors = [];
  if (!person || typeof person !== 'object') {
    return { label, valid: false, errors: [`${label} approval object is missing.`] };
  }
  if (!meaningful(person.name)) errors.push(`${label}.name is missing or a placeholder.`);
  if (!meaningful(person.role)) errors.push(`${label}.role is missing or a placeholder.`);
  if (!validDate(person.date)) errors.push(`${label}.date must be a real YYYY-MM-DD date that is not in the future.`);
  if (!decisions.has(String(person.decision || '').trim().toLowerCase())) {
    errors.push(`${label}.decision must be one of: ${[...decisions].join(', ')}.`);
  }
  if (!meaningful(person.scope) || !/controlled/i.test(person.scope) || !/pilot/i.test(person.scope)) {
    errors.push(`${label}.scope must explicitly identify the controlled pilot scope.`);
  }
  return { label, valid: errors.length === 0, errors };
}

const signoff = readJson(signoffPath);
const confidentiality = readJson(confidentialityPath);
const restoreReport = readJson(path.join(reportDir, 'v674-restore-integrity-dryrun.json'));
const v662Report = readJson(path.join(root, 'release', 'v662', 'v662-evidence-quality-gate.json'));
const v673Report = readJson(path.join(root, 'release', 'v673', 'v673-security-definer-execute-audit.json'));

const signoffPeople = [
  validatePerson('management_admin', signoff?.management_admin, allowedApprovalDecisions),
  validatePerson('it', signoff?.it, allowedApprovalDecisions),
  validatePerson('quality', signoff?.quality, allowedApprovalDecisions)
];
const signoffErrors = signoffPeople.flatMap((item) => item.errors);
if (!meaningful(signoff?.pilot_scope) || !/controlled/i.test(signoff?.pilot_scope || '') || !/pilot/i.test(signoff?.pilot_scope || '')) {
  signoffErrors.push('pilot_scope must explicitly identify a controlled internal pilot.');
}
if (!Number.isInteger(signoff?.maximum_pilot_users) || signoff.maximum_pilot_users < 1 || signoff.maximum_pilot_users > 15) {
  signoffErrors.push('maximum_pilot_users must be an integer from 1 to 15.');
}
const requiredEvidenceFlags = [
  'local_staging_sql_proofs_reviewed',
  'restore_integrity_dryrun_reviewed',
  'security_definer_audit_reviewed'
];
for (const flag of requiredEvidenceFlags) {
  if (signoff?.reviewed_evidence?.[flag] !== true) {
    signoffErrors.push(`reviewed_evidence.${flag} must be explicitly true.`);
  }
}
if (restoreReport?.strict_passed !== true) {
  signoffErrors.push('The v6.7.4 restore integrity report must pass before signoff can be verified.');
}
if (v662Report?.strict_passed !== true) {
  signoffErrors.push('The v6.6.2 evidence quality report must pass before signoff can be verified.');
}
if (v673Report?.strict_passed !== true) {
  signoffErrors.push('The v6.7.3 Security Definer audit must pass before signoff can be verified.');
}
const signoffValid = Boolean(signoff) && signoffErrors.length === 0;

const confidentialityPeople = [
  validatePerson('it_reviewer', confidentiality?.it_reviewer, allowedConfirmationDecisions),
  validatePerson('quality_reviewer', confidentiality?.quality_reviewer, allowedConfirmationDecisions)
];
const confidentialityErrors = confidentialityPeople.flatMap((item) => item.errors);
const requiredStatements = [
  'no_real_patient_identifiers',
  'no_confidential_ovr_details',
  'controlled_pilot_users_only',
  'local_staging_proof_reviewed'
];
for (const statement of requiredStatements) {
  if (confidentiality?.statements?.[statement] !== true) {
    confidentialityErrors.push(`statements.${statement} must be explicitly true.`);
  }
}
if (!meaningful(confidentiality?.scope) || !/controlled/i.test(confidentiality?.scope || '') || !/pilot/i.test(confidentiality?.scope || '')) {
  confidentialityErrors.push('scope must explicitly identify a controlled internal pilot.');
}
if (v662Report?.strict_passed !== true || v673Report?.strict_passed !== true) {
  confidentialityErrors.push('Local/staging SQL and Security Definer proof reports must pass before confidentiality confirmation can be verified.');
}
const confidentialityValid = Boolean(confidentiality) && confidentialityErrors.length === 0;

const report = {
  generated_at: new Date().toISOString(),
  signoff_file: path.relative(root, signoffPath).replaceAll('\\', '/'),
  confidentiality_file: path.relative(root, confidentialityPath).replaceAll('\\', '/'),
  file_hashes: {
    pilot_signoff_sha256: sha256(signoffPath),
    confidentiality_confirmation_sha256: sha256(confidentialityPath)
  },
  signoff: {
    valid: signoffValid,
    errors: signoffErrors,
    reviewers: signoffPeople
  },
  confidentiality: {
    valid: confidentialityValid,
    errors: confidentialityErrors,
    reviewers: confidentialityPeople
  },
  strict_passed: signoffValid && confidentialityValid,
  rule: 'Human governance items are verified only from explicit, complete, non-placeholder approval records.'
};

fs.writeFileSync(
  path.join(reportDir, 'v674-signoff-check.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8'
);

if (signoffValid) {
  const lines = [
    '# Controlled Internal Pilot — Human Signoff',
    '',
    'V674_HUMAN_SIGNOFF_VERIFIED',
    '',
    `Pilot scope: ${signoff.pilot_scope}`,
    `Maximum pilot users: ${signoff.maximum_pilot_users}`,
    '',
    '| Approval area | Name | Role | Date | Decision | Scope |',
    '|---|---|---|---|---|---|',
    ...[
      ['Management/Admin', signoff.management_admin],
      ['IT', signoff.it],
      ['Quality', signoff.quality]
    ].map(([label, person]) =>
      `| ${label} | ${person.name} | ${person.role} | ${person.date} | ${person.decision} | ${person.scope} |`
    ),
    '',
    'Reviewed evidence:',
    `- Local/staging SQL proofs: ${signoff.reviewed_evidence.local_staging_sql_proofs_reviewed ? 'confirmed' : 'not confirmed'}`,
    `- Restore integrity dry-run: ${signoff.reviewed_evidence.restore_integrity_dryrun_reviewed ? 'confirmed' : 'not confirmed'}`,
    `- Security Definer audit: ${signoff.reviewed_evidence.security_definer_audit_reviewed ? 'confirmed' : 'not confirmed'}`
  ];
  fs.writeFileSync(path.join(evidenceDir, 'pilot-signoff.md'), `${lines.join('\n')}\n`, 'utf8');
}

if (confidentialityValid) {
  const lines = [
    '# OVR Confidentiality Confirmation',
    '',
    'V674_OVR_CONFIDENTIALITY_VERIFIED',
    '',
    `Scope: ${confidentiality.scope}`,
    '',
    '- No real patient identifiers: confirmed',
    '- No confidential OVR details: confirmed',
    '- Controlled pilot users only: confirmed',
    '- Local/staging proof reviewed: confirmed',
    '',
    '| Reviewer | Name | Role | Date | Decision | Scope |',
    '|---|---|---|---|---|---|',
    `| IT | ${confidentiality.it_reviewer.name} | ${confidentiality.it_reviewer.role} | ${confidentiality.it_reviewer.date} | ${confidentiality.it_reviewer.decision} | ${confidentiality.it_reviewer.scope} |`,
    `| Quality | ${confidentiality.quality_reviewer.name} | ${confidentiality.quality_reviewer.role} | ${confidentiality.quality_reviewer.date} | ${confidentiality.quality_reviewer.decision} | ${confidentiality.quality_reviewer.scope} |`
  ];
  fs.writeFileSync(
    path.join(evidenceDir, 'ovr-confidentiality-confirmation.md'),
    `${lines.join('\n')}\n`,
    'utf8'
  );
}

console.log('v6.7.4 signoff and confidentiality check complete.');
console.log({
  signoff_valid: signoffValid,
  confidentiality_valid: confidentialityValid,
  strict_passed: report.strict_passed
});
if (signoffErrors.length) console.log('Signoff issues:', signoffErrors);
if (confidentialityErrors.length) console.log('Confidentiality issues:', confidentialityErrors);

if (strict && !report.strict_passed) process.exit(1);
