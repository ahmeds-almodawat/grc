import fs from 'node:fs';

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const desiredScripts = {
  'v93:gate-snapshot': 'node scripts/v93-gate-snapshot.mjs',
  'v93:packet-index': 'node scripts/v93-approval-packet-index.mjs',
  'v93:approver-tasks': 'node scripts/v93-approver-task-board.mjs',
  'v93:signoff-guide': 'node scripts/v93-signoff-json-guide.mjs',
  'v93:freeze-check': 'node scripts/v93-release-freeze-check.mjs',
  'v93:post-approval-protocol': 'node scripts/v93-post-approval-proof-protocol.mjs',
  'v93:command-center': 'node scripts/v93-final-approval-command-center.mjs',
  'v93:review-pack': 'node scripts/v93-generate-review-pack.mjs',
  'v93:all': 'npm run v93:gate-snapshot && npm run v93:packet-index && npm run v93:approver-tasks && npm run v93:signoff-guide && npm run v93:freeze-check && npm run v93:post-approval-protocol && npm run v93:command-center && npm run v93:review-pack',
  'pilot:final-approval-command-center': 'npm run ci:static && npm run v93:all'
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

console.log('v9.3 package script installation complete.');
console.log(JSON.stringify({ changed: added.length > 0, added, preserved }, null, 2));
