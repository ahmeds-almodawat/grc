import { emitPack } from './v80-v85-common.mjs';

const data = emitPack({
  version: 'v84',
  title: 'v8.4 Training Change Management',
  rows: [["Training plan", "Role-based pilot training plan", "Pilot owner", "Complete before launch"], ["Communication pack", "User announcement language", "Management/Admin", "Send to pilot users"], ["Support escalation", "Support routing tree", "Pilot operator", "Use for issues"], ["Change controls", "Pilot change boundary", "IT / Quality", "No uncontrolled scope expansion"]],
  files: [],
  jsonName: 'v84-training-change-management.json',
  mdName: 'v84-training-change-management.md',
});

console.log('v8.4 Training Change Management generated.');
console.log(JSON.stringify({ status: data.status, production_ready: data.production_ready, report: `release/v84/v84-training-change-management.md` }, null, 2));
