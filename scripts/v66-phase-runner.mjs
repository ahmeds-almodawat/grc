import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v66');
fs.mkdirSync(outDir, { recursive: true });

function hasPackageScript(name) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    return Boolean(pkg.scripts?.[name]);
  } catch { return false; }
}

function run(command) {
  const result = spawnSync(command, { cwd: root, stdio: 'inherit', shell: true });
  return result.status ?? 1;
}

const phases = [
  { id: 1, name: 'TypeScript foundation', command: 'npm run typecheck', required: true },
  { id: 2, name: 'Production build', command: 'npm run build', required: true },
  { id: 3, name: 'No-mock strict audit', command: 'npm run v60:strict', required: true, onlyIfScript: 'v60:strict' },
  { id: 4, name: 'Database security static proof', command: 'npm run v64:strict-all', required: true, onlyIfScript: 'v64:strict-all' },
  { id: 5, name: 'Real unit/browser tests', command: 'npm run test:real', required: true, onlyIfScript: 'test:real' },
  { id: 6, name: 'Staging evidence register', command: 'npm run v66:evidence', required: true },
  { id: 7, name: 'Restore dry-run evidence checklist', command: 'npm run v66:restore', required: true },
  { id: 8, name: 'Controlled pilot package', command: 'npm run v66:pilot-package', required: true },
  { id: 9, name: 'Go/no-go gate', command: 'npm run v66:go-no-go', required: true }
];

const results = [];
for (const phase of phases) {
  if (phase.onlyIfScript && !hasPackageScript(phase.onlyIfScript)) {
    results.push({ ...phase, status: 'skipped', reason: `Missing package script ${phase.onlyIfScript}` });
    continue;
  }
  console.log(`\n=== v6.6 phase ${phase.id}: ${phase.name} ===`);
  const exitCode = run(phase.command);
  const status = exitCode === 0 ? 'passed' : 'failed';
  results.push({ ...phase, status, exit_code: exitCode });
  if (phase.required && exitCode !== 0) break;
}

const summary = {
  generated_at: new Date().toISOString(),
  phases_run: results.length,
  phases_passed: results.filter((r) => r.status === 'passed').length,
  phases_failed: results.filter((r) => r.status === 'failed').length,
  phases_skipped: results.filter((r) => r.status === 'skipped').length,
  overall_passed: results.every((r) => r.status !== 'failed'),
  controlled_pilot_note: 'v66:all passing does not mean full pilot approval. Manual staging evidence is still required unless v66:strict-proof passes.'
};
const report = { summary, results };
fs.writeFileSync(path.join(outDir, 'v66-phase-results.json'), JSON.stringify(report, null, 2));
console.log('\nv6.6 phase tests complete.');
console.log(JSON.stringify(summary, null, 2));
if (!summary.overall_passed) process.exit(1);
