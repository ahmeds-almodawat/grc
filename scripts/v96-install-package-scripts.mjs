import fs from 'node:fs';

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const desiredScripts = {
  'v96:completion-checklist': 'node scripts/v96-approval-completion-checklist.mjs',
  'v96:signoff-entry-qa': 'node scripts/v96-signoff-entry-qa.mjs',
  'v96:evidence-lock': 'node scripts/v96-evidence-lock-plan.mjs',
  'v96:approval-rehearsal': 'node scripts/v96-final-approval-rehearsal.mjs',
  'v96:proof-capture': 'node scripts/v96-post-signoff-proof-capture.mjs',
  'v96:release-note': 'node scripts/v96-controlled-pilot-release-note.mjs',
  'v96:review-pack': 'node scripts/v96-generate-review-pack.mjs',
  'v96:all': 'npm run v96:completion-checklist && npm run v96:signoff-entry-qa && npm run v96:evidence-lock && npm run v96:approval-rehearsal && npm run v96:proof-capture && npm run v96:release-note && npm run v96:review-pack',
  'pilot:approval-closure-control': 'npm run ci:static && npm run v96:all'
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
console.log('v9.6 package script installation complete.');
console.log(JSON.stringify({ changed: added.length > 0, added, preserved }, null, 2));
