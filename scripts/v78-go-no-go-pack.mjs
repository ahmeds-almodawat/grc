import { mdTable, proofSummary, signoffSummary, statusFromApprovals, writeJson, writeMd } from './v78-common.mjs';

const proof = proofSummary();
const signoff = signoffSummary();
const rows = [
  ['Technical proof suite', proof.status, `Passed: ${proof.passed_count ?? '-'}, Failed: ${proof.failed_count ?? '-'}`],
  ['Human pilot signoff', signoff.signoff_valid ? 'complete' : 'pending', 'Management/Admin, IT, Quality'],
  ['OVR confidentiality confirmation', signoff.confidentiality_valid ? 'complete' : 'pending', 'IT and Quality confidentiality reviewers'],
  ['Production readiness', 'not ready', 'Separate production proof required'],
];
const result = { generated_at: new Date().toISOString(), status: statusFromApprovals(), proof, signoff };
writeJson('go-no-go-pack.json', result);
writeMd('go-no-go-pack.md', `# v7.8 Staging Go/No-Go Pack\n\nGenerated: ${result.generated_at}\n\nStatus: **${result.status}**\n\n${mdTable(['Gate', 'Status', 'Detail'], rows)}\n\n## Allowed decisions\n\n- Go for controlled internal pilot after real approvals.\n- Go with conditions after documented remediation.\n- No-go pending remediation.\n\nProduction rollout is not in scope.`);
console.log('v7.8 go/no-go pack generated.');
console.log(JSON.stringify({ status: result.status, report: 'release/v78/go-no-go-pack.md' }, null, 2));
