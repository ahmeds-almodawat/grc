import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v66');
fs.mkdirSync(outDir, { recursive: true });

const issueCsv = `Issue ID,Date,Reporter,Module,Severity,Description,Owner,Target Date,Status,Resolution\nPILOT-001,,,,,,,,Open,\n`;
const rosterCsv = `User Name,Email,Department,Role,Persona,Wave,Status,Notes\n,,,,Admin,Wave 1,Planned,\n,,,,Manager,Wave 1,Planned,\n,,,,Employee,Wave 1,Planned,\n`;
const signoff = `# v6.6 Controlled Pilot Signoff\n\nDo not mark go/no-go as approved until staging persona SQL, workflow SQL, restore dry-run, and test evidence are attached.\n\n| Role | Name | Decision | Date | Notes |\n|---|---|---|---|---|\n| IT Owner |  | Pending |  |  |\n| Quality Owner |  | Pending |  |  |\n| Admin / Operations Owner |  | Pending |  |  |\n| Executive Sponsor |  | Pending |  |  |\n\n## Go / No-Go Decision\n\n- Decision: Pending\n- Pilot size approved: 5–15 users only until further approval\n- Real patient/OVR confidential data allowed: No\n`;
const runbook = `# v6.6 Controlled Pilot Day-1 Runbook\n\n## Scope\n\nUse 5–15 trusted users in staging or controlled internal environment only. Do not enter real patient identifiers or confidential OVR details until persona tests and restore dry-run are verified.\n\n## Day-1 sequence\n\n1. Confirm migrations through 044/045 in staging.\n2. Confirm local evidence: typecheck, build, no-mock strict, v64 strict, test:real.\n3. Run Supabase persona SQL tests.\n4. Run workflow SQL smoke tests.\n5. Confirm backup and restore dry-run evidence.\n6. Load pilot roster.\n7. Hold 30-minute orientation.\n8. Test: login, dashboard, my tasks, evidence, OVR test record, reports.\n9. Record every issue in v66-pilot-issue-log.csv.\n10. Daily review by IT + Quality + Admin.\n\n## Stop conditions\n\n- Any role can access unrelated confidential data.\n- OVR confidential data visible to unauthorized user.\n- Evidence files visible outside role scope.\n- Backup/restore cannot be completed.\n- Any critical defect affecting data integrity.\n`;

fs.writeFileSync(path.join(outDir, 'v66-pilot-issue-log.csv'), issueCsv);
fs.writeFileSync(path.join(outDir, 'v66-pilot-roster-template.csv'), rosterCsv);
fs.writeFileSync(path.join(outDir, 'V66_CONTROLLED_PILOT_SIGNOFF.md'), signoff);
fs.writeFileSync(path.join(outDir, 'V66_DAY1_RUNBOOK.md'), runbook);

const summary = {
  generated_at: new Date().toISOString(),
  files_generated: [
    'release/v66/v66-pilot-issue-log.csv',
    'release/v66/v66-pilot-roster-template.csv',
    'release/v66/V66_CONTROLLED_PILOT_SIGNOFF.md',
    'release/v66/V66_DAY1_RUNBOOK.md'
  ],
  pilot_scope: '5-15 trusted users only',
  confidential_data_rule: 'Do not use real patient identifiers or confidential OVR data until staging proof is complete.'
};
fs.writeFileSync(path.join(outDir, 'v66-controlled-pilot-package.json'), JSON.stringify(summary, null, 2));

console.log('v6.6 controlled pilot package generated.');
console.log(JSON.stringify(summary, null, 2));
