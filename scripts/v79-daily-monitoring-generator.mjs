import { writeJson, writeText, mdTable, safeStatusJson } from './v79-common.mjs';
const rows = [["Environment","Application and login work"],["Access","Roster and roles reviewed"],["Data boundary","No real patient/confidential OVR data"],["Smoke checks","Core workflows open"],["Decision","Continue/restrict/pause/stop"]];
const result = safeStatusJson({ items: rows.length, report: 'release/v79/daily-monitoring-checklist.md' });
writeJson('daily-monitoring-checklist.json', result);
writeText('daily-monitoring-checklist.md', `# Daily Pilot Monitoring Checklist

Generated: ${result.generated_at}

Status: **${result.status}**

Production ready: **No**

${mdTable(['Item','Evidence / requirement'], rows)}

## Safety boundary

This output supports controlled pilot operation only. It does not replace human approval.
`);
console.log('v7.9 daily pilot monitoring checklist generated.');
console.log(JSON.stringify({ status: result.status, items: rows.length, report: result.report }, null, 2));
