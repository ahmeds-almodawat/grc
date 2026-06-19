import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const root = process.cwd();
const releaseDir = path.join(root, 'release');
fs.mkdirSync(releaseDir, { recursive: true });

const args = process.argv.slice(2);
const runAll = args.includes('--all');
const phaseArg = args.find(a => a.startsWith('--phase='));
const selectedPhase = phaseArg ? Number(phaseArg.split('=')[1]) : null;

const results = [];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function listFiles(rel, predicate = () => true) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter(predicate);
}

function runCommand(label, command, commandArgs, options = {}) {
  const started = Date.now();
  const child = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: options.silent ? 'pipe' : 'inherit',
    shell: process.platform === 'win32'
  });
  return {
    label,
    command: [command, ...commandArgs].join(' '),
    passed: child.status === 0,
    exit_code: child.status,
    duration_ms: Date.now() - started,
    stdout: options.silent ? String(child.stdout || '').slice(0, 4000) : undefined,
    stderr: options.silent ? String(child.stderr || '').slice(0, 4000) : undefined
  };
}

function record(phase, name, checks) {
  const passed = checks.every(c => c.passed);
  const item = { phase, name, passed, checks };
  results.push(item);
  return item;
}

function checkFile(rel, label = rel) {
  return { label, passed: exists(rel), detail: exists(rel) ? 'found' : 'missing' };
}

function phase1() {
  const checks = [];
  checks.push(runCommand('TypeScript check', 'npm', ['run', 'typecheck']));
  checks.push(runCommand('Production build', 'npm', ['run', 'build']));
  checks.push(checkFile('dist/index.html', 'dist/index.html generated'));
  const jsAssets = exists('dist/assets') ? listFiles('dist/assets', f => f.endsWith('.js')) : [];
  checks.push({ label: 'JS assets generated', passed: jsAssets.length > 0, detail: `${jsAssets.length} JS assets` });
  return record(1, 'Local build foundation', checks);
}

function phase2() {
  const checks = [];
  checks.push(runCommand('No-mock static audit', 'node', ['scripts/v59-audit-mock-data.mjs']));
  checks.push(runCommand('Mock cleanup plan', 'node', ['scripts/v59-clean-mock-suggestions.mjs']));
  checks.push(checkFile('release/v59-no-mock-audit.json', 'No-mock audit JSON'));
  checks.push(checkFile('release/v59-mock-removal-plan.md', 'Mock removal plan'));
  return record(2, 'No-mock audit', checks);
}

function phase3() {
  const migrationFiles = listFiles('supabase/migrations', f => f.endsWith('.sql'));
  const duplicates = migrationFiles.filter((f, i) => migrationFiles.indexOf(f) !== i);
  const checks = [
    checkFile('supabase/migrations', 'Migrations folder'),
    { label: 'Migration count >= 30', passed: migrationFiles.length >= 30, detail: `${migrationFiles.length} migration files` },
    { label: 'v5.9 migration exists', passed: migrationFiles.some(f => f.includes('038_v59_no_mock_phased_auto_tests')), detail: migrationFiles.find(f => f.includes('038_v59_no_mock_phased_auto_tests')) || 'missing' },
    { label: 'No duplicate migration filenames', passed: duplicates.length === 0, detail: duplicates.join(', ') || 'none' }
  ];
  return record(3, 'Migration/schema artifact check', checks);
}

function phase4() {
  const requiredAny = [
    { label: 'OVR artifacts', patterns: ['OVR', 'Ovr', 'ovr'] },
    { label: 'Risk artifacts', patterns: ['Risk', 'risk'] },
    { label: 'Compliance artifacts', patterns: ['Compliance', 'compliance'] },
    { label: 'Audit artifacts', patterns: ['Audit', 'audit'] },
    { label: 'Export/Backup artifacts', patterns: ['Export', 'Backup', 'export', 'backup'] },
    { label: 'Pilot/Rollout artifacts', patterns: ['Pilot', 'Rollout', 'pilot', 'rollout'] }
  ];
  const srcFiles = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else srcFiles.push(path.relative(root, full).replaceAll('\\', '/'));
    }
  }
  walk(path.join(root, 'src'));
  const checks = requiredAny.map(item => {
    const hits = srcFiles.filter(f => item.patterns.some(p => f.includes(p)));
    return { label: item.label, passed: hits.length > 0, detail: `${hits.length} file(s)` };
  });
  return record(4, 'Workflow artifact check', checks);
}

function phase5() {
  const checks = [
    checkFile('scripts/v50-backup-strategy-check.mjs', 'v50 backup strategy script'),
    checkFile('scripts/v50-restore-dryrun-audit.mjs', 'v50 restore dry-run script'),
    checkFile('release', 'Release folder'),
    runCommand('Backup strategy check', 'node', ['scripts/v50-backup-strategy-check.mjs']),
    runCommand('Restore dry-run check', 'node', ['scripts/v50-restore-dryrun-audit.mjs'])
  ];
  return record(5, 'Backup/restore proof artifacts', checks);
}

function phase6() {
  const checks = [
    { label: 'Pilot script exists', passed: exists('scripts/v58-pilot-readiness.mjs') || exists('scripts/v35-consolidation-audit.mjs'), detail: 'v58 or v35 pilot/consolidation script' },
    { label: 'Rollout script exists', passed: exists('scripts/v58-rollout-readiness.mjs'), detail: 'v58 rollout readiness' },
    { label: 'Security review script exists', passed: exists('scripts/v58-security-review.mjs'), detail: 'v58 security review' },
    { label: 'Pilot docs exist', passed: exists('docs/V55_PILOT_EXECUTION_GUIDE.md') || exists('docs/V34_PILOT_ROLLOUT_RUNBOOK.md'), detail: 'pilot execution docs' }
  ];
  if (exists('scripts/v58-pilot-readiness.mjs')) checks.push(runCommand('Pilot readiness script', 'node', ['scripts/v58-pilot-readiness.mjs']));
  if (exists('scripts/v58-rollout-readiness.mjs')) checks.push(runCommand('Rollout readiness script', 'node', ['scripts/v58-rollout-readiness.mjs']));
  if (exists('scripts/v58-security-review.mjs')) checks.push(runCommand('Security review script', 'node', ['scripts/v58-security-review.mjs']));
  return record(6, 'Pilot readiness artifacts', checks);
}

const phaseFns = { 1: phase1, 2: phase2, 3: phase3, 4: phase4, 5: phase5, 6: phase6 };

if (runAll) {
  for (const phase of [1, 2, 3, 4, 5, 6]) phaseFns[phase]();
} else if (selectedPhase && phaseFns[selectedPhase]) {
  phaseFns[selectedPhase]();
} else {
  console.error('Use --all or --phase=1..6');
  process.exit(1);
}

const summary = {
  generated_at: new Date().toISOString(),
  phases_run: results.length,
  phases_passed: results.filter(r => r.passed).length,
  phases_failed: results.filter(r => !r.passed).length,
  overall_passed: results.every(r => r.passed)
};

fs.writeFileSync(path.join(releaseDir, 'v59-phase-test-results.json'), JSON.stringify({ summary, results }, null, 2));

const md = ['# v5.9 Phased Test Report', '', `Generated: ${summary.generated_at}`, '', `Overall: ${summary.overall_passed ? 'PASS' : 'FAIL'}`, ''];
for (const result of results) {
  md.push(`## Phase ${result.phase}: ${result.name} — ${result.passed ? 'PASS' : 'FAIL'}`);
  md.push('');
  for (const check of result.checks) {
    md.push(`- ${check.passed ? '✅' : '❌'} ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
  }
  md.push('');
}
fs.writeFileSync(path.join(releaseDir, 'v59-phase-test-report.md'), md.join('\n'));

console.log('v5.9 phased tests complete.');
console.log(JSON.stringify(summary, null, 2));

if (!summary.overall_passed) process.exit(1);
