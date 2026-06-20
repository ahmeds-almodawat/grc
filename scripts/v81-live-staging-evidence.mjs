import { emitPack } from './v80-v85-common.mjs';

const data = emitPack({
  version: 'v81',
  title: 'v8.1 Live Staging Evidence',
  rows: [["Smoke evidence", "Structured smoke execution sheet", "IT / Quality", "Use in staging validation session"], ["Access log", "Controlled staging access log", "IT", "Confirm pilot users only"], ["Rollback evidence", "Rollback proof sheet", "IT", "Capture rollback drill evidence"], ["Evidence rules", "No real patient or confidential OVR data", "Quality", "Mandatory during staging"]],
  files: [],
  jsonName: 'v81-live-staging-evidence.json',
  mdName: 'v81-live-staging-evidence.md',
});

console.log('v8.1 Live Staging Evidence generated.');
console.log(JSON.stringify({ status: data.status, production_ready: data.production_ready, report: `release/v81/v81-live-staging-evidence.md` }, null, 2));
