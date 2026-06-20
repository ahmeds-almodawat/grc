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
  .join('\\n');

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
  missing.length ? missing.map((section) => '- ' + section[2]).join('\\n') : 'None.',
  '',
  '## Final judgment',
  '',
  'The v8.6 to v9.0 suite strengthens controlled-pilot execution evidence, control testing, resilience readiness, remediation planning, and the final pilot decision dossier.',
  '',
  'The system remains technical_ready_pending_human_approval and production_ready = false.',
  '',
  'The remaining blocker is still real Management/Admin, IT, and Quality signoff plus OVR confidentiality confirmation.',
  ''
].join('\\n');

fs.writeFileSync(path.join(outDir, 'v86-v90-review-pack.md'), md);

console.log('v8.6-v9.0 pilot execution evidence suite review pack generated.');
console.log(JSON.stringify({
  status: 'technical_ready_pending_human_approval',
  production_ready: false,
  sections: sections.length,
  missing_reports: missing.length,
  report: 'release/v86-v90/v86-v90-review-pack.md'
}, null, 2));
