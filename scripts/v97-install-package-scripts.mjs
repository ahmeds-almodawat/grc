import fs from 'node:fs';

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const desiredScripts = {
  'v97:approval-integrity': 'node scripts/v97-approval-record-integrity.mjs',
  'v97:evidence-lock': 'node scripts/v97-evidence-lock-manifest.mjs',
  'v97:change-log-template': 'node scripts/v97-signoff-change-log-template.mjs',
  'v97:approver-packet': 'node scripts/v97-final-approver-packet.mjs',
  'v97:proof-capture-index': 'node scripts/v97-proof-capture-index.mjs',
  'v97:freeze-attestation': 'node scripts/v97-release-freeze-attestation-template.mjs',
  'v97:review-pack': 'node scripts/v97-generate-review-pack.mjs',
  'v97:all': 'npm run v97:approval-integrity && npm run v97:evidence-lock && npm run v97:change-log-template && npm run v97:approver-packet && npm run v97:proof-capture-index && npm run v97:freeze-attestation && npm run v97:review-pack',
  'pilot:approval-record-integrity': 'npm run ci:static && npm run v97:all'
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
console.log('v9.7 package script installation complete.');
console.log(JSON.stringify({ changed: added.length > 0, added, preserved }, null, 2));
