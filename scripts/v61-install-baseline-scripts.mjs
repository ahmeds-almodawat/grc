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
  'v61:migrations': 'node scripts/v61-regenerate-migration-manifest.mjs',
  'v61:version': 'node scripts/v61-version-baseline-audit.mjs',
  'v61:capabilities': 'node scripts/v61-capability-register.mjs',
  'v61:pin-check': 'node scripts/v61-package-pin-audit.mjs',
  'v61:pin-strict': 'node scripts/v61-package-pin-audit.mjs --strict',
  'v61:pin-from-lock': 'node scripts/v61-pin-package-versions-from-lock.mjs',
  'v61:evidence': 'node scripts/v61-generated-evidence-audit.mjs',
  'v61:all': 'npm run typecheck && npm run build && npm run v61:pin-check && npm run v61:migrations && npm run v61:version && npm run v61:capabilities && npm run v61:evidence'
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
  console.log('Added v6.1 production baseline scripts to package.json');
} else {
  console.log('v6.1 production baseline scripts already exist in package.json');
}

console.log('Next: npm run v61:all');
console.log('Optional after review: npm run v61:pin-from-lock && npm install && npm run v61:all');
