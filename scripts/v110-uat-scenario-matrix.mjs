import fs from 'node:fs';
import path from 'node:path';

const releaseDir = path.resolve('release/v110');
fs.mkdirSync(releaseDir, { recursive: true });
const generatedAt = new Date().toISOString();
const rows = [
  ['super_admin', 'Open enterprise GRC tables/views; confirm admin access and no delete UX/API path is introduced.', 'Allowed create/update where role-gated; no delete grant expected.'],
  ['governance_admin', 'Create draft policy, compliance training course, KRI, regulatory change, exception request review.', 'Governance user can manage enterprise program records.'],
  ['compliance_officer', 'Map obligation to policy/control; create training assignment and regulatory change action.', 'Compliance workflows are available without super-admin access.'],
  ['auditor', 'Create audit follow-up review and inspect board-pack readiness view.', 'Audit assurance/follow-up available; user management not available.'],
  ['department_manager', 'Review assigned training/attestation and BCP process ownership for own department.', 'Department-scoped visibility only.'],
  ['employee', 'Complete policy attestation/training assignment assigned to self.', 'Employee can see/complete own assignments only.'],
  ['viewer', 'Open dashboards/read-only views and attempt mutation.', 'Read-only; mutation denied/hidden.'],
  ['external employee/viewer', 'Attempt to read primary Al Modawat enterprise GRC records.', 'Primary organization records denied.']
];

const md = `# v11.0 Enterprise UAT Scenario Matrix\n\n- Generated: ${generatedAt}\n- Scope: controlled UAT only\n- Data rule: synthetic/non-confidential only\n\n| Role | Scenario | Expected result |\n|---|---|---|\n${rows.map(r => `| ${r[0]} | ${r[1]} | ${r[2]} |`).join('\n')}\n\n## Stop conditions\n\n- External organization user can see Al Modawat enterprise GRC records.\n- Normal user can edit policy/vendor/board-pack records outside allowed ownership/scope.\n- Any screen or script asks for patient identifiers or confidential OVR details.\n- New tables appear without RLS enabled.\n`;
fs.writeFileSync(path.join(releaseDir, 'v110-uat-scenario-matrix.md'), md);
console.log('v11.0 UAT scenario matrix generated.');
console.log(JSON.stringify({ matrix: 'release/v110/v110-uat-scenario-matrix.md' }, null, 2));
