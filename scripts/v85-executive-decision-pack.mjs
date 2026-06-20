import { emitPack } from './v80-v85-common.mjs';

const data = emitPack({
  version: 'v85',
  title: 'v8.5 Executive Decision Pack',
  rows: [["Go/no-go memo", "Executive decision memo", "Management/Admin", "Use for approval meeting"], ["Scale-up decision tree", "Post-pilot decision logic", "Management/Admin", "Use after pilot closeout"], ["Production gap register", "Known production readiness gaps", "IT / Quality", "Track before production"], ["Decision boundary", "Controlled pilot only", "Management/Admin", "Production ready remains false"]],
  files: [],
  jsonName: 'v85-executive-decision-pack.json',
  mdName: 'v85-executive-decision-pack.md',
});

console.log('v8.5 Executive Decision Pack generated.');
console.log(JSON.stringify({ status: data.status, production_ready: data.production_ready, report: `release/v85/v85-executive-decision-pack.md` }, null, 2));
