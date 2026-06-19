import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v66');
fs.mkdirSync(outDir, { recursive: true });

const steps = [
  { step: 1, title: 'Identify backup source', required_evidence: 'Database backup/export package location and timestamp', status: 'manual_required' },
  { step: 2, title: 'Restore database to staging', required_evidence: 'Restore command/log and target project reference', status: 'manual_required' },
  { step: 3, title: 'Verify critical table counts', required_evidence: 'Before/after counts for users, projects, tasks, OVR, evidence, approvals, roles', status: 'manual_required' },
  { step: 4, title: 'Verify evidence storage samples', required_evidence: 'At least 3 evidence files opened from restored storage', status: 'manual_required' },
  { step: 5, title: 'Run app smoke test after restore', required_evidence: 'Login, dashboard, OVR, tasks, evidence, reports smoke result', status: 'manual_required' },
  { step: 6, title: 'Document issues and signoff', required_evidence: 'Named IT owner signoff and issue list', status: 'manual_required' }
];

const report = {
  generated_at: new Date().toISOString(),
  dryrun_status: 'manual_evidence_required',
  steps
};

fs.writeFileSync(path.join(outDir, 'v66-restore-dryrun-evidence.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outDir, 'V66_RESTORE_DRYRUN_EVIDENCE.md'), `# v6.6 Restore Dry-Run Evidence\n\nStatus: **manual evidence required**\n\n${steps.map((s) => `## ${s.step}. ${s.title}\n\n- Status: \`${s.status}\`\n- Required evidence: ${s.required_evidence}\n`).join('\n')}\n`);

console.log('v6.6 restore dry-run evidence checklist generated.');
console.table(steps.map(({ step, title, status }) => ({ step, title, status })));
