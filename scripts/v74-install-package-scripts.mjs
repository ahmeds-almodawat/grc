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

let changed = false;

if (!pkg.scripts['ci:static']) {
  pkg.scripts['ci:static'] = 'npm run typecheck && npm run build';
  changed = true;
}

if (changed) {
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  console.log('v7.4 package scripts updated: added ci:static');
} else {
  console.log('v7.4 package scripts already present. No package.json changes needed.');
}
