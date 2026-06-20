import { STATUS_PENDING, writeReport } from './v96-common.mjs';

const report = writeReport('controlled-pilot-release-note.md', 'v9.6 Controlled-Pilot Release Note Draft', [
  '## Draft release note',
  '',
  'The GRC Control Center has completed technical, governance, evidence, and approval-support readiness for a controlled internal pilot using synthetic/non-confidential data only.',
  '',
  'The pilot remains blocked until real Management/Admin, IT, and Quality approval and OVR confidentiality confirmation are entered and strict proof passes.',
  '',
  '## Scope boundary',
  '',
  '- Controlled internal pilot only',
  '- 5-15 internal users only',
  '- No real patient identifiers',
  '- No confidential OVR details',
  '- No production rollout'
]);
console.log('v9.6 controlled-pilot release note generated.');
console.log(JSON.stringify({ status: STATUS_PENDING, production_ready: false, report }, null, 2));
