import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v140');
fs.mkdirSync(releaseDir, { recursive: true });

const generatedAt = new Date().toISOString();
const scopeStatement = 'Controlled internal pilot using synthetic and non-confidential operational data only. No real patient identifiers. No confidential OVR details. No production-wide rollout.';

const scenarios = [
  ['UAT-D1-01', 'Super Admin login', 'Super Admin', 'Authentication / Admin', 'Admin Hub, Departments, Access Control, Scenario Lab, and UAT workbench are visible.'],
  ['UAT-D1-02', 'Governance Admin login', 'Governance Admin', 'Governance', 'Governance user can access GRC workspaces without super-admin-only shortcuts.'],
  ['UAT-D1-03', 'Quality user login', 'Quality / Patient Safety', 'Quality / OVR', 'Quality can validate OVRs and manage final verdict work.'],
  ['UAT-D1-04', 'Auditor login', 'Auditor', 'Audit', 'Auditor can review evidence and audit data without privileged writes.'],
  ['UAT-D1-05', 'Department Manager login', 'Department Manager', 'Department work', 'Manager sees relevant department/team work and OVRs.'],
  ['UAT-D1-06', 'Employee login', 'Employee', 'My Work / OVR', 'Employee can access own work and submit synthetic OVR records only.'],
  ['UAT-D1-07', 'Same-department OVR', 'Reporter + Manager', 'OVR', 'Reporter submission and manager review are captured without cross-department notification.'],
  ['UAT-D1-08', 'Cross-department OVR', 'Reporter + Quality + Referred Department', 'OVR', 'Cross-department referral waits for Quality validation.'],
  ['UAT-D1-09', 'Quality validation', 'Quality', 'OVR', 'Validation state is visible and prevents premature cross-department notification.'],
  ['UAT-D1-10', 'Referred department reply', 'Referred Department', 'OVR', 'Referred party sees only assigned/referred synthetic OVRs and can respond.'],
  ['UAT-D1-11', 'Quality close/escalate', 'Quality', 'OVR', 'Closure/escalation follows final verdict and evidence/action rules.'],
  ['UAT-D1-12', 'CAPA from OVR', 'Quality / Governance', 'Corrective Actions / Projects', 'CAPA/action record is traceable back to the synthetic OVR source.'],
  ['UAT-D1-13', 'Risk creation', 'Governance Admin', 'Risks', 'Synthetic operational risk can be created with owner and scoring.'],
  ['UAT-D1-14', 'Control linked to risk', 'Governance Admin', 'Controls', 'Control relationship is visible from risk/control workspaces.'],
  ['UAT-D1-15', 'Control test', 'Auditor / Governance', 'Control testing', 'Synthetic control test result is visible to authorized reviewers.'],
  ['UAT-D1-16', 'Auditor read-only confirmation', 'Auditor', 'Audit / Evidence', 'Read-only review succeeds; privileged write/admin actions are denied safely.'],
  ['UAT-D1-17', 'Employee restricted access confirmation', 'Employee', 'Access control', 'Restricted pages are hidden or show safe unauthorized states.'],
  ['UAT-D1-18', 'External/unauthorized denial confirmation', 'External synthetic denial user', 'Access control', 'External synthetic user cannot see primary organization records.'],
];

const scenarioObjects = scenarios.map(([id, title, persona, module, expected]) => ({
  id,
  title,
  persona,
  module,
  expected_pass_condition: expected,
  scripted_result: 'manual_not_executed_by_script',
  evidence_required: 'Tester screenshot or structured UAT issue if failed/blocked.',
}));

const report = {
  generated_at: generatedAt,
  scope: scopeStatement,
  total_scenarios: scenarioObjects.length,
  scripted_passed_scenarios: 0,
  scripted_failed_scenarios: 0,
  manual_execution_required: true,
  uat_results_asserted: false,
  go_no_go_recommendation: 'not_ready_until_manual_uat_results_are_recorded',
  issue_log_fields: [
    'issue id',
    'date',
    'user/persona',
    'module',
    'steps to reproduce',
    'expected result',
    'actual result',
    'severity',
    'screenshot available yes/no',
    'status',
    'owner',
  ],
  scenarios: scenarioObjects,
};

const rows = scenarioObjects
  .map(scenario => `| ${scenario.id} | ${scenario.title} | ${scenario.persona} | ${scenario.module} | ${scenario.expected_pass_condition} | ${scenario.scripted_result} |`)
  .join('\n');

const markdown = `# v14.0 Controlled UAT Scenario Report

Generated: ${generatedAt}

## Scope

${scopeStatement}

## Honest result boundary

This script does **not** execute browser UAT and does **not** mark scenarios as passed. It creates the Day 1 controlled UAT execution plan and verifies the pack is present. Manual testers must record real pass/fail outcomes in the workbench and issue log.

## Go/no-go rule

Recommendation remains **not ready** until:

- all ${scenarioObjects.length} scenarios are manually executed and marked passed;
- no open Blocker or High UAT issues remain;
- any deferred issue has a named owner and governance decision;
- no real patient identifiers or confidential OVR details are used.

## Scenario matrix

| ID | Scenario | Persona | Module | Expected pass condition | Scripted result |
|---|---|---|---|---|---|
${rows}

## Issue log fields

${report.issue_log_fields.map(field => `- ${field}`).join('\n')}
`;

fs.writeFileSync(path.join(releaseDir, 'v140-uat-scenario-report.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(releaseDir, 'v140-uat-scenario-report.md'), markdown);

console.log('v14.0 UAT scenario report generated.');
console.log(JSON.stringify({
  total_scenarios: report.total_scenarios,
  uat_results_asserted: report.uat_results_asserted,
  report: 'release/v140/v140-uat-scenario-report.md',
}, null, 2));
