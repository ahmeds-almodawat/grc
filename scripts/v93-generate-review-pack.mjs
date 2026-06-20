import { STATUS, PRODUCTION_READY, exists, writeJson, writeMd, table, printResult } from './v93-common.mjs';

const reports = [
  ['Gate snapshot', 'release/v93/gate-snapshot.md'],
  ['Approval packet index', 'release/v93/approval-packet-index.md'],
  ['Approver task board', 'release/v93/approver-task-board.md'],
  ['Signoff JSON guide', 'release/v93/signoff-json-guide.md'],
  ['Release freeze check', 'release/v93/release-freeze-check.md'],
  ['Post-approval proof protocol', 'release/v93/post-approval-proof-protocol.md'],
  ['Final approval command center', 'release/v93/final-approval-command-center.md']
];

const rows = reports.map(([name, file]) => [name, file, exists(file) ? 'Available' : 'Missing']);
const missing = rows.filter((row) => row[2] === 'Missing');

writeJson('release/v93/v93-review-pack.json', {
  generated_at: new Date().toISOString(),
  status: STATUS,
  production_ready: PRODUCTION_READY,
  reports: rows.map(([name, file, availability]) => ({ name, file, availability })),
  missing_reports: missing.length
});

writeMd('release/v93/v93-review-pack.md', [
  '# v9.3 Final Approval Command Center Review Pack',
  '',
  ...table(['Report', 'Path', 'Availability'], rows),
  '',
  '## Final judgment',
  '',
  'v9.3 organizes the final manual approval gate. It does not complete approvals and does not change production readiness.',
  '',
  ...table(['Item', 'Value'], [
    ['Status', STATUS],
    ['Production ready', String(PRODUCTION_READY)],
    ['Missing reports', String(missing.length)],
    ['Approval gate bypassed', 'No']
  ]),
  ''
]);

printResult('v9.3 review pack generated.', {
  status: STATUS,
  production_ready: PRODUCTION_READY,
  missing_reports: missing.length,
  report: 'release/v93/v93-review-pack.md'
});
