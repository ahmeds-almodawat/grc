import { writeJson, writeText, safeStatusJson } from './v79-common.mjs';
const sections=['pilot-operator-console.md','pilot-user-roster-template.md','daily-monitoring-checklist.md','pilot-issue-log-template.md','access-review-checklist.md','feedback-intake-pack.md','pilot-closeout-dashboard.md'];
const result=safeStatusJson({sections:sections.length, report:'release/v79/v79-review-pack.md'});
writeJson('v79-review-pack.json', result);
writeText('v79-review-pack.md', `# v7.9 Runtime Pilot Console Review Pack\n\nGenerated: ${result.generated_at}\n\nStatus: **${result.status}**\n\nProduction ready: **No**\n\n## Included outputs\n\n${sections.map(s=>`- \`release/v79/${s}\``).join('\n')}\n\n## Safety boundary\n\nThis pack supports pilot operation only and does not replace human signoff.\n`);
console.log('v7.9 review pack generated.');
console.log(JSON.stringify({status:result.status, sections:sections.length, report:result.report}, null, 2));
