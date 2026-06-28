import fs from 'node:fs';

const scenarios = [
  ['V130-UAT-01', 'Super Admin', 'Confirm executive workspace uses controlled-pilot language only.', 'Screenshot dashboard and blockers.'],
  ['V130-UAT-02', 'Quality / Governance Admin', 'Trace OVR to validation, CAPA/action, evidence, and closure.', 'Screenshot workflow handoff.'],
  ['V130-UAT-03', 'Auditor', 'Confirm read-only assurance review and denied privileged actions.', 'Screenshot read-only view and denied edit.'],
  ['V130-UAT-04', 'Department Manager', 'Confirm assigned work and absence of unrelated admin functions.', 'Screenshot manager work queue.'],
  ['V130-UAT-05', 'External synthetic user', 'Confirm primary organization records are denied.', 'Screenshot safe denied or empty state.'],
];

const rows = scenarios.map(([id, actor, scenario, evidence]) => `| ${id} | ${actor} | ${scenario} | ${evidence} |`).join('\n');
const doc = `# v13.0 Guided UAT Script

Generated: ${new Date().toISOString()}

## Rules

- Use synthetic users only.
- Do not enter real patient identifiers.
- Do not enter confidential OVR details during pilot.
- Capture screenshots for evidence.
- Stop if any role sees unrelated confidential data or broad production-ready language.

## Scenario table

| ID | Actor | Scenario | Evidence |
|---|---|---|---|
${rows}

## Stop conditions

1. Any page asserts broad production readiness before v66 approvals pass.
2. External user sees Al Modawat records.
3. Auditor can perform privileged write/admin actions.
4. OVR workflow allows confidential data exposure outside allowed role scope.
5. CAPA or closure is possible without owner/evidence where policy requires evidence.
`;

fs.mkdirSync('release/v130', { recursive: true });
fs.writeFileSync('release/v130/v130-guided-uat-script.md', doc);
console.log('v13.0 guided UAT script generated.');
console.log(JSON.stringify({ report: 'release/v130/v130-guided-uat-script.md', scenarios: scenarios.length }, null, 2));
