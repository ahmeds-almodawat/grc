import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const ignored = [
  'src/demo/',
  'src/pages/ScenarioTestConsole.tsx',
  'src/pages/ProductionDataControlCenter.tsx',
  'src/pages/NoMockAutoTestCenter.tsx',
  'src/lib/scenarioLab.ts',
  'src/lib/demoMode.ts',
  'src/lib/liveData.ts',
  'src/lib/supabaseClient.ts',
];

const checks = [
  { label: '1K', pattern: /\b1K\b/i },
  { label: '50 departments', pattern: /\b50\s+departments\b/i },
  { label: 'demo data', pattern: /\bdemo\s+data\b/i },
  { label: 'mock data', pattern: /\bmock\s+data\b/i },
  { label: 'sample records', pattern: /\bsample\s+records\b/i },
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

const findings = [];

for (const file of walk(srcRoot)) {
  const fileName = relative(file);
  if (ignored.some(prefix => fileName === prefix || fileName.startsWith(prefix))) continue;

  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const check of checks) {
      if (check.pattern.test(line)) {
        findings.push({ file: fileName, line: index + 1, signal: check.label, text: line.trim() });
      }
    }

    const containsVisiblePlaceholder = /\bplaceholder\b/i.test(line)
      && !/\bplaceholder\s*=/i.test(line)
      && !/['"`][^'"`]*\.placeholder['"`]/i.test(line)
      && !/^\s*(\/\/|\*|\/\*)/.test(line);
    if (containsVisiblePlaceholder) {
      findings.push({ file: fileName, line: index + 1, signal: 'placeholder', text: line.trim() });
    }
  });
}

console.log('v9.9B UI polish check');
console.log(JSON.stringify({
  scanned_root: 'src',
  ignored_intentional_test_or_diagnostic_paths: ignored,
  findings_count: findings.length,
  findings,
}, null, 2));

if (findings.length) process.exitCode = 1;
