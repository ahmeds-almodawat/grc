#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const packagePath = path.resolve('package.json');
if (!fs.existsSync(packagePath)) {
  console.error('package.json not found. Run this from the repo root.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const additions = {
  'v100:foundation-audit': 'node scripts/v100-foundation-static-audit.mjs',
  'v100:foundation-report': 'node scripts/v100-generate-foundation-report.mjs',
  'v100:final-proof': 'node scripts/v100-final-proof.mjs',
  'pilot:v100-foundation': 'npm run v100:foundation-audit && npm run v100:foundation-report && npm run v100:final-proof'
};

const changed = [];
for (const [key, value] of Object.entries(additions)) {
  if (pkg.scripts[key] !== value) {
    pkg.scripts[key] = value;
    changed.push(key);
  }
}

fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('v10.0 package scripts installed.');
console.log(JSON.stringify({ changed, scripts: additions }, null, 2));
