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
  'v611:registry': 'node scripts/v611-sanitize-npm-registry.mjs',
  'v611:migration-plan': 'node scripts/v611-migration-prefix-cleanup-plan.mjs',
  'v611:migration-apply': 'node scripts/v611-migration-prefix-cleanup-plan.mjs --apply --i-understand-rename-migrations',
  'v611:version-truth': 'node scripts/v611-version-truth-file.mjs',
  'v611:report': 'node scripts/v611-baseline-cleanup-report.mjs',
  'v611:all': 'npm run typecheck && npm run build && npm run v61:pin-strict && npm run v611:registry && npm run v611:migration-plan && npm run v611:version-truth && npm run v611:report'
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
  console.log('Added v6.1.1 baseline cleanup scripts to package.json');
} else {
  console.log('v6.1.1 baseline cleanup scripts already exist in package.json');
}

console.log('Next: npm run v611:all');
console.log('Optional, only if this database has not already applied these local migrations: npm run v611:migration-apply && npm run v61:migrations');
