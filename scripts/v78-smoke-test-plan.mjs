import { mdTable, statusFromApprovals, writeJson, writeMd } from './v78-common.mjs';

const scenarios = [
  ['AUTH-01', 'Login with admin synthetic persona', 'Pass'],
  ['AUTH-02', 'Unauthorized user blocked from admin area', 'Pass'],
  ['GRC-01', 'Open governance/risk/compliance modules', 'Pass'],
  ['AUDIT-01', 'Open audit evidence as permitted reviewer', 'Pass'],
  ['OVR-01', 'Create synthetic OVR without patient identifiers', 'Pass'],
  ['OVR-02', 'Unauthorized OVR access denied', 'Pass'],
  ['TASK-01', 'Create corrective action task/project', 'Pass'],
  ['REPORT-01', 'Generate non-confidential report preview', 'Pass'],
  ['ADMIN-01', 'Role assignment uses approved bridge path', 'Pass'],
  ['ROLLBACK-01', 'Rollback staging deployment', 'Pass'],
];
const result = { generated_at: new Date().toISOString(), status: statusFromApprovals(), scenarios: scenarios.length };
writeJson('smoke-test-plan.json', result);
writeMd('smoke-test-plan.md', `# v7.8 Staging Smoke Test Plan\n\nGenerated: ${result.generated_at}\n\nStatus: **${result.status}**\n\n${mdTable(['ID', 'Scenario', 'Expected'], scenarios)}\n\n## Evidence\n\nCapture screenshots/logs for each scenario during live staging execution.`);
console.log('v7.8 smoke test plan generated.');
console.log(JSON.stringify({ status: result.status, scenarios: scenarios.length, report: 'release/v78/smoke-test-plan.md' }, null, 2));
