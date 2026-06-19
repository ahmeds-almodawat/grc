#!/usr/bin/env node
import { loadEvidence, writeJson, writeMd, recommendedScope, mdTable } from './v75-common.mjs';

const evidence = loadEvidence();
const signoff = evidence.signoffCheck || {};
const generatedAt = new Date().toISOString();

const pilotRequired = [
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

const confidentialityRequired = [
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

const checklist = {
  generated_at: generatedAt,
  signoff_valid: signoff.signoff_valid === true,
  confidentiality_valid: signoff.confidentiality_valid === true,
  strict_passed: signoff.strict_passed === true,
  recommended_scope: recommendedScope,
  allowed_pilot_decisions: ['approved', 'approve', 'go', 'accepted'],
  allowed_confidentiality_decisions: ['confirmed', 'approved', 'accepted'],
  pilot_required_fields: pilotRequired,
  confidentiality_required_fields: confidentialityRequired,
  signoff_issues_from_latest_check: signoff.signoff_issues || signoff.issues || [],
  confidentiality_issues_from_latest_check: signoff.confidentiality_issues || []
};

writeJson('release/v75/human-approval-checklist.json', checklist);

const pilotRows = pilotRequired.map((field) => ({ Field: field, Required: 'Yes', Notes: field.includes('date') ? 'YYYY-MM-DD, not future' : field.includes('decision') ? 'approved / approve / go / accepted' : field.includes('scope') ? 'Must identify controlled internal pilot scope' : field.includes('reviewed_evidence') ? 'Must be explicitly true after real review' : '' }));
const confRows = confidentialityRequired.map((field) => ({ Field: field, Required: 'Yes', Notes: field.includes('date') ? 'YYYY-MM-DD, not future' : field.includes('decision') ? 'confirmed / approved / accepted' : field.includes('scope') ? 'Must identify controlled internal pilot scope' : field.includes('statements') ? 'Must be explicitly true after real review' : '' }));

const md = `# v7.5 Human Approval Checklist

Generated: ${generatedAt}

## Current latest signoff status

\`\`\`json
${JSON.stringify({ signoff_valid: checklist.signoff_valid, confidentiality_valid: checklist.confidentiality_valid, strict_passed: checklist.strict_passed }, null, 2)}
\`\`\`

## Do not fake approval

Approval files must be completed only after real Management/Admin, IT, and Quality review. Do not auto-fill names, roles, dates, or decisions.

## Recommended controlled pilot scope

\`\`\`text
${recommendedScope}
\`\`\`

## Pilot signoff required fields

${mdTable(pilotRows, ['Field', 'Required', 'Notes'])}

## Confidentiality confirmation required fields

${mdTable(confRows, ['Field', 'Required', 'Notes'])}

## Approval files to open

\`\`\`powershell
code release\\v674\\approvals\\pilot-signoff.json
code release\\v674\\approvals\\ovr-confidentiality-confirmation.json
\`\`\`

## Validation after real approval

\`\`\`powershell
npm run v674:signoff-check
npm run v674:sync-manual-evidence
npm run v66:strict-proof
npm run proof:all
\`\`\`

## Expected result after valid real approval

\`\`\`text
v674:signoff-check = strict_passed true
v66:strict-proof = passed
proof:all = fully passed
\`\`\`
`;

writeMd('release/v75/human-approval-checklist.md', md);

console.log('v7.5 human approval checklist generated.');
console.log(JSON.stringify({ report: 'release/v75/human-approval-checklist.md', signoff_valid: checklist.signoff_valid, confidentiality_valid: checklist.confidentiality_valid }, null, 2));
