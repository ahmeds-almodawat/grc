import { writeJson, writeText, mdTable, safeStatusJson } from './v79-common.mjs';
const rows = [["Technical stability","No critical runtime issues"],["User acceptance","Scenarios complete"],["Security","No unauthorized access"],["Evidence","Daily logs complete"],["Decision","Next phase recommendation"]];
const result = safeStatusJson({ items: rows.length, report: 'release/v79/pilot-closeout-dashboard.md' });
writeJson('pilot-closeout-dashboard.json', result);
writeText('pilot-closeout-dashboard.md', `# Pilot Closeout Dashboard

Generated: ${result.generated_at}

Status: **${result.status}**

Production ready: **No**

${mdTable(['Item','Evidence / requirement'], rows)}

## Safety boundary

This output supports controlled pilot operation only. It does not replace human approval.
`);
console.log('v7.9 pilot closeout dashboard generated.');
console.log(JSON.stringify({ status: result.status, items: rows.length, report: result.report }, null, 2));
