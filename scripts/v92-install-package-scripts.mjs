import fs from 'node:fs';

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const desiredScripts = {
  'v92:field-map': 'node scripts/v92-approval-field-map.mjs',
  'v92:redline': 'node scripts/v92-generate-redline-checklist.mjs',
  'v92:packet-index': 'node scripts/v92-generate-packet-index.mjs',
  'v92:final-proof-sequence': 'node scripts/v92-generate-final-proof-run-sequence.mjs',
  'v92:review-pack': 'node scripts/v92-generate-review-pack.mjs',
  'v92:all': 'npm run v92:field-map && npm run v92:redline && npm run v92:packet-index && npm run v92:final-proof-sequence && npm run v92:review-pack',
  'pilot:signoff-evidence-qa': 'npm run ci:static && npm run v92:all'
};

const added = [];
const preserved = [];

for (const [name, command] of Object.entries(desiredScripts)) {
  if (pkg.scripts[name] === command) {
    preserved.push(name);
  } else {
    pkg.scripts[name] = command;
    added.push(name);
  }
}

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

console.log('v9.2 package script installation complete.');
console.log(JSON.stringify({ changed: added.length > 0, added, preserved }, null, 2));
