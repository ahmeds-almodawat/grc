import { emitPack } from './v80-v85-common.mjs';

const data = emitPack({
  version: 'v80',
  title: 'v8.0 Pilot Launch Governance',
  rows: [["Pilot charter", "Controlled pilot scope and non-goals", "Management/Admin", "Review before signoff meeting"], ["Launch agenda", "Approval meeting agenda", "Pilot owner", "Use for Management/Admin, IT, Quality review"], ["Day-0 / Day-1 runbook", "Launch execution checklist", "Pilot operator", "Use only after real approval"], ["KPI dictionary", "Daily KPI definitions", "Quality / Operations", "Track pilot only"], ["Exception register", "Exception control template", "Pilot owner", "No exception may allow real patient data"]],
  files: [],
  jsonName: 'v80-pilot-launch-governance.json',
  mdName: 'v80-pilot-launch-governance.md',
});

console.log('v8.0 Pilot Launch Governance generated.');
console.log(JSON.stringify({ status: data.status, production_ready: data.production_ready, report: `release/v80/v80-pilot-launch-governance.md` }, null, 2));
