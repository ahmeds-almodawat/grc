import fs from 'fs';
import path from 'path';

const packagePath = path.resolve('package.json');

if (!fs.existsSync(packagePath)) {
  console.error('package.json not found. Run this command from the project root.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const scriptsToAdd = {
  'v54:reports': 'node scripts/v54-print-report-audit.mjs',
  'v54:boardpack': 'node scripts/v54-boardpack-audit.mjs',
  'v54:ux': 'node scripts/v54-forms-ux-audit.mjs',
  'v54:employee': 'node scripts/v54-employee-mode-audit.mjs',
  'v54:all': 'npm run typecheck && npm run build && npm run v54:reports && npm run v54:boardpack && npm run v54:ux && npm run v54:employee'
};

let changed = false;
for (const [name, command] of Object.entries(scriptsToAdd)) {
  if (pkg.scripts[name] !== command) {
    pkg.scripts[name] = command;
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('Added v5.4 npm scripts to package.json');
} else {
  console.log('v5.4 npm scripts already exist in package.json');
}
