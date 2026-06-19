import fs from 'node:fs';
import path from 'node:path';

const releaseDir = path.resolve('release');
const v61Dir = path.resolve('release', 'v61');
fs.mkdirSync(v61Dir, { recursive: true });

const evidenceFiles = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (['node_modules', '.git'].includes(entry)) continue;
      walk(full);
    } else if (/\.(json|md|txt)$/i.test(entry)) {
      evidenceFiles.push(full);
    }
  }
}
walk(releaseDir);

const indicators = [
  'manual_required',
  'not_verified',
  'unverified',
  'dry-run only',
  'checklist',
  'manual evidence',
  'generated',
  'simulated'
];

const findings = evidenceFiles.map((file) => {
  const text = fs.readFileSync(file, 'utf8');
  const hits = indicators.filter((word) => text.toLowerCase().includes(word.toLowerCase()));
  return {
    file: path.relative(process.cwd(), file),
    bytes: fs.statSync(file).size,
    status: hits.length ? 'generated_or_unverified_signal' : 'no_unverified_signal_detected',
    indicators: hits
  };
}).sort((a, b) => a.file.localeCompare(b.file));

const report = {
  generated_at: new Date().toISOString(),
  policy: 'Generated reports are not production proof until tied to real staging evidence, screenshots/logs, named owner, date and signoff.',
  files_scanned: findings.length,
  generated_or_unverified_files: findings.filter((f) => f.status === 'generated_or_unverified_signal').length,
  findings
};

fs.writeFileSync(path.join(v61Dir, 'v61-generated-evidence-audit.json'), JSON.stringify(report, null, 2) + '\n');
const md = [
  '# v6.1 Generated Evidence Audit',
  '',
  `Generated: ${report.generated_at}`,
  '',
  `Files scanned: **${report.files_scanned}**`,
  `Generated/unverified signal files: **${report.generated_or_unverified_files}**`,
  '',
  '## Evidence status policy',
  '',
  'Generated JSON/Markdown reports are internal artifacts. They do not prove production readiness until backed by real staging evidence, screenshots/logs, named owner, date and signoff.',
  '',
  '## Findings',
  '',
  '| File | Status | Indicators |',
  '|---|---|---|',
  ...findings.slice(0, 120).map((f) => `| \`${f.file}\` | ${f.status} | ${f.indicators.length ? f.indicators.map((i) => `\`${i}\``).join(', ') : '-'} |`),
  ''
].join('\n');
fs.writeFileSync(path.join(v61Dir, 'v61-generated-evidence-audit.md'), md);

console.log('v6.1 generated evidence audit complete.');
console.log(JSON.stringify({ files_scanned: report.files_scanned, generated_or_unverified_files: report.generated_or_unverified_files }, null, 2));
