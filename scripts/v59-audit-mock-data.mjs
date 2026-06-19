import fs from 'fs';
import path from 'path';

const root = process.cwd();
const failOnUnapproved = process.argv.includes('--fail-on-unapproved');
const releaseDir = path.join(root, 'release');
fs.mkdirSync(releaseDir, { recursive: true });

const scanDirs = ['src'];
const includeExt = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const ignoredPathFragments = [
  'node_modules',
  'dist',
  '.git',
  'release',
  'docs',
  'scripts',
  'supabase/migrations'
];

const terms = [
  { term: 'fallback', severity: 'high', reason: 'Fallback data may silently hide failed production queries.' },
  { term: 'mock', severity: 'high', reason: 'Mock data should not appear in production UI.' },
  { term: 'demo', severity: 'medium', reason: 'Demo data must be clearly separated from production.' },
  { term: 'sample', severity: 'medium', reason: 'Sample data must be seed/test only.' },
  { term: 'placeholder', severity: 'medium', reason: 'Placeholder records should not display as real records.' },
  { term: 'fake', severity: 'high', reason: 'Fake records should never be production-visible.' },
  { term: 'dummy', severity: 'high', reason: 'Dummy records should never be production-visible.' }
];

const allowlistHints = [
  'ALLOW_MOCK_DATA',
  'VITE_ALLOW_DEMO_DATA',
  'development',
  'import.meta.env.DEV',
  'seed',
  'test',
  'training',
  'dry-run',
  'dryRun'
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const normalized = full.replaceAll('\\', '/');
    if (ignoredPathFragments.some(fragment => normalized.includes(`/${fragment}/`) || normalized.endsWith(`/${fragment}`))) continue;
    if (entry.isDirectory()) walk(full, files);
    else if (includeExt.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

const findings = [];
for (const scanDir of scanDirs) {
  for (const file of walk(path.join(root, scanDir))) {
    const rel = path.relative(root, file).replaceAll('\\', '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      const lower = line.toLowerCase();
      for (const item of terms) {
        if (lower.includes(item.term)) {
          const context = [lines[index - 2], lines[index - 1], line, lines[index + 1], lines[index + 2]].filter(Boolean).join(' ');
          const allowedHint = allowlistHints.some(hint => context.includes(hint));
          const productionBlocking = item.severity === 'high' && !allowedHint;
          findings.push({
            file: rel,
            line: index + 1,
            term: item.term,
            severity: item.severity,
            production_blocking: productionBlocking,
            allowlist_hint_detected: allowedHint,
            reason: item.reason,
            snippet: line.trim().slice(0, 220)
          });
        }
      }
    });
  }
}

const summary = {
  generated_at: new Date().toISOString(),
  scanned_dirs: scanDirs,
  total_findings: findings.length,
  production_blocking_findings: findings.filter(f => f.production_blocking).length,
  high: findings.filter(f => f.severity === 'high').length,
  medium: findings.filter(f => f.severity === 'medium').length,
  files_with_findings: [...new Set(findings.map(f => f.file))].length,
  policy: 'Production UI must not silently show mock/demo/fallback/sample data.'
};

const report = { summary, findings };
fs.writeFileSync(path.join(releaseDir, 'v59-no-mock-audit.json'), JSON.stringify(report, null, 2));

const md = [
  '# v5.9 No-Mock Audit',
  '',
  `Generated: ${summary.generated_at}`,
  '',
  `- Total findings: ${summary.total_findings}`,
  `- Production-blocking findings: ${summary.production_blocking_findings}`,
  `- Files with findings: ${summary.files_with_findings}`,
  '',
  '## Production-blocking findings',
  ''
];

const blocking = findings.filter(f => f.production_blocking);
if (!blocking.length) md.push('No production-blocking findings detected by the static scanner.');
else {
  for (const f of blocking.slice(0, 200)) {
    md.push(`- **${f.file}:${f.line}** — \`${f.term}\` — ${f.reason}`);
    md.push(`  - ${f.snippet}`);
  }
}

fs.writeFileSync(path.join(releaseDir, 'v59-no-mock-audit.md'), md.join('\n'));
console.log('v5.9 no-mock audit complete.');
console.log(JSON.stringify(summary, null, 2));

if (failOnUnapproved && summary.production_blocking_findings > 0) {
  console.error('No-mock strict mode failed: production-blocking mock/fallback/demo findings exist. See release/v59-no-mock-audit.md');
  process.exit(1);
}
