import { STATUS, PRODUCTION_READY, proofSummary, signoffPaths, exists, writeJson, writeMd, table, printResult } from './v93-common.mjs';

const paths = signoffPaths();
const proof = proofSummary();

const snapshot = {
  generated_at: new Date().toISOString(),
  status: STATUS,
  production_ready: PRODUCTION_READY,
  proof,
  approval_files: {
    pilot_signoff_exists: exists(paths.pilotSignoff),
    confidentiality_exists: exists(paths.confidentiality),
    pilot_signoff_path: paths.pilotSignoff,
    confidentiality_path: paths.confidentiality
  },
  final_blocker: 'real Management/Admin, IT, Quality approval and OVR confidentiality confirmation'
};

writeJson('release/v93/gate-snapshot.json', snapshot);
writeMd('release/v93/gate-snapshot.md', [
  '# v9.3 Gate Snapshot',
  '',
  'Generated: ' + snapshot.generated_at,
  '',
  ...table(['Item', 'Value'], [
    ['Status', STATUS],
    ['Production ready', String(PRODUCTION_READY)],
    ['Proof status', String(proof.status)],
    ['Passed count', String(proof.passed_count)],
    ['Failed count', String(proof.failed_count)],
    ['Failed commands', proof.failed_commands.length ? proof.failed_commands.join(', ') : 'None or unknown'],
    ['Pilot signoff file', exists(paths.pilotSignoff) ? 'Exists' : 'Missing'],
    ['Confidentiality file', exists(paths.confidentiality) ? 'Exists' : 'Missing']
  ]),
  '',
  '## Final blocker',
  '',
  snapshot.final_blocker,
  ''
]);

printResult('v9.3 gate snapshot generated.', {
  status: STATUS,
  production_ready: PRODUCTION_READY,
  proof_failed_count: proof.failed_count,
  report: 'release/v93/gate-snapshot.md'
});
