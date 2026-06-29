import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v700');
fs.mkdirSync(outDir, { recursive: true });
const mode = process.argv[2] || 'all';
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const scripts = pkg.scripts || {};

const groups = {
  technical: ['typecheck', 'build', 'v62:static-strict', 'v64:strict-all', 'v673:security-definer-audit', 'v700:v65-audit'],
  'runtime-security': ['v700:rpc-inventory', 'v700:runtime-security'],
  personas: ['v72:persona-proof', 'v700:persona-gap'],
  restore: ['v674:restore-dryrun', 'v674:signoff-check'],
  pilot: ['v672:capture', 'v662:strict-proof', 'v661:strict-proof', 'v66:strict-proof', 'v663:progress-audit']
};

function resolveGroups(selected) {
  if (selected === 'all') return ['technical', 'runtime-security', 'personas', 'restore', 'pilot'];
  if (groups[selected]) return [selected];
  console.error(`Unknown proof suite mode: ${selected}`);
  process.exit(1);
}

const selectedGroups = resolveGroups(mode);
const results = [];
const npmRunner = process.platform === 'win32'
  ? { command: 'cmd.exe', argsPrefix: ['/d', '/s', '/c', 'npm'] }
  : { command: 'npm', argsPrefix: [] };

for (const group of selectedGroups) {
  for (const scriptName of groups[group]) {
    if (!scripts[scriptName]) {
      results.push({ group, script: scriptName, status: 'skipped_missing_package_script' });
      continue;
    }
    console.log(`\n=== npm run ${scriptName} ===`);
    const r = spawnSync(npmRunner.command, [...npmRunner.argsPrefix, 'run', scriptName], {
      cwd: root,
      stdio: 'inherit',
      shell: false
    });
    results.push({ group, script: scriptName, status: r.status === 0 ? 'passed' : 'failed', exit_code: r.status });
  }
}

const failed = results.filter(r => r.status === 'failed');
const skipped = results.filter(r => r.status === 'skipped_missing_package_script');
const report = {
  generated_at: new Date().toISOString(),
  mode,
  status: failed.length ? 'failed_review_required' : skipped.length ? 'passed_with_skipped_legacy_scripts' : 'passed',
  passed_count: results.filter(r => r.status === 'passed').length,
  failed_count: failed.length,
  skipped_count: skipped.length,
  failed_commands: failed.map(r => r.script),
  skipped_commands: skipped.map(r => r.script),
  note: 'This consolidated suite archives version-specific proof commands behind proof:* entry points. Skipped commands mean the current branch does not contain that legacy script.',
  results
};
fs.writeFileSync(path.join(outDir, `proof-suite-${mode}.json`), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, `PROOF_SUITE_${mode.toUpperCase()}.md`), `# v7.0 Proof Suite: ${mode}\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`);
console.log('\n=== v7.0 proof suite summary ===');
console.log(JSON.stringify({ status: report.status, passed_count: report.passed_count, failed_count: report.failed_count, skipped_count: report.skipped_count, failed_commands: report.failed_commands, report: `release/v700/proof-suite-${mode}.json` }, null, 2));
if (failed.length) process.exit(1);
