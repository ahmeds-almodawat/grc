import { writeJson, writeText, safeStatusJson } from './v79-common.mjs';
const headers=['issue_id','date_reported','reporter','module','severity','description','reproduction_steps','expected_result','actual_result','owner','status','resolution_evidence'];
const result=safeStatusJson({fields:headers.length, report:'release/v79/pilot-issue-log-template.csv'});
writeText('pilot-issue-log-template.csv', headers.join(',')+'\n');
writeJson('pilot-issue-log-template.json', result);
writeText('pilot-issue-log-template.md', `# Pilot Issue Log Template\n\nStatus: **${result.status}**\n\nCritical issues require immediate escalation and may pause the pilot.\n`);
console.log('v7.9 pilot issue log template generated.');
console.log(JSON.stringify({status:result.status, fields:headers.length, report:result.report}, null, 2));
