import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v910');
fs.mkdirSync(outDir, { recursive: true });

function rel(file) {
  return path.relative(root, file).replaceAll('\\', '/');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
  } catch (error) {
    return { __read_error: error instanceof Error ? error.message : String(error) };
  }
}

function bullet(items) {
  return items.map(item => `- ${item}`).join('\n');
}

const generatedAt = new Date().toISOString();
const packageJson = readJson('package.json');
const scripts = packageJson.scripts || {};
const v72Proof = readJson('release/v72/real-authenticated-persona-proof.json');
const v700Gap = readJson('release/v700/real-persona-test-gap-report.json');
const v66Manual = readJson('release/v66/v66-manual-evidence.json');

const manualRows = Array.isArray(v66Manual?.items)
  ? v66Manual.items
  : Array.isArray(v66Manual?.manual_evidence)
    ? v66Manual.manual_evidence
    : null;
const manualPending = Array.isArray(manualRows)
  ? manualRows.filter(item => item.required !== false && item.status !== 'verified').map(item => item.id || item.evidence_id || item.name)
  : Object.entries(v66Manual || {})
      .filter(([, value]) => value && typeof value === 'object' && value.status === 'manual_required')
      .map(([key]) => key);

const requiredFiles = [
  'src/components/ControlledPilotBanner.tsx',
  'src/pages/WorkspaceHome.tsx',
  'src/pages/ScenarioTestConsole.tsx',
  'src/pages/UatIssueCapture.tsx',
  'src/lib/uatIssueApi.ts',
  'supabase/migrations/051_v910_controlled_pilot_uat_issues.sql',
  'release/v99/uat-user-matrix.md',
  'release/v99/scenario-coverage-map.md',
];

const requiredScripts = [
  'v910:ui-polish-check',
  'v910:uat-readiness-report',
  'v910:final-smoke',
  'pilot:uat-readiness',
  'pilot:bulk-uat-users',
  'pilot:ovr-workflow-verification',
  'pilot:first-run-bootstrap',
];

const readiness = {
  generated_at: generatedAt,
  environment: 'Local Supabase Docker / controlled pilot readiness',
  production_ready: false,
  synthetic_data_only: true,
  no_real_patient_identifiers: true,
  no_confidential_ovr_data: true,
  required_files: requiredFiles.map(file => ({ file, exists: exists(file) })),
  required_scripts: requiredScripts.map(script => ({ script, exists: Boolean(scripts[script]) })),
  v72_persona_proof: {
    strict_passed: Boolean(v72Proof.strict_passed),
    authenticated_personas: `${v72Proof.authenticated_personas_passed ?? 0}/${v72Proof.required_persona_count ?? 8}`,
    required_scenarios: `${v72Proof.required_scenarios_passed ?? 0}/${v72Proof.required_scenario_count ?? 9}`,
    failed_count: v72Proof.failed_count ?? null,
    cleanup_status: v72Proof.cleanup_status ?? 'unknown',
    v700_gap_status: v700Gap.status ?? 'not_read',
  },
  expected_manual_approval_blockers: manualPending.filter(Boolean),
};

fs.writeFileSync(path.join(outDir, 'uat-readiness.json'), `${JSON.stringify(readiness, null, 2)}\n`);

fs.writeFileSync(path.join(outDir, 'ui-polish-report.md'), `# v9.10 UI Polish Report

- Generated: ${generatedAt}
- Scope: final manual UAT readiness, controlled pilot only
- Production readiness: **not asserted**
- Evidence integrity: no approvals faked, no v66 gate bypassed

## UI changes expected in this patch

${bullet([
  'Homepage/dashboard fake counters such as Employees 1K and Departments 50 are disallowed by the v9.10 UI polish check.',
  'Main navigation keeps useful UAT-era cards: OVR, risks, controls, evidence, corrective actions/projects, reports, and authorized admin/access control.',
  'Controlled pilot banner appears on home, admin/dashboard areas, Scenario Lab, and UAT issue capture.',
  'Counts use real Supabase/RLS-scoped queries where safe; unavailable counts show professional empty states such as Not configured, Pending setup, or No records yet.',
  'Scenario Lab exposes clear controlled-pilot actions and copyable PowerShell/npm commands instead of pretending to run terminal-only operations in the browser.',
])}

## Files checked

${readiness.required_files.map(item => `- ${item.exists ? '[ok]' : '[missing]'} \`${item.file}\``).join('\n')}

## Manual review note

The UI is prepared for controlled UAT. It is not production-ready until the real human signoff/confidentiality approvals are completed and the v66 gate passes.
`);

fs.writeFileSync(path.join(outDir, 'uat-readiness-checklist.md'), `# v9.10 Manual UAT Readiness Checklist

- Generated: ${generatedAt}
- Data boundary: **synthetic/non-confidential only**
- Environment: **local/staging controlled pilot**

## Before testing

- [ ] Start local Supabase and the app.
- [ ] Run \`npm run pilot:first-run-bootstrap\`.
- [ ] Run \`npm run pilot:bulk-uat-users\`.
- [ ] Open \`release/v99/uat-user-matrix.md\` and assign testers to synthetic accounts.
- [ ] Confirm no real patient identifiers or confidential OVR details will be entered.

## Per-role UAT flow

- [ ] Sign in with the assigned v99 synthetic account.
- [ ] Confirm the controlled pilot banner is visible.
- [ ] Confirm only authorized navigation items are visible.
- [ ] Test the primary scenario listed in the UAT user matrix.
- [ ] Verify denied pages/actions fail safely.
- [ ] Capture bugs in the UAT issue page with no real patient/confidential data.

## Core modules to cover

- [ ] OVR same-department workflow.
- [ ] OVR cross-department workflow after Quality validation.
- [ ] Risks and controls visibility.
- [ ] Evidence submission/review visibility.
- [ ] Corrective actions/projects.
- [ ] Reports/read-only access.
- [ ] Access Control/Admin visibility for authorized users only.
- [ ] Scenario Lab actions for super_admin/governance_admin only.

## Stop conditions

- Any user sees unrelated confidential OVR data.
- Any external synthetic organization account sees primary-organization records.
- Normal users can access Admin, Access Control, import/export, backup, or Scenario Lab actions.
- UAT issue capture cannot record structured bugs after migrations are applied.
`);

fs.writeFileSync(path.join(outDir, 'uat-issue-log-template.md'), `# v9.10 UAT Issue Log Template

Use the in-app **Report UAT issue** page when possible. If the app is unavailable, capture the same fields here.

| Field | Required | Notes |
|---|---:|---|
| Title | yes | Short issue title |
| Module | yes | Home, OVR, Risks, Controls, Evidence, Projects, Reports, Access Control/Admin, Scenario Lab, Auth/Roles, Other |
| Role/account used | yes | Role plus synthetic email only |
| Steps to reproduce | yes | Numbered steps |
| Expected result | yes | What should happen |
| Actual result | yes | What happened |
| Severity | yes | low / medium / high / blocker |
| Screenshot note | no | Filename or note only; no upload required |
| Status | yes | open / reviewing / fixed / deferred |

Never enter real patient identifiers or confidential OVR narratives.
`);

fs.writeFileSync(path.join(outDir, 'final-uat-readiness-report.md'), `# v9.10 Final UAT Readiness Report

- Generated: ${generatedAt}
- Status: **controlled UAT ready, pending real manual approvals**
- Production readiness: **not asserted**
- Synthetic data only: **yes**

## Technical readiness

${readiness.required_scripts.map(item => `- ${item.exists ? '[ok]' : '[missing]'} \`${item.script}\``).join('\n')}

## UAT issue capture

The in-app UAT issue page writes to \`public.controlled_pilot_issues\` using authenticated Supabase/RLS. The v9.10 migration adds structured UAT fields and authenticated select/insert/update grants without delete access.

## v72 persona-proof inspection

- Strict passed: **${readiness.v72_persona_proof.strict_passed ? 'yes' : 'no'}**
- Authenticated personas: **${readiness.v72_persona_proof.authenticated_personas}**
- Required scenarios: **${readiness.v72_persona_proof.required_scenarios}**
- Failed count: **${readiness.v72_persona_proof.failed_count ?? 'unknown'}**
- Cleanup status: **${readiness.v72_persona_proof.cleanup_status}**
- v700 gap status: **${readiness.v72_persona_proof.v700_gap_status}**

Interpretation: ${
  readiness.v72_persona_proof.strict_passed
    ? 'The v72 proof report shows the previous persona-proof failure is not a real persona/security failure in the current working tree. Re-running proof commands remains required for final evidence.'
    : 'The v72 proof is not passing in the current report. Do not hide this; re-run npm run v72:persona-proof and inspect the failing scenario before UAT signoff.'
}

## Expected remaining blocker

The v66 strict gate may still fail only for real human governance approvals if they remain incomplete. This patch does not fake approvals or bypass that gate.

Pending/manual approval signals read from \`release/v66/v66-manual-evidence.json\`:

${readiness.expected_manual_approval_blockers.length ? readiness.expected_manual_approval_blockers.map(item => `- ${item}`).join('\n') : '- No pending manual items parsed from the current file shape.'}

## Go/no-go statement

Proceed with controlled manual UAT using synthetic accounts and non-confidential records. Do not claim production readiness until management/admin, IT, and Quality approvals are explicitly completed and the v66 gate passes.
`);

console.log('v9.10 UAT readiness reports generated.');
console.log(JSON.stringify({
  report: 'release/v910/final-uat-readiness-report.md',
  checklist: 'release/v910/uat-readiness-checklist.md',
  issue_template: 'release/v910/uat-issue-log-template.md',
  ui_report: 'release/v910/ui-polish-report.md',
  v72_strict_passed: readiness.v72_persona_proof.strict_passed,
  expected_manual_approval_blockers: readiness.expected_manual_approval_blockers,
}, null, 2));
