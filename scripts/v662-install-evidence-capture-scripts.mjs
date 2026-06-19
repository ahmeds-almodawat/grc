import fs from 'node:fs';
import path from 'node:path';

const packagePath = path.resolve('package.json');
if (!fs.existsSync(packagePath)) {
  console.error('package.json not found. Run this script from the project root.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const scripts = {
  'v662:commands': 'node scripts/v662-staging-command-pack.mjs',
  'v662:templates': 'node scripts/v662-evidence-template-generator.mjs',
  'v662:quality': 'node scripts/v662-evidence-quality-gate.mjs',
  'v662:strict-proof': 'node scripts/v662-evidence-quality-gate.mjs --strict',
  'v662:all': 'npm run typecheck && npm run build && npm run test:real && npm run v662:commands && npm run v662:templates && npm run v662:quality'
};

let changed = 0;
for (const [name, command] of Object.entries(scripts)) {
  if (pkg.scripts[name] !== command) {
    pkg.scripts[name] = command;
    changed += 1;
  }
}

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Added v6.6.2 staging evidence capture scripts to package.json');
console.log({ changed_scripts: changed });
console.log('Next: npm run v662:all');
console.log('After real evidence is attached: npm run v662:strict-proof');
