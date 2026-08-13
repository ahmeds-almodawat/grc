import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const sourceExtensions = new Set(['.ts', '.tsx']);
const literalPattern = /(?:background(?:Color)?|borderColor|color)\s*:\s*['"](?:white|black|#[0-9a-f]{3,8}|rgba?\([^)]*\))['"]/i;
const exemptions = new Set([
  'src/components/OvrPrintableReport.tsx',
  'src/dashboard/dashboardFramework.ts',
]);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return sourceExtensions.has(path.extname(entry.name)) ? [absolute] : [];
  });
}

const findings = [];
for (const absolute of walk(sourceRoot)) {
  const relative = path.relative(root, absolute).replaceAll('\\', '/');
  if (exemptions.has(relative)) continue;
  const lines = readFileSync(absolute, 'utf8').replace(/\r\n/g, '\n').split('\n');
  lines.forEach((line, index) => {
    if (literalPattern.test(line)) findings.push({ file: relative, line: index + 1 });
  });
}

console.log(JSON.stringify({
  audit: 'GRC_V13_D2_STATIC_THEME_COLOR_AUDIT',
  scannedRoot: 'src',
  allowedExceptions: [...exemptions],
  findings,
  passed: findings.length === 0,
}, null, 2));

if (findings.length > 0) process.exitCode = 1;
