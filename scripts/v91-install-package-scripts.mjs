import fs from 'node:fs';

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const desiredScripts = {
  'v91:approval-lint': 'node scripts/v91-approval-readiness-lint.mjs',
  'v91:approver-brief': 'node scripts/v91-generate-approver-brief.mjs',
  'v91:minutes-template': 'node scripts/v91-generate-signoff-meeting-minutes.mjs',
  'v91:post-signoff-runbook': 'node scripts/v91-generate-post-signoff-runbook.mjs',
  'v91:blocker-dashboard': 'node scripts/v91-generate-final-blocker-dashboard.mjs',
  'v91:review-pack': 'node scripts/v91-generate-review-pack.mjs',
  'v91:all': 'npm run v91:approval-lint && npm run v91:approver-brief && npm run v91:minutes-template && npm run v91:post-signoff-runbook && npm run v91:blocker-dashboard && npm run v91:review-pack',
  'pilot:approval-finalization': 'npm run ci:static && npm run v91:all'
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

console.log('v9.1 package script installation complete.');
console.log(JSON.stringify({ changed: added.length > 0, added, preserved }, null, 2));
