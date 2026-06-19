import fs from 'fs';
import path from 'path';

const releaseDir = path.resolve('release');
fs.mkdirSync(releaseDir, { recursive: true });

const phases = [
  { phase: 1, code: 'LOCAL_BUILD', title: 'Local build foundation', command: 'npm run test:phase1', gate: 'typecheck and build must pass' },
  { phase: 2, code: 'NO_MOCK', title: 'No-mock audit', command: 'npm run test:phase2', gate: 'mock audit and removal plan generated' },
  { phase: 3, code: 'MIGRATIONS', title: 'Migration/schema artifact check', command: 'npm run test:phase3', gate: 'migration files and v5.9 migration exist' },
  { phase: 4, code: 'WORKFLOWS', title: 'Workflow artifact check', command: 'npm run test:phase4', gate: 'main business module files exist' },
  { phase: 5, code: 'BACKUP_RESTORE', title: 'Backup/restore proof artifacts', command: 'npm run test:phase5', gate: 'backup and restore scripts run locally' },
  { phase: 6, code: 'PILOT_READY', title: 'Pilot readiness artifacts', command: 'npm run test:phase6', gate: 'pilot/rollout/security artifacts exist and run' }
];

fs.writeFileSync(path.join(releaseDir, 'v59-test-plan.json'), JSON.stringify({ generated_at: new Date().toISOString(), phases }, null, 2));

const md = ['# v5.9 Phased Auto-Test Plan', ''];
for (const p of phases) {
  md.push(`## Phase ${p.phase} — ${p.title}`);
  md.push('');
  md.push(`- Code: \`${p.code}\``);
  md.push(`- Command: \`${p.command}\``);
  md.push(`- Gate: ${p.gate}`);
  md.push('');
}
md.push('## Run all');
md.push('');
md.push('```bash');
md.push('npm run test:phases');
md.push('```');

fs.writeFileSync(path.join(releaseDir, 'v59-test-plan.md'), md.join('\n'));
console.log('v5.9 phased test plan generated under release/.');
