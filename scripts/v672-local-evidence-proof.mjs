import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const proofs = [
  'v662:strict-proof',
  'v661:strict-proof',
  'v66:strict-proof',
  'v663:progress-audit'
];

const results = [];
for (const script of proofs) {
  console.log(`\n=== npm run ${script} ===`);
  const result = spawnSync(`${npmCommand} run ${script}`, {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    shell: true
  });
  results.push({
    script,
    exit_code: result.status ?? 1,
    passed: result.status === 0,
    error: result.error?.message || null
  });
}

function readJson(file, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  } catch {
    return fallback;
  }
}

const v662 = readJson('release/v662/v662-evidence-quality-gate.json');
const v661 = readJson('release/v661/v661-go-no-go-proof.json');
const v66 = readJson('release/v66/v66-go-no-go-gate.json');
const v663 = readJson('release/v663/v663-progress-consistency-audit.json');
const summary = {
  generated_at: new Date().toISOString(),
  commands: results,
  manual_evidence_missing: v663?.manual_evidence?.missing?.length ?? null,
  blocking_count: (v66?.gates || []).filter((gate) => ['not_verified', 'manual_required'].includes(gate.status)).length,
  quality_status: v662?.quality_status ?? null,
  v661_status: v661?.status ?? null,
  v66_status: v66?.controlled_pilot_status ?? null,
  progress_status: v663?.progress_status ?? null,
  human_approval_note: 'pilot-signoff.md is draft-only; management, IT, and Quality approval remains external to this automation.'
};

fs.mkdirSync(path.join(root, 'release', 'v672'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'release', 'v672', 'v672-proof-summary.json'),
  `${JSON.stringify(summary, null, 2)}\n`,
  'utf8'
);

console.log('\n=== v6.7.2 proof summary ===');
console.log(JSON.stringify({
  manual_evidence_missing: summary.manual_evidence_missing,
  blocking_count: summary.blocking_count,
  quality_status: summary.quality_status,
  failed_commands: results.filter((result) => !result.passed).map((result) => result.script)
}, null, 2));

if (results.some((result) => !result.passed)) process.exit(1);
