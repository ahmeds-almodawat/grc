import { mdTable, proofSummary, signoffSummary, statusFromApprovals, writeJson, writeMd } from './v78-common.mjs';

const proof = proofSummary();
const signoff = signoffSummary();
const rows = [
  ['Local CI static', 'required', 'Run ci:static before staging deployment'],
  ['Supabase staging project', 'required', 'Must be non-production'],
  ['Frontend staging URL', 'required', 'Must point to staging Supabase only'],
  ['Synthetic data seed', 'required', 'No patient identifiers or confidential OVR data'],
  ['Persona smoke tests', 'required', 'Run approved personas only'],
  ['Rollback drill', 'required', 'Document rollback result'],
  ['Human approval', signoff.strict_passed ? 'complete' : 'pending', 'Required before controlled pilot go decision'],
];
const result = { generated_at: new Date().toISOString(), status: statusFromApprovals(), proof, signoff, checklist_count: rows.length };
writeJson('staging-execution-plan.json', result);
writeMd('staging-execution-plan.md', `# v7.8 Live Staging Execution Plan\n\nGenerated: ${result.generated_at}\n\nStatus: **${result.status}**\n\nProof suite status: **${proof.status}**\n\n${mdTable(['Item', 'State', 'Detail'], rows)}\n\n## Decision boundary\n\nThis plan prepares live staging execution only. It does not approve production rollout.`);
console.log('v7.8 live staging execution plan generated.');
console.log(JSON.stringify({ status: result.status, checklist_count: rows.length, report: 'release/v78/staging-execution-plan.md' }, null, 2));
