import { readJson, writeJson, writeMarkdown, isPlaceholder, hasControlledPilotScope, notFutureDate, boolTrue, STATUS_PENDING, PRODUCTION_READY, SCOPE_TEXT } from './v91-common.mjs';

const pilotPath = 'release/v674/approvals/pilot-signoff.json';
const confPath = 'release/v674/approvals/ovr-confidentiality-confirmation.json';

const pilot = readJson(pilotPath);
const conf = readJson(confPath);
const issues = [];
const warnings = [];

function section(obj, key) {
  return obj && typeof obj === 'object' ? obj[key] || {} : {};
}

function checkApprover(prefix, obj, allowedDecisions) {
  if (isPlaceholder(obj.name)) issues.push(prefix + '.name missing or placeholder');
  if (isPlaceholder(obj.role)) issues.push(prefix + '.role missing or placeholder');
  if (!notFutureDate(obj.date)) issues.push(prefix + '.date must be real YYYY-MM-DD and not future');
  if (!allowedDecisions.includes(String(obj.decision || '').toLowerCase())) issues.push(prefix + '.decision must be one of: ' + allowedDecisions.join(', '));
  if (!hasControlledPilotScope(obj.scope)) issues.push(prefix + '.scope must identify controlled internal pilot scope');
}

if (pilot.__read_error) issues.push('Cannot read ' + pilotPath + ': ' + pilot.__read_error);
if (conf.__read_error) issues.push('Cannot read ' + confPath + ': ' + conf.__read_error);

checkApprover('pilot.management_admin', section(pilot, 'management_admin'), ['approved', 'approve', 'go', 'accepted']);
checkApprover('pilot.it', section(pilot, 'it'), ['approved', 'approve', 'go', 'accepted']);
checkApprover('pilot.quality', section(pilot, 'quality'), ['approved', 'approve', 'go', 'accepted']);

if (!hasControlledPilotScope(pilot.pilot_scope)) issues.push('pilot.pilot_scope must identify controlled internal pilot');
if (!Number.isInteger(pilot.maximum_pilot_users) || pilot.maximum_pilot_users < 1 || pilot.maximum_pilot_users > 15) issues.push('pilot.maximum_pilot_users must be integer from 1 to 15');
for (const key of ['local_staging_sql_proofs_reviewed', 'restore_integrity_dryrun_reviewed', 'security_definer_audit_reviewed']) {
  if (!boolTrue(section(pilot, 'reviewed_evidence')[key])) issues.push('pilot.reviewed_evidence.' + key + ' must be true after review');
}

checkApprover('confidentiality.it_reviewer', section(conf, 'it_reviewer'), ['confirmed', 'approved', 'accepted']);
checkApprover('confidentiality.quality_reviewer', section(conf, 'quality_reviewer'), ['confirmed', 'approved', 'accepted']);
if (!hasControlledPilotScope(conf.scope)) issues.push('confidentiality.scope must identify controlled internal pilot');
for (const key of ['no_real_patient_identifiers', 'no_confidential_ovr_details', 'controlled_pilot_users_only', 'local_staging_proof_reviewed']) {
  if (!boolTrue(section(conf, 'statements')[key])) issues.push('confidentiality.statements.' + key + ' must be true after review');
}

if (issues.length === 0) warnings.push('Manual approvals appear complete by v9.1 lint. Confirm with npm run v674:signoff-check.');

const status = issues.length ? 'manual_approval_pending' : 'manual_approval_lint_passed';
const report = {
  generated_at: new Date().toISOString(),
  status,
  production_ready: PRODUCTION_READY,
  issue_count: issues.length,
  warning_count: warnings.length,
  issues,
  warnings,
  recommended_scope: SCOPE_TEXT,
  next_commands_after_real_approval: [
    'npm run v674:signoff-check',
    'npm run v674:sync-manual-evidence',
    'npm run v66:strict-proof',
    'npm run proof:all'
  ]
};

writeJson('release/v91/approval-readiness-lint.json', report);
writeMarkdown('release/v91/approval-readiness-lint.md', [
  '# v9.1 Approval Readiness Lint',
  '',
  'Generated: ' + report.generated_at,
  '',
  '| Item | Value |',
  '| --- | --- |',
  '| Status | ' + status + ' |',
  '| Production ready | No |',
  '| Issues | ' + issues.length + ' |',
  '| Warnings | ' + warnings.length + ' |',
  '',
  '## Issues',
  '',
  issues.length ? issues.map((x) => '- ' + x).join('\n') : 'None.',
  '',
  '## Recommended scope',
  '',
  SCOPE_TEXT,
  '',
  '## Next commands after real approval',
  '',
  '- npm run v674:signoff-check',
  '- npm run v674:sync-manual-evidence',
  '- npm run v66:strict-proof',
  '- npm run proof:all'
]);

console.log('v9.1 approval readiness lint complete.');
console.log(JSON.stringify({ status: STATUS_PENDING, lint_status: status, production_ready: PRODUCTION_READY, issues: issues.length, report: 'release/v91/approval-readiness-lint.md' }, null, 2));
