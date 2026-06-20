import fs from 'node:fs';

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const desiredScripts = {
  'v80:launch-governance': 'node scripts/v80-pilot-launch-governance.mjs',
  'v81:staging-evidence': 'node scripts/v81-live-staging-evidence.mjs',
  'v82:kpi-pack': 'node scripts/v82-pilot-operations-kpi.mjs',
  'v83:security-privacy': 'node scripts/v83-security-privacy-assurance.mjs',
  'v84:training-change': 'node scripts/v84-training-change-management.mjs',
  'v85:executive-decision': 'node scripts/v85-executive-decision-pack.mjs',
  'v80-v85:review-pack': 'node scripts/v80-v85-generate-review-pack.mjs',
  'v80-v85:all': 'npm run v80:launch-governance && npm run v81:staging-evidence && npm run v82:kpi-pack && npm run v83:security-privacy && npm run v84:training-change && npm run v85:executive-decision && npm run v80-v85:review-pack',
  'pilot:governed-launch-suite': 'npm run ci:static && npm run v80-v85:all'
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

console.log('v8.0-v8.5 package script installation complete.');
console.log(JSON.stringify({ changed: added.length > 0, added, preserved }, null, 2));
