import { mdTable, statusFromApprovals, writeJson, writeMd } from './v78-common.mjs';

const rows = [
  ['Frontend errors', 'Monitor console/runtime errors during smoke tests'],
  ['Auth failures', 'Track expected vs unexpected failures'],
  ['Edge bridge errors', 'Monitor privileged action bridge calls'],
  ['RPC failures', 'Track unexpected database call failures'],
  ['Permission denied events', 'Confirm expected denials are logged'],
  ['Rollback result', 'Capture outcome and time to recover'],
];
const result = { generated_at: new Date().toISOString(), status: statusFromApprovals(), monitors: rows.length };
writeJson('observability-plan.json', result);
writeMd('observability-plan.md', `# v7.8 Staging Observability Plan\n\nGenerated: ${result.generated_at}\n\nStatus: **${result.status}**\n\n${mdTable(['Area', 'Evidence'], rows)}`);
console.log('v7.8 observability plan generated.');
console.log(JSON.stringify({ status: result.status, monitors: rows.length, report: 'release/v78/observability-plan.md' }, null, 2));
