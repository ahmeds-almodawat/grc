import fs from 'node:fs';
import path from 'node:path';

const packageJsonPath = path.resolve('package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('package.json not found. Run this from the project root.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const additions = {
  'v661:run-order': 'node scripts/v661-staging-run-order.mjs',
  'v661:sql-pack': 'node scripts/v661-sql-execution-helper.mjs',
  'v661:evidence': 'node scripts/v661-evidence-attachment-check.mjs',
  'v661:go-no-go': 'node scripts/v661-go-no-go-proof-helper.mjs',
  'v661:all': 'npm run typecheck && npm run build && npm run v661:run-order && npm run v661:sql-pack && npm run v661:evidence && npm run v661:go-no-go',
  'v661:strict-proof': 'node scripts/v661-evidence-attachment-check.mjs --strict && node scripts/v661-go-no-go-proof-helper.mjs --strict'
};

let changed = 0;
for (const [name, command] of Object.entries(additions)) {
  if (pkg.scripts[name] !== command) {
    pkg.scripts[name] = command;
    changed += 1;
  }
}

fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('Added v6.6.1 staging evidence helper scripts to package.json');
console.log({ changed_scripts: changed });
console.log('Next: npm run v661:all');
console.log('Strict proof after evidence files are attached: npm run v661:strict-proof');
