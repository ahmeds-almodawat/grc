import fs from 'node:fs';
import path from 'node:path';

const packagePath = path.resolve('package.json');
if (!fs.existsSync(packagePath)) {
  console.error('package.json not found. Run this from the project root.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const scriptsToAdd = {
  'v62:static': 'node scripts/v62-real-data-static-audit.mjs',
  'v62:static-strict': 'node scripts/v62-real-data-static-audit.mjs --strict',
  'v62:demo-boundary': 'node scripts/v62-demo-boundary-audit.mjs --strict',
  'v62:result-contract': 'node scripts/v62-live-result-contract-audit.mjs --strict',
  'v62:plan': 'node scripts/v62-real-data-transition-plan.mjs',
  'v62:all': 'npm run typecheck && npm run build && npm run v60:strict && npm run v62:static-strict && npm run v62:demo-boundary && npm run v62:result-contract && npm run v62:plan'
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
  console.log('Added v6.2 real no-mock data layer scripts to package.json');
} else {
  console.log('v6.2 scripts already exist in package.json');
}

console.log('Next: npm run v62:all');
