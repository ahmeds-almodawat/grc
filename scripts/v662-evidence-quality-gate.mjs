import fs from 'node:fs';
import path from 'node:path';

const strict = process.argv.includes('--strict');
const evidenceDir = path.resolve('release/v66/evidence-attachments');
const outDir = path.resolve('release/v662');
fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const required = [
  {
    file: 'staging-migration-log.txt',
    kind: 'migration',
    requiredPattern: /(success|passed|applied|complete|completed|verified)/i
  },
  {
    file: '01-v64-persona-sql-output.txt',
    kind: 'persona_sql',
    requiredPattern: /(success|passed|verified|no\s+error|0\s+failed|all\s+pass)/i
  },
  {
    file: '02-v65-workflow-sql-output.txt',
    kind: 'workflow_sql',
    requiredPattern: /(success|passed|verified|no\s+error|0\s+failed|all\s+pass)/i
  },
  {
    file: '03-v66-pilot-evidence-sql-output.txt',
    kind: 'pilot_evidence_sql',
    requiredPattern: /(success|passed|verified|no\s+error|0\s+failed|all\s+pass)/i
  },
  {
    file: 'restore-dryrun-evidence.txt',
    kind: 'restore',
    requiredPattern: /(restore\s+verified|verified|passed|success|complete|completed)/i
  },
  {
    file: 'pilot-signoff.md',
    kind: 'signoff',
    requiredPattern: /(approved|go|signed|signoff|accepted)/i
  }
];

const badPatterns = [
  /TEMPLATE/i,
  /TODO/i,
  /placeholder/i,
  /replace with real/i,
  /do not move this template/i
];

const results = required.map((item) => {
  const full = path.join(evidenceDir, item.file);
  const exists = fs.existsSync(full);
  const text = exists ? fs.readFileSync(full, 'utf8') : '';
  const bytes = exists ? Buffer.byteLength(text, 'utf8') : 0;
  const hasBadPattern = badPatterns.some((p) => p.test(text));
  const hasRequiredSignal = item.requiredPattern.test(text);
  const passed = exists && bytes >= 40 && !hasBadPattern && hasRequiredSignal;
  let reason = '';
  if (!exists) reason = 'missing';
  else if (bytes < 40) reason = 'too_short';
  else if (hasBadPattern) reason = 'template_or_placeholder_detected';
  else if (!hasRequiredSignal) reason = 'missing_pass_verified_success_signal';
  return {
    file: item.file,
    kind: item.kind,
    exists,
    bytes,
    has_required_signal: hasRequiredSignal,
    has_template_or_placeholder_signal: hasBadPattern,
    passed,
    reason
  };
});

const passedCount = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed);
const strictPassed = failed.length === 0;

const report = {
  generated_at: new Date().toISOString(),
  evidence_dir: 'release/v66/evidence-attachments',
  required_total: required.length,
  passed_count: passedCount,
  failed_count: failed.length,
  strict_passed: strictPassed,
  quality_status: strictPassed ? 'ready_for_controlled_pilot_evidence_review' : 'not_ready_manual_evidence_required',
  results
};

fs.writeFileSync(path.join(outDir, 'v662-evidence-quality-gate.json'), JSON.stringify(report, null, 2));

const md = `# v6.6.2 Evidence Quality Gate\n\nGenerated: ${report.generated_at}\n\nStatus: **${report.quality_status}**\n\n| Evidence file | Passed | Reason |\n|---|---:|---|\n${results.map(r => `| \`${r.file}\` | ${r.passed ? '✅' : '❌'} | ${r.reason || 'ok'} |`).join('\n')}\n\n## Important\n\nThis checks attachment quality signals only. Final approval still requires human review of the evidence content.\n`;
fs.writeFileSync(path.join(outDir, 'V662_EVIDENCE_QUALITY_GATE.md'), md);

console.log('v6.6.2 evidence quality gate complete.');
console.log({
  required_total: required.length,
  passed_count: passedCount,
  failed_count: failed.length,
  strict_passed: strictPassed,
  quality_status: report.quality_status
});

if (strict && !strictPassed) {
  console.error('v6.6.2 strict proof failed. Attach real staging evidence files before controlled pilot approval.');
  process.exit(1);
}
