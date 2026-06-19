import fs from 'node:fs';
import path from 'node:path';

const packagePath = path.resolve('package.json');
if (!fs.existsSync(packagePath)) {
  console.error('package.json not found. Run this script from the project root.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts ||= {};

const requiredScripts = {
  'v672:install': 'node scripts/v672-install-local-evidence-capture-scripts.mjs',
  'v672:capture': 'node scripts/v672-local-evidence-capture.mjs',
  'v672:proof': 'node scripts/v672-local-evidence-proof.mjs',
  'v672:all': 'node scripts/v672-local-evidence-capture.mjs --run-proofs'
};

let changed = 0;
for (const [name, command] of Object.entries(requiredScripts)) {
  if (pkg.scripts[name] !== command) {
    pkg.scripts[name] = command;
    changed += 1;
  }
}

fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log('v6.7.2 local evidence capture package scripts installed.');
console.log({ changed_scripts: changed });
console.log('Run one command: npm run v672:all');
