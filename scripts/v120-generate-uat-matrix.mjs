import fs from 'node:fs';
import path from 'node:path';
const releaseDir = path.join('release', 'v120');
fs.mkdirSync(releaseDir, { recursive: true });
const rows = [
  ['super_admin', 'Open v12 workspace/dashboard/data quality tables and confirm create/update access.', 'Allowed. No delete path/grant should exist.'],
  ['governance_admin', 'Create synthetic workspace module health update and release readiness check.', 'Allowed in own organization.'],
  ['compliance_officer', 'Create data-quality rule/finding for policy review date or training completion.', 'Allowed in own organization.'],
  ['auditor', 'Review data-quality board and add audit-style finding/remediation note.', 'Allowed where governance policy permits; no user-management access.'],
  ['department_manager', 'Create/triage department feedback item and review SLA events assigned to department.', 'Department-scoped operational visibility only.'],
  ['employee', 'Submit feedback and view assigned help/glossary/saved view records.', 'Can submit feedback; cannot manage enterprise settings.'],
  ['viewer', 'Open read-only dashboard views and try mutation.', 'Read-only behavior. Mutation hidden or denied.'],
  ['external employee/viewer', 'Attempt to view Al Modawat v12 organization records.', 'Denied. No primary organization leakage.']
];
const content = `# v12.0 UAT Scenario Matrix\n\n- Generated: ${new Date().toISOString()}\n- Scope: controlled UAT only\n- Data rule: synthetic/non-confidential only\n\n| Role | Scenario | Expected result |\n|---|---|---|\n${rows.map(r => `| ${r[0]} | ${r[1]} | ${r[2]} |`).join('\n')}\n\n## Stop conditions\n\n- External organization user can see primary organization records.\n- Normal user can delete or manage v12 settings outside authority.\n- Any test requires patient identifiers or confidential OVR details.\n- v12 migration appears without RLS or with broad delete grants.\n`;
fs.writeFileSync(path.join(releaseDir, 'v120-uat-scenario-matrix.md'), content);
console.log('v12.0 UAT scenario matrix generated.');
console.log(JSON.stringify({ matrix: 'release/v120/v120-uat-scenario-matrix.md' }, null, 2));
