import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import path from 'path';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const releaseDir = path.join(root, 'release', 'v60');
mkdirSync(releaseDir, { recursive: true });

const scanDirs = ['src/lib', 'src/pages', 'src/components'];
const exts = new Set(['.ts', '.tsx']);
const findings = [];

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (exts.has(path.extname(p))) out.push(p);
  }
  return out;
}

function add(file, line, severity, code, text) {
  findings.push({ file: path.relative(root, file), line, severity, code, text: text.trim().slice(0, 220) });
}

for (const dir of scanDirs) {
  for (const file of walk(path.join(root, dir))) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    if (rel.includes('/demo/') || rel.includes('/__fixtures__/')) continue;
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      const n = i + 1;
      const lower = line.toLowerCase();
      // Production blockers: runtime use of fake-data variables as return/initialization/helper fallback.
      if (/safeQuery\s*<[^>]+>\s*\([^\n]*,\s*(fallback|mock|demo|sample|dummy)\w+/i.test(line)) add(file, n, 'critical', 'RUNTIME_SAFEQUERY_FAKE_FALLBACK', line);
      if (/safeMaybeSingle\s*<[^>]+>\s*\([^\n]*,\s*(fallback|mock|demo|sample|dummy)\w+/i.test(line)) add(file, n, 'critical', 'RUNTIME_SINGLE_FAKE_FALLBACK', line);
      if (/return\s+(fallback|mock|demo|sample|dummy)\w+\s*;/i.test(line)) add(file, n, 'critical', 'RUNTIME_RETURN_FAKE_DATA', line);
      if (/useState\s*(<[^>]+>)?\s*\(\s*(fallback|mock|demo|sample|dummy)\w+/i.test(line)) add(file, n, 'high', 'UI_INITIALIZES_WITH_FAKE_DATA', line);
      if (/VITE_ALLOW_DEMO_DATA\s*===\s*['"]true['"]/.test(line) && !line.includes("MODE !== 'production'") && !line.includes('MODE !== "production"')) add(file, n, 'high', 'DEMO_FLAG_NOT_PRODUCTION_GUARDED', line);
      // Medium: hard-coded fake variable definitions. These are warnings if not used at runtime.
      if (/^\s*(const|let|var)\s+(fallback|mock|demo|sample|dummy)\w+/i.test(line)) add(file, n, 'medium', 'FAKE_DATA_DEFINITION_REVIEW', line);
      if (lower.includes('mock data') || lower.includes('demo data') || lower.includes('fallback data')) {
        if (!rel.includes('NoMock') && !rel.includes('ProductionData')) add(file, n, 'medium', 'FAKE_DATA_TEXT_REVIEW', line);
      }
    });
  }
}

const blockers = findings.filter((f) => ['critical', 'high'].includes(f.severity));
const summary = {
  generated_at: new Date().toISOString(),
  scanned_dirs: scanDirs,
  total_findings: findings.length,
  production_blocking_findings: blockers.length,
  critical: findings.filter((f) => f.severity === 'critical').length,
  high: findings.filter((f) => f.severity === 'high').length,
  medium: findings.filter((f) => f.severity === 'medium').length,
  files_with_findings: new Set(findings.map((f) => f.file)).size,
  policy: 'Production UI must not silently show mock/demo/fallback/sample data. Demo mode must be explicit and disabled in production.'
};

writeFileSync(path.join(releaseDir, 'v60-production-data-audit.json'), JSON.stringify({ summary, findings }, null, 2));
writeFileSync(path.join(releaseDir, 'v60-production-data-audit.md'), [
  '# v6.0 Production Data Audit',
  '',
  `Generated: ${summary.generated_at}`,
  '',
  `Production-blocking findings: ${summary.production_blocking_findings}`,
  `Total findings: ${summary.total_findings}`,
  '',
  '## Findings',
  '',
  ...findings.slice(0, 300).map((f) => `- **${f.severity}** ${f.code} — ${f.file}:${f.line} — \`${f.text.replace(/`/g, '')}\``),
  findings.length > 300 ? `\n...${findings.length - 300} more findings in JSON report.` : ''
].join('\n'));

console.log('v6.0 production data audit complete.');
console.log(JSON.stringify(summary, null, 2));

if (strict && blockers.length > 0) {
  console.error(`v6.0 strict audit failed: ${blockers.length} production-blocking findings remain.`);
  process.exit(1);
}
