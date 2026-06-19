import { mdTable, statusFromApprovals, writeJson, writeMd } from './v78-common.mjs';

const rows = [
  ['Admin reviewer', 'Can access admin/release/evidence areas'],
  ['IT reviewer', 'Can review security/environment evidence'],
  ['Quality reviewer', 'Can review OVR confidentiality and quality flows'],
  ['Audit reviewer', 'Can view audit/report evidence only'],
  ['Standard user', 'Cannot access privileged admin functions'],
  ['Unauthorized persona', 'Denied from restricted areas'],
];
const result = { generated_at: new Date().toISOString(), status: statusFromApprovals(), personas: rows.length };
writeJson('access-control-plan.json', result);
writeMd('access-control-plan.md', `# v7.8 Staging Access Control Plan\n\nGenerated: ${result.generated_at}\n\nStatus: **${result.status}**\n\n${mdTable(['Persona', 'Expected Boundary'], rows)}\n\n## Evidence\n\nCapture successful and denied access outcomes.`);
console.log('v7.8 access control plan generated.');
console.log(JSON.stringify({ status: result.status, personas: rows.length, report: 'release/v78/access-control-plan.md' }, null, 2));
