import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');
const outDir = path.join(root, 'release', 'v910');
fs.mkdirSync(outDir, { recursive: true });

const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const ignored = [
  'src/demo/',
  'src/pages/ProductionDataControlCenter.tsx',
  'src/pages/NoMockAutoTestCenter.tsx',
  'src/lib/demoMode.ts',
  'src/lib/liveData.ts',
  'src/lib/supabaseClient.ts',
];

const checks = [
  { label: 'fake Employees 1K', pattern: /\bEmployees\s+1K\b/i },
  { label: '1K headline value', pattern: /\b1K\b/i },
  { label: '1,000 employee claim', pattern: /\b1,?000\s+employees?\b/i },
  { label: '50 department claim', pattern: /\b50\s+departments?\b/i },
  { label: 'demo data', pattern: /\bdemo\s+data\b/i },
  { label: 'mock data', pattern: /\bmock\s+data\b/i },
  { label: 'sample records', pattern: /\bsample\s+records\b/i },
  { label: 'fake dashboard', pattern: /\bfake\s+(dashboard|number|counter|metric)s?\b/i },
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return allowedExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

function relative(file) {
  return path.relative(root, file).replaceAll('\\', '/');
}

function isIgnored(fileName) {
  return ignored.some(prefix => fileName === prefix || fileName.startsWith(prefix));
}

const findings = [];
for (const file of walk(srcRoot)) {
  const fileName = relative(file);
  if (isIgnored(fileName)) continue;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    for (const check of checks) {
      if (check.pattern.test(line)) {
        findings.push({ file: fileName, line: index + 1, signal: check.label, text: trimmed });
      }
    }

    const containsVisiblePlaceholder = /\bplaceholder\b/i.test(line)
      && !/\bplaceholder\s*=/i.test(line)
      && !/['"`][^'"`]*\.placeholder['"`]/i.test(line);
    if (containsVisiblePlaceholder) {
      findings.push({ file: fileName, line: index + 1, signal: 'visible placeholder wording', text: trimmed });
    }
  });
}

const report = {
  generated_at: new Date().toISOString(),
  status: findings.length ? 'failed_review_required' : 'passed',
  scanned_root: 'src',
  ignored_intentional_test_or_diagnostic_paths: ignored,
  findings_count: findings.length,
  findings,
};

fs.writeFileSync(path.join(outDir, 'ui-polish-check.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log('v9.10 UI polish check complete.');
console.log(JSON.stringify({
  status: report.status,
  findings_count: report.findings_count,
  report: 'release/v910/ui-polish-check.json',
}, null, 2));

if (findings.length) process.exit(1);
