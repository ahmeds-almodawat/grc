import fs from 'node:fs';

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const desiredScripts = {
  'v94:approval-shape-audit': 'node scripts/v94-approval-json-shape-audit.mjs',
  'v94:gate-simulator': 'node scripts/v94-final-gate-simulator.mjs',
  'v94:control-room': 'node scripts/v94-approver-control-room.mjs',
  'v94:go-live-rehearsal': 'node scripts/v94-go-live-rehearsal.mjs',
  'v94:risk-acceptance': 'node scripts/v94-risk-acceptance-register.mjs',
  'v94:proof-readiness': 'node scripts/v94-proof-readiness-scorecard.mjs',
  'v94:review-pack': 'node scripts/v94-generate-review-pack.mjs',
  'v94:all': 'npm run v94:approval-shape-audit && npm run v94:gate-simulator && npm run v94:control-room && npm run v94:go-live-rehearsal && npm run v94:risk-acceptance && npm run v94:proof-readiness && npm run v94:review-pack',
  'pilot:final-gate-simulator': 'npm run ci:static && npm run v94:all'
};

const added = [];
const preserved = [];

for (const [name, command] of Object.entries(desiredScripts)) {
  if (pkg.scripts[name] === command) preserved.push(name);
  else {
    pkg.scripts[name] = command;
    added.push(name);
  }
}

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
console.log('v9.4 package script installation complete.');
console.log(JSON.stringify({ changed: added.length > 0, added, preserved }, null, 2));
