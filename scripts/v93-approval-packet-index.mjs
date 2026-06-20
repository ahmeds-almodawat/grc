import { STATUS, PRODUCTION_READY, exists, writeJson, writeMd, table, printResult } from './v93-common.mjs';

const evidenceItems = [
  ['Proof suite summary', 'release/v700/proof-suite-all.json'],
  ['Runtime security bridge audit', 'release/v700/runtime-security-bridge-audit.json'],
  ['Authenticated persona proof', 'release/v72/real-authenticated-persona-proof.json'],
  ['Restore integrity dry-run', 'release/v674/restore-integrity-dryrun.json'],
  ['Approval readiness lint', 'release/v91/approval-readiness-lint.md'],
  ['Approval field map', 'release/v92/approval-field-map.md'],
  ['Pilot signoff JSON', 'release/v674/approvals/pilot-signoff.json'],
  ['OVR confidentiality JSON', 'release/v674/approvals/ovr-confidentiality-confirmation.json']
];

const rows = evidenceItems.map(([name, file]) => [name, file, exists(file) ? 'Available' : 'Missing or generated under another filename']);
const missing = rows.filter((row) => !row[2].startsWith('Available'));

writeJson('release/v93/approval-packet-index.json', {
  generated_at: new Date().toISOString(),
  status: STATUS,
  production_ready: PRODUCTION_READY,
  total_items: rows.length,
  missing_count: missing.length,
  items: rows.map(([name, file, availability]) => ({ name, file, availability }))
});

writeMd('release/v93/approval-packet-index.md', [
  '# v9.3 Approval Packet Index',
  '',
  'This index lists the final packet items reviewers should use before completing real approval files.',
  '',
  ...table(['Evidence item', 'Path', 'Availability'], rows),
  '',
  '## Reminder',
  '',
  'Missing generated support files do not mean approval can be bypassed. Real approval files remain mandatory.',
  ''
]);

printResult('v9.3 approval packet index generated.', {
  status: STATUS,
  production_ready: PRODUCTION_READY,
  evidence_items: rows.length,
  missing_count: missing.length,
  report: 'release/v93/approval-packet-index.md'
});
