import { writeJson, writeText, mdTable, safeStatusJson } from './v79-common.mjs';
const rows = [["Active users","Roster equals actual access"],["Roles","Expected role/persona only"],["Privileged actions","Controlled"],["OVR/evidence","No unauthorized visibility"]];
const result = safeStatusJson({ items: rows.length, report: 'release/v79/access-review-checklist.md' });
writeJson('access-review-checklist.json', result);
writeText('access-review-checklist.md', `# Pilot Access Review Checklist

Generated: ${result.generated_at}

Status: **${result.status}**

Production ready: **No**

${mdTable(['Item','Evidence / requirement'], rows)}

## Safety boundary

This output supports controlled pilot operation only. It does not replace human approval.
`);
console.log('v7.9 pilot access review checklist generated.');
console.log(JSON.stringify({ status: result.status, items: rows.length, report: result.report }, null, 2));
