import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v65');
fs.mkdirSync(outDir, { recursive: true });

const phases = [
  { id: 1, name: 'TypeScript foundation', command: 'npm run typecheck', failOnError: true },
  { id: 2, name: 'Production build', command: 'npm run build', failOnError: true },
  { id: 3, name: 'No-mock strict audit', command: 'npm run v60:strict', failOnError: true },
  { id: 4, name: 'Database security static proof', command: 'npm run v64:strict-all', failOnError: true },
  { id: 5, name: 'Test assets audit', command: 'npm run v65:assets', failOnError: true },
  { id: 6, name: 'Auth security smoke', command: 'npm run v65:auth', failOnError: true },
  { id: 7, name: 'Workflow contract tests', command: 'npm run v65:workflow', failOnError: true },
  { id: 8, name: 'Pilot readiness gate', command: 'npm run v65:pilot', failOnError: false }
];

const only = process.argv.find((arg) => arg.startsWith('--phase='));
const selected = only ? phases.filter((p) => String(p.id) === only.split('=')[1]) : phases;
const results = [];

for (const phase of selected) {
  console.log(`\n=== v6.5 phase ${phase.id}: ${phase.name} ===`);
  const result = spawnSync(phase.command, { shell: true, stdio: 'inherit', cwd: root });
  const passed = result.status === 0;
  const row = { id: phase.id, name: phase.name, command: phase.command, status: passed ? 'passed' : (phase.failOnError ? 'failed' : 'warning'), exit_code: result.status ?? 0 };
  results.push(row);
  if (!passed && phase.failOnError) break;
}

const summary = {
  generated_at: new Date().toISOString(),
  phases_run: results.length,
  phases_passed: results.filter((r) => r.status === 'passed').length,
  phases_warning: results.filter((r) => r.status === 'warning').length,
  phases_failed: results.filter((r) => r.status === 'failed').length,
  overall_passed: results.every((r) => r.status !== 'failed'),
  results
};

fs.writeFileSync(path.join(outDir, 'v65-phase-runner.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(outDir, 'V65_PHASE_RUNNER.md'), `# v6.5 Phase Runner\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n`);
console.log('\nv6.5 phase tests complete.');
console.log(JSON.stringify(summary, null, 2));
if (!summary.overall_passed) process.exit(1);
