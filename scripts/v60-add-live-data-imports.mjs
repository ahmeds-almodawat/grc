import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  'src/lib/commandCenterApi.ts',
  'src/lib/grcApi.ts',
  'src/lib/operationsApi.ts',
  'src/lib/performanceApi.ts',
  'src/lib/releaseOpsApi.ts',
  'src/lib/securityApi.ts',
  'src/lib/testingApi.ts',
  'src/lib/v35ConsolidationApi.ts',
];

const backupDir = path.join(root, 'release', 'v60', 'hotfix-backups', 'v60.2');
fs.mkdirSync(backupDir, { recursive: true });

const importLine = "import { emptyLiveObject } from './liveData';";
const importPattern = /^import\s*\{\s*emptyLiveObject\s*\}\s*from\s*['"]\.\/liveData['"]\s*;?/m;
const results = [];

for (const rel of files) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    results.push({ file: rel, changed: false, reason: 'missing' });
    continue;
  }

  let text = fs.readFileSync(abs, 'utf8');
  if (!text.includes('emptyLiveObject')) {
    results.push({ file: rel, changed: false, reason: 'helper not used' });
    continue;
  }

  if (importPattern.test(text)) {
    results.push({ file: rel, changed: false, reason: 'import already exists' });
    continue;
  }

  fs.copyFileSync(abs, path.join(backupDir, path.basename(rel)));

  // Insert before the first import so multiline imports cannot be split.
  const lines = text.split(/\r?\n/);
  const firstImport = lines.findIndex((line) => line.trimStart().startsWith('import '));
  const insertAt = firstImport === -1 ? 0 : firstImport;
  lines.splice(insertAt, 0, importLine);
  text = lines.join('\n');

  fs.writeFileSync(abs, text, 'utf8');
  results.push({ file: rel, changed: true, reason: 'import added' });
}

console.log('v6.0.2 live-data import hotfix complete.');
console.table(results);
console.log(`Backups written to ${path.relative(root, backupDir)}`);
