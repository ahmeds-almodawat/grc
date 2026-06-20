import fs from 'node:fs';

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const desiredScripts = {
  'v95:workspace': 'node scripts/v95-approval-execution-workspace.mjs',
  'v95:qa-summary': 'node scripts/v95-approval-qa-summary.mjs',
  'v95:evidence-binder': 'node scripts/v95-evidence-binder-index.mjs',
  'v95:approver-drafts': 'node scripts/v95-approver-action-drafts.mjs',
  'v95:proof-plan': 'node scripts/v95-final-proof-dryrun-plan.mjs',
  'v95:review-pack': 'node scripts/v95-generate-review-pack.mjs',
  'v95:all': 'npm run v95:workspace && npm run v95:qa-summary && npm run v95:evidence-binder && npm run v95:approver-drafts && npm run v95:proof-plan && npm run v95:review-pack',
  'pilot:approval-execution-workspace': 'npm run ci:static && npm run v95:all'
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

console.log('v9.5 package script installation complete.');
console.log(JSON.stringify({ changed: added.length > 0, added, preserved }, null, 2));
