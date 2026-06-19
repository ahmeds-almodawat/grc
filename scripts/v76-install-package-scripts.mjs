import fs from 'node:fs';

const file = 'package.json';
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.scripts ||= {};

const desired = {
  'v76:script-inventory': 'node scripts/v76-script-inventory.mjs',
  'v76:repo-hygiene': 'node scripts/v76-repo-hygiene-audit.mjs',
  'v76:ci-readiness': 'node scripts/v76-ci-readiness-audit.mjs',
  'v76:evidence-ops': 'node scripts/v76-evidence-ops-dashboard.mjs',
  'v76:review-pack': 'node scripts/v76-generate-review-pack.mjs',
  'v76:all': 'npm run v76:script-inventory && npm run v76:repo-hygiene && npm run v76:ci-readiness && npm run v76:evidence-ops && npm run v76:review-pack',
  'repo:health': 'npm run ci:static && npm run v76:all'
};

const added = [];
const preserved = [];
for (const [name, command] of Object.entries(desired)) {
  if (!pkg.scripts[name]) {
    pkg.scripts[name] = command;
    added.push(name);
  } else {
    preserved.push(name);
  }
}

fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
console.log('v7.6 package script installation complete.');
console.log(JSON.stringify({ changed: added.length > 0, added, preserved }, null, 2));
