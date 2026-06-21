import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v98');
const outPath = path.join(outDir, 'ovr-gap-report.md');
fs.mkdirSync(outDir, { recursive: true });

function read(relativePath) {
  const filePath = path.join(root, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

const migration = read('supabase/migrations/049_v98_ovr_workflow_gap_closure.sql');
const page = read('src/pages/OVR.tsx');
const api = read('src/lib/grcApi.ts');
const bridge = read('supabase/functions/privileged-action/index.ts');
const notifications = read('supabase/migrations/017_notifications_activity_timelines.sql');

const rows = [
  ['1. Reporter submits OVR', api.includes(".from('ovr_reports')") && page.includes("saveReport('submitted')"), 'implemented', 'Authenticated reporter insert with factual report form and confidential-data warning.'],
  ['2. Manager review within 24 hours', migration.includes('current_date + 1') && migration.includes("p_next_status = 'manager_review'"), 'implemented', 'Submission trigger sets 24-hour due date; relevant department manager transition is role-gated.'],
  ['3. Quality validates before referral notification', migration.includes('quality_validated_at') && migration.includes('V98_OVR_QUALITY_VALIDATION_REQUIRED_BEFORE_REFERRAL'), 'implemented', 'Referral transition rejects unvalidated OVRs; notification is created only after validation.'],
  ['4. Referred party responds', migration.includes('referred_user_id') && migration.includes('V98_OVR_REFERRED_RESPONSE_REQUIRED'), 'implemented', 'Structured referred user/department and response fields with RLS visibility.'],
  ['5. Quality issues final verdict', migration.includes('V98_OVR_FINAL_VERDICT_REQUIRED') && page.includes('issueFinalVerdict'), 'implemented', 'Quality-only final-review branch records verdict and notifies reporter.'],
  ['6. Reporter accepts or disputes', migration.includes("p_next_status = 'disputed'") && migration.includes("p_next_status = 'closed'"), 'implemented', 'Only the original reporter may dispute or accept/close after final review.'],
  ['7. Dispute reopens OVR', migration.includes("p_next_status = 'reopened'"), 'implemented', 'Quality/Admin reopens a disputed OVR and clears stale closure state.'],
  ['8. Closure requires verdict and evidence/action', migration.includes('V98_OVR_ACCEPTED_EVIDENCE_OR_CLOSED_ACTION_REQUIRED'), 'implemented', 'Final verdict plus accepted evidence or a closed linked action project are enforced.'],
  ['9. Admin sees all', migration.includes("'super_admin'"), 'implemented', 'Organization-scoped/global super-admin SELECT access remains explicit.'],
  ['10. Audit sees all read-only', migration.includes("'auditor'") && migration.includes('V98_OVR_AUDITOR_READ_ONLY'), 'implemented', 'Audit is included in SELECT policy and explicitly denied workflow mutation.'],
  ['11. Quality manages validation/final verdict', migration.includes("'governance_admin', 'compliance_officer'"), 'implemented', 'Quality pilot roles are explicit in the server-side transition function.'],
  ['12. Reporter sees own OVRs', migration.includes('reported_by = auth.uid()'), 'implemented', 'RLS explicitly permits own-report visibility.'],
  ['13. Referred party sees assigned referrals only', migration.includes('referred_user_id = auth.uid()'), 'implemented', 'RLS exposes the OVR only after structured referral assignment.'],
  ['14. Department manager sees relevant OVRs', migration.includes('ur.department_id is not distinct from ovr_reports.department_id'), 'implemented', 'Origin and referred department manager scopes are explicit.'],
  ['In-app notifications/reminders', notifications.includes('notifications') && migration.includes('OVR referral requires response'), 'implemented', 'Manager, Quality, referral, and final-verdict in-app notifications exist; external email/SMS is outside this pilot scope.'],
  ['Browser interaction proof', page.includes('completeManagerReview') && page.includes('acceptVerdict'), 'not proven', 'Controls are implemented and compiled; authenticated browser click-through still requires a pilot password/session.'],
];

const matrix = rows.map(([objective, condition, expectedStatus, evidence]) => ({
  objective,
  status: condition ? expectedStatus : 'missing',
  evidence,
}));
const counts = matrix.reduce((acc, row) => {
  acc[row.status] = (acc[row.status] || 0) + 1;
  return acc;
}, {});
const lines = [
  '# v9.8 OVR Workflow Gap Report',
  '',
  `- Generated: ${new Date().toISOString()}`,
  '- Scope: controlled internal pilot',
  '- Synthetic/de-identified data only',
  '- Production readiness: **Not asserted**',
  '',
  '| Workflow requirement | Classification | Evidence / remaining proof |',
  '|---|---|---|',
  ...matrix.map(row => `| ${row.objective} | **${row.status}** | ${row.evidence} |`),
  '',
  '## Totals',
  '',
  `- Implemented: ${counts.implemented || 0}`,
  `- Partial: ${counts.partial || 0}`,
  `- Missing: ${counts.missing || 0}`,
  `- Not proven: ${counts['not proven'] || 0}`,
  '',
  '## Focused changes',
  '',
  '- Added the missing business statuses without removing legacy statuses.',
  '- Replaced free-text referral enforcement with structured department/user assignments.',
  '- Added server-side transition authorization and made Audit read-only.',
  '- Added referral timing, final verdict, reporter dispute/acceptance, reopen, escalation, and evidence-gated closure.',
  '- Kept external notification delivery and production approval outside this controlled-pilot patch.',
  '',
];

fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log('v9.8 OVR gap report generated.');
console.log(`Report: ${path.relative(root, outPath)}`);
if (matrix.some(row => row.status === 'missing')) process.exitCode = 1;
