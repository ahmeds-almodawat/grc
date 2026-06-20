import { emitPack } from './v80-v85-common.mjs';

const data = emitPack({
  version: 'v82',
  title: 'v8.2 Pilot Operations KPI',
  rows: [["Daily dashboard", "Daily KPI checklist", "Pilot operator", "Use every pilot day"], ["Weekly review", "Weekly management template", "Management/Admin", "Use for continue/hold decision"], ["Defect triage", "Severity and routing SOP", "Pilot operator", "Critical issues trigger hold review"], ["Evidence completeness", "Evidence capture KPI", "Quality", "Track missing evidence"]],
  files: [],
  jsonName: 'v82-pilot-operations-kpi.json',
  mdName: 'v82-pilot-operations-kpi.md',
});

console.log('v8.2 Pilot Operations KPI generated.');
console.log(JSON.stringify({ status: data.status, production_ready: data.production_ready, report: `release/v82/v82-pilot-operations-kpi.md` }, null, 2));
