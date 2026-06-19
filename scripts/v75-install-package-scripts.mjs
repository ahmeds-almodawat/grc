#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagePath = path.join(root, 'package.json');

if (!fs.existsSync(packagePath)) {
  console.error('package.json not found. Run this from the project root.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const desired = {
  'ci:static': 'npm run typecheck && npm run build',
  'v75:pilot-dashboard': 'node scripts/v75-generate-pilot-dashboard.mjs',
  'v75:approval-checklist': 'node scripts/v75-generate-approval-checklist.mjs',
  'v75:executive-readout': 'node scripts/v75-generate-executive-readout.mjs',
  'v75:review-pack': 'node scripts/v75-generate-review-pack.mjs',
  'v75:all': 'npm run v75:pilot-dashboard && npm run v75:approval-checklist && npm run v75:executive-readout && npm run v75:review-pack',
  'pilot:readiness': 'npm run ci:static && npm run v75:all'
};

let changed = false;
const added = [];
const preserved = [];

for (const [name, command] of Object.entries(desired)) {
  if (!pkg.scripts[name]) {
    pkg.scripts[name] = command;
    changed = true;
    added.push(name);
  } else {
    preserved.push(name);
  }
}

if (changed) {
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

console.log('v7.5 package script installation complete.');
console.log(JSON.stringify({ changed, added, preserved }, null, 2));
