import { spawnSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v60');
mkdirSync(releaseDir, { recursive: true });

const phases = [
  { id: 1, name: 'TypeScript foundation', command: 'npm run typecheck' },
  { id: 2, name: 'Production build', command: 'npm run build' },
  { id: 3, name: 'Runtime no-mock strict audit', command: 'npm run v60:strict' },
  { id: 4, name: 'Migration artifacts present', command: 'node scripts/v38-schema-doctor.mjs', optional: true },
  { id: 5, name: 'Backup strategy artifacts', command: 'node scripts/v50-backup-strategy-check.mjs', optional: true },
  { id: 6, name: 'Restore dry-run artifacts', command: 'node scripts/v50-restore-dryrun-audit.mjs', optional: true },
  { id: 7, name: 'Pilot readiness artifacts', command: 'node scripts/v58-pilot-readiness.mjs', optional: true }
];

function run(command, optional = false) {
  const result = spawnSync(command, { cwd: root, shell: true, stdio: 'inherit' });
  if (result.status !== 0 && optional) return { status: 'warning', exit_code: result.status ?? 1 };
  return { status: result.status === 0 ? 'passed' : 'failed', exit_code: result.status ?? 1 };
}

const results = [];
for (const p of phases) {
  console.log(`\n=== v6.0 phase ${p.id}: ${p.name} ===`);
  const r = run(p.command, p.optional);
  results.push({ ...p, ...r });
  if (r.status === 'failed') break;
}
const summary = {
  generated_at: new Date().toISOString(),
  phases_run: results.length,
  phases_passed: results.filter((r) => r.status === 'passed').length,
  phases_warning: results.filter((r) => r.status === 'warning').length,
  phases_failed: results.filter((r) => r.status === 'failed').length,
  overall_passed: results.every((r) => r.status === 'passed' || r.status === 'warning'),
  results
};
writeFileSync(path.join(releaseDir, 'v60-phase-results.json'), JSON.stringify(summary, null, 2));
console.log('\nv6.0 phased no-mock tests complete.');
console.log(JSON.stringify(summary, null, 2));
if (!summary.overall_passed) process.exit(1);
