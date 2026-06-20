import { writeJson, writeText, mdTable, safeStatusJson } from './v79-common.mjs';
const rows = [["Bug","Runtime defect"],["Usability","User experience issue"],["Missing feature","Capability gap"],["Training","Guidance needed"],["Data concern","Potential data handling issue"]];
const result = safeStatusJson({ items: rows.length, report: 'release/v79/feedback-intake-pack.md' });
writeJson('feedback-intake-pack.json', result);
writeText('feedback-intake-pack.md', `# Pilot Feedback Intake Pack

Generated: ${result.generated_at}

Status: **${result.status}**

Production ready: **No**

${mdTable(['Item','Evidence / requirement'], rows)}

## Safety boundary

This output supports controlled pilot operation only. It does not replace human approval.
`);
console.log('v7.9 pilot feedback intake pack generated.');
console.log(JSON.stringify({ status: result.status, items: rows.length, report: result.report }, null, 2));
