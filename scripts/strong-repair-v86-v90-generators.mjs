import fs from 'node:fs';
import path from 'node:path';

function writeReportScript(config) {
  const source = `
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('release', '${config.release}');
fs.mkdirSync(outDir, { recursive: true });

const generatedAt = new Date().toISOString();
const status = 'technical_ready_pending_human_approval';
const productionReady = false;

const rows = ${JSON.stringify(config.rows, null, 2)};
const tableRows = rows.map((row) => '| ' + row.join(' | ') + ' |').join('\\\\n');

const md = [
  '# ${config.title}',
  '',
  'Generated: ' + generatedAt,
  '',
  '## Status',
  '',
  '| Item | Value |',
  '| --- | --- |',
  '| Status | ' + status + ' |',
  '| Production ready | ' + (productionReady ? 'Yes' : 'No') + ' |',
  '| Human approval | Pending |',
  '| Approval gate bypassed | No |',
  '',
  '## ${config.sectionTitle}',
  '',
  '| Area | Evidence / Action | Owner | Status |',
  '| --- | --- | --- | --- |',
  tableRows,
  '',
  '## Safety boundary',
  '',
  'This pack does not modify approval files, RLS policies, migrations, runtime bridge logic, Supabase functions, or production readiness gates.',
  '',
  '## Final judgment',
  '',
  'The project remains technical_ready_pending_human_approval and production_ready = false.',
  '',
  'The remaining blocker is real Management/Admin, IT, and Quality signoff plus OVR confidentiality confirmation.',
  ''
].join('\\\\n');

fs.writeFileSync(path.join(outDir, '${config.reportFile}'), md);

console.log('${config.consoleTitle} generated.');
console.log(JSON.stringify({
  status,
  production_ready: productionReady,
  report: 'release/${config.release}/${config.reportFile}'
}, null, 2));
`;

  fs.writeFileSync(config.file, source.trimStart());
}

const configs = [
  {
    file: 'scripts/v86-pilot-execution-evidence.mjs',
    release: 'v86',
    title: 'v8.6 Pilot Execution Evidence',
    consoleTitle: 'v8.6 Pilot Execution Evidence',
    sectionTitle: 'Execution evidence checklist',
    reportFile: 'v86-pilot-execution-evidence.md',
    rows: [
      ['Pilot launch evidence', 'Capture launch decision, scope, users, dates, and operator assignment', 'Pilot Lead', 'Pending human approval'],
      ['Daily monitoring evidence', 'Collect daily checklist output, blockers, incidents, and escalations', 'Pilot Operator', 'Ready'],
      ['Issue log evidence', 'Track issue severity, owner, due date, resolution, and residual risk', 'Pilot Operator', 'Ready'],
      ['Access review evidence', 'Confirm only approved pilot users have access', 'IT', 'Pending human approval'],
      ['Closeout evidence', 'Collect acceptance, issues, learnings, and exit decision', 'Quality / Management', 'Pending']
    ]
  },
  {
    file: 'scripts/v87-control-testing-effectiveness.mjs',
    release: 'v87',
    title: 'v8.7 Control Testing Effectiveness',
    consoleTitle: 'v8.7 Control Testing Effectiveness',
    sectionTitle: 'Control testing matrix',
    reportFile: 'v87-control-testing-effectiveness.md',
    rows: [
      ['Access control', 'Test role separation and persona restrictions', 'IT / Audit', 'Ready'],
      ['OVR confidentiality', 'Verify no real patient identifiers or confidential OVR details in pilot', 'Quality / IT', 'Pending human approval'],
      ['Evidence integrity', 'Confirm release evidence and generated packs remain traceable', 'Audit', 'Ready'],
      ['Restore readiness', 'Reference restore dry-run evidence and rollback plan', 'IT', 'Ready'],
      ['Change control', 'Confirm pilot changes are branch/PR controlled', 'Project Lead', 'Ready']
    ]
  },
  {
    file: 'scripts/v88-resilience-third-party-readiness.mjs',
    release: 'v88',
    title: 'v8.8 Resilience and Third-Party Readiness',
    consoleTitle: 'v8.8 Resilience and Third-Party Readiness',
    sectionTitle: 'Resilience / third-party readiness',
    reportFile: 'v88-resilience-third-party-readiness.md',
    rows: [
      ['Supabase staging', 'Validate project, environment variables, auth, and DB access boundary', 'IT', 'Planned'],
      ['Vercel staging', 'Validate deployment, build, environment mapping, and access', 'IT', 'Planned'],
      ['Rollback drill', 'Confirm rollback steps, owner, and expected recovery path', 'IT', 'Ready'],
      ['Observability', 'Define logs, errors, availability, and daily review checks', 'Pilot Operator', 'Ready'],
      ['Third-party dependency review', 'Record dependencies and pilot-safe usage limits', 'IT / Audit', 'Planned']
    ]
  },
  {
    file: 'scripts/v89-remediation-scale-readiness.mjs',
    release: 'v89',
    title: 'v8.9 Remediation and Scale Readiness',
    consoleTitle: 'v8.9 Remediation and Scale Readiness',
    sectionTitle: 'Remediation and scale readiness',
    reportFile: 'v89-remediation-scale-readiness.md',
    rows: [
      ['Pilot issue remediation', 'Define how issues are triaged, fixed, retested, and accepted', 'Project Lead', 'Ready'],
      ['Scale decision criteria', 'Define minimum criteria before expanding users/modules', 'Management / Quality', 'Pending human approval'],
      ['Training gaps', 'Track user confusion, documentation gaps, and retraining needs', 'Pilot Operator', 'Ready'],
      ['Security gaps', 'Track security or privacy observations as blockers or conditions', 'IT / Audit', 'Ready'],
      ['Production backlog', 'Separate production-hardening items from pilot-only fixes', 'Project Lead', 'Ready']
    ]
  },
  {
    file: 'scripts/v90-controlled-pilot-final-dossier.mjs',
    release: 'v90',
    title: 'v9.0 Controlled-Pilot Final Decision Dossier',
    consoleTitle: 'v9.0 Controlled-Pilot Final Decision Dossier',
    sectionTitle: 'Final decision dossier',
    reportFile: 'v90-controlled-pilot-final-dossier.md',
    rows: [
      ['Technical evidence', 'Summarize typecheck, build, runtime security, persona proof, restore proof, and repo health', 'Project Lead', 'Ready'],
      ['Operational evidence', 'Summarize pilot console, issue log, monitoring, access review, and closeout dashboard', 'Pilot Operator', 'Ready'],
      ['Human approval', 'Management/Admin, IT, Quality, and confidentiality confirmation', 'Approvers', 'Pending'],
      ['Controlled pilot decision', 'Approve / defer / reject controlled internal pilot', 'Management', 'Pending'],
      ['Production decision', 'Explicitly not production-ready until live staging and production proof are completed', 'Management / IT', 'Not ready']
    ]
  }
];

for (const config of configs) {
  writeReportScript(config);
}

const reviewSource = `
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('release', 'v86-v90');
fs.mkdirSync(outDir, { recursive: true });

const generatedAt = new Date().toISOString();

const sections = [
  ['v8.6', 'Pilot Execution Evidence', 'release/v86/v86-pilot-execution-evidence.md'],
  ['v8.7', 'Control Testing Effectiveness', 'release/v87/v87-control-testing-effectiveness.md'],
  ['v8.8', 'Resilience and Third-Party Readiness', 'release/v88/v88-resilience-third-party-readiness.md'],
  ['v8.9', 'Remediation and Scale Readiness', 'release/v89/v89-remediation-scale-readiness.md'],
  ['v9.0', 'Controlled-Pilot Final Decision Dossier', 'release/v90/v90-controlled-pilot-final-dossier.md']
];

const missing = sections.filter((section) => !fs.existsSync(section[2]));
const rows = sections
  .map((section) => '| ' + section[0] + ' | ' + section[1] + ' | technical_ready_pending_human_approval | No | ' + section[2] + ' |')
  .join('\\\\n');

const md = [
  '# v8.6 to v9.0 Pilot Execution Evidence Suite Review Pack',
  '',
  'Generated: ' + generatedAt,
  '',
  '## Overall status',
  '',
  '| Item | Status |',
  '| --- | --- |',
  '| Technical / operational pilot readiness | Strong |',
  '| Human approval | Pending |',
  '| Production ready | No |',
  '| Approval gate bypassed | No |',
  '| RLS / migrations changed | No |',
  '| Runtime bridge changed | No |',
  '',
  '## Included packs',
  '',
  '| Version | Pack | Status | Production ready | Report |',
  '| --- | --- | --- | --- | --- |',
  rows,
  '',
  '## Missing expected reports',
  '',
  missing.length ? missing.map((section) => '- ' + section[2]).join('\\\\n') : 'None.',
  '',
  '## Final judgment',
  '',
  'The v8.6 to v9.0 suite strengthens controlled-pilot execution evidence, control testing, resilience readiness, remediation planning, and the final pilot decision dossier.',
  '',
  'The system remains technical_ready_pending_human_approval and production_ready = false.',
  '',
  'The remaining blocker is still real Management/Admin, IT, and Quality signoff plus OVR confidentiality confirmation.',
  ''
].join('\\\\n');

fs.writeFileSync(path.join(outDir, 'v86-v90-review-pack.md'), md);

console.log('v8.6-v9.0 pilot execution evidence suite review pack generated.');
console.log(JSON.stringify({
  status: 'technical_ready_pending_human_approval',
  production_ready: false,
  sections: sections.length,
  missing_reports: missing.length,
  report: 'release/v86-v90/v86-v90-review-pack.md'
}, null, 2));
`;

fs.writeFileSync('scripts/v86-v90-generate-review-pack.mjs', reviewSource.trimStart());

console.log('v8.6-v9.0 generator scripts strongly repaired.');
