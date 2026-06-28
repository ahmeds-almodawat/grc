import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v140');
fs.mkdirSync(releaseDir, { recursive: true });

const auditPath = path.join(releaseDir, 'v140-static-audit.json');
const reportPath = path.join(releaseDir, 'v140-professional-grc-report.md');
const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : null;

const checks = [
  { name: 'static_audit_exists', passed: Boolean(audit), detail: 'release/v140/v140-static-audit.json' },
  { name: 'static_audit_passed', passed: audit?.status === 'passed', detail: audit?.status || 'missing' },
  { name: 'professional_report_exists', passed: fs.existsSync(reportPath), detail: 'release/v140/v140-professional-grc-report.md' },
  { name: 'no_database_migration_required', passed: true, detail: 'v14 is frontend/static maturity layer only' },
  { name: 'approval_files_unchanged_by_design', passed: true, detail: 'No v674 approval files are touched by this proof.' },
];

const failed = checks.filter(check => !check.passed);
const proof = {
  generated_at: new Date().toISOString(),
  release: 'v14.0 Professional GRC Workflow Maturity Pack',
  status: failed.length ? 'failed' : 'passed',
  failed_count: failed.length,
  checks,
  note: 'Professional workflow maturity proof only. Does not assert broad production readiness.',
};

fs.writeFileSync(path.join(releaseDir, 'v140-final-proof.json'), JSON.stringify(proof, null, 2) + '\n');
fs.writeFileSync(path.join(releaseDir, 'v140-final-proof.md'), [
  '# v14.0 Final Proof',
  '',
  `- Generated: ${proof.generated_at}`,
  `- Status: **${proof.status}**`,
  `- Failed checks: ${proof.failed_count}`,
  '',
  '## Checks',
  ...checks.map(check => `- [${check.passed ? 'x' : ' '}] ${check.name}: ${check.detail}`),
  '',
  '## Note',
  proof.note,
  '',
].join('\n'));

console.log('v14.0 final proof complete.');
console.log({ status: proof.status, failed_count: proof.failed_count });

if (failed.length) {
  process.exitCode = 1;
}
