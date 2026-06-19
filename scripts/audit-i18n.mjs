import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, acc = []) {
  for (const item of readdirSync(dir)) {
    const path = join(dir, item);
    if (statSync(path).isDirectory()) walk(path, acc);
    else if (/\.(tsx|ts)$/.test(item)) acc.push(path);
  }
  return acc;
}

const used = new Set();
for (const file of walk('src')) {
  const src = readFileSync(file, 'utf8');
  for (const match of src.matchAll(/(?<![A-Za-z0-9_$])t\('([^']+)'\)/g)) used.add(match[1]);
}
const i18n = readFileSync('src/i18n/I18nContext.tsx', 'utf8');
const defined = new Set([...i18n.matchAll(/'([^']+)'\s*:\s*\{\s*en:/g)].map(match => match[1]));
const missing = [...used].filter(key => !defined.has(key)).sort();
const unused = [...defined].filter(key => !used.has(key)).sort();
const result = {
  generatedAt: new Date().toISOString(),
  usedKeys: used.size,
  definedKeys: defined.size,
  missing,
  unusedCount: unused.length,
  sampleUnused: unused.slice(0, 50),
  status: missing.length ? 'warning' : 'pass'
};
mkdirSync('release/audits', { recursive: true });
writeFileSync('release/audits/i18n-audit.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (missing.length) process.exitCode = 1;
