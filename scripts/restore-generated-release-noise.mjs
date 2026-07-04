import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

const allowlistedPaths = [
  'release/v62',
  'release/v64',
  'release/v66',
  'release/v661',
  'release/v662',
  'release/v663',
  'release/v672',
  'release/v673',
  'release/v674',
  'release/v700',
  'release/v72',
  'release/patch43',
  'release/patch44',
  'release/patch45',
  'release/patch46',
  'release/patch47',
  'release/patch48',
  'release/patch49',
  'release/patch50',
  'release/patch51',
  'release/patch52',
  'release/patch53',
  'release/patch54',
  'release/patch55',
];

const existing = [];
const skipped = [];

for (const relPath of allowlistedPaths) {
  const fullPath = path.join(root, relPath);
  if (fs.existsSync(fullPath)) {
    existing.push(relPath);
  } else {
    skipped.push(relPath);
  }
}

if (existing.length) {
  const result = spawnSync('git', ['restore', '--', ...existing], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    console.error('Failed to restore generated release noise.');
    process.exit(result.status || 1);
  }
}

console.log(JSON.stringify({
  status: 'completed',
  restored_paths: existing,
  skipped_missing_paths: skipped,
}, null, 2));
