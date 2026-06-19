import { mdTable, statusFromApprovals, writeJson, writeMd } from './v78-common.mjs';

const rows = [
  ['Previous deployment identified', 'required'],
  ['Rollback owner assigned', 'required'],
  ['Rollback command/process documented', 'required'],
  ['Smoke test after rollback documented', 'required'],
  ['No production dependency touched', 'required'],
];
const result = { generated_at: new Date().toISOString(), status: statusFromApprovals(), controls: rows.length };
writeJson('rollback-readiness.json', result);
writeMd('rollback-readiness.md', `# v7.8 Rollback Readiness\n\nGenerated: ${result.generated_at}\n\nStatus: **${result.status}**\n\n${mdTable(['Control', 'Requirement'], rows)}\n\n## Pass rule\n\nA staging deployment is not considered ready unless rollback has an owner and a tested path.`);
console.log('v7.8 rollback readiness generated.');
console.log(JSON.stringify({ status: result.status, controls: rows.length, report: 'release/v78/rollback-readiness.md' }, null, 2));
