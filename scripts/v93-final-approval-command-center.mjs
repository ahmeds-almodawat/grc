import { STATUS, PRODUCTION_READY, proofSummary, signoffPaths, exists, writeJson, writeMd, table, printResult } from './v93-common.mjs';

const proof = proofSummary();
const paths = signoffPaths();
const blockers = [
  ['Human approval', 'Management/Admin, IT, and Quality approval must be real and valid', 'Pending'],
  ['OVR confidentiality', 'IT and Quality must confirm no real patient identifiers or confidential OVR details', 'Pending'],
  ['Strict gate', 'v66:strict-proof must pass after real approvals', proof.failed_commands.includes('v66:strict-proof') ? 'Pending' : 'Unknown/possibly passed'],
  ['Production boundary', 'Production remains out of scope', 'Enforced']
];

const result = {
  generated_at: new Date().toISOString(),
  status: STATUS,
  production_ready: PRODUCTION_READY,
  proof,
  approval_files: paths,
  blockers: blockers.map(([area, requirement, state]) => ({ area, requirement, state }))
};

writeJson('release/v93/final-approval-command-center.json', result);
writeMd('release/v93/final-approval-command-center.md', [
  '# v9.3 Final Approval Command Center',
  '',
  'Generated: ' + result.generated_at,
  '',
  ...table(['Item', 'Value'], [
    ['Status', STATUS],
    ['Production ready', String(PRODUCTION_READY)],
    ['Proof status', String(proof.status)],
    ['Proof passed count', String(proof.passed_count)],
    ['Proof failed count', String(proof.failed_count)],
    ['Pilot signoff file', exists(paths.pilotSignoff) ? paths.pilotSignoff : 'Missing'],
    ['Confidentiality file', exists(paths.confidentiality) ? paths.confidentiality : 'Missing']
  ]),
  '',
  '## Blocker board',
  '',
  ...table(['Area', 'Requirement', 'State'], blockers),
  '',
  '## Decision',
  '',
  'Do not add more planning packs if the only remaining blocker is missing real approval data. Complete the approval files, then run the post-approval proof protocol.',
  ''
]);

printResult('v9.3 final approval command center generated.', {
  status: STATUS,
  production_ready: PRODUCTION_READY,
  blockers: blockers.length,
  report: 'release/v93/final-approval-command-center.md'
});
