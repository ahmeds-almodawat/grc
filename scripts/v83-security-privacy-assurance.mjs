import { emitPack } from './v80-v85-common.mjs';

const data = emitPack({
  version: 'v83',
  title: 'v8.3 Security Privacy Assurance',
  rows: [["Privacy boundary", "No real patient/confidential OVR review", "Quality", "Required before pilot and daily"], ["Role access review", "Persona access checklist", "IT", "Review before and during pilot"], ["OVR minimization", "Synthetic OVR checklist", "Quality", "Required for all OVR testing"], ["Audit log review", "Daily audit review SOP", "IT / Audit", "Check unexpected activity"]],
  files: [],
  jsonName: 'v83-security-privacy-assurance.json',
  mdName: 'v83-security-privacy-assurance.md',
});

console.log('v8.3 Security Privacy Assurance generated.');
console.log(JSON.stringify({ status: data.status, production_ready: data.production_ready, report: `release/v83/v83-security-privacy-assurance.md` }, null, 2));
